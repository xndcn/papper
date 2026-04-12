import Dexie, { type Table } from 'dexie';

import type {
  AirplaneStats,
  Buff,
  GameSettings,
  MetaProgress,
  Opponent,
  OpponentPersonality,
  Part,
  PartSlot,
  PlayerProfile,
  RaceResult,
  Reward,
  SaveData,
  Skill,
  StoryProgress,
  TournamentMap,
  TournamentNode,
  TournamentNodeType,
  TournamentRun,
  TriggerType,
  Weather,
  WeatherCondition,
} from '@/types';

const DATABASE_NAME = 'paper_wings_legend';
const CURRENT_SAVE_VERSION = 1;
const MAIN_SAVE_KEY = 'main_save';
const AUTO_SAVE_KEY = 'auto_save';
const BACKUP_SAVE_KEY = 'backup';
const SETTINGS_KEY = 'game_settings';
const PART_SLOTS = ['nose', 'wing', 'tail', 'coating', 'weight'] as const satisfies readonly PartSlot[];
const RARITIES = ['common', 'rare', 'legendary'] as const;
const SKILL_TYPES = ['active', 'passive'] as const;
const TRIGGER_TYPES = [
  'on_launch',
  'on_stall',
  'on_headwind',
  'on_collision',
  'on_trick',
  'on_low_speed',
  'on_high_altitude',
  'manual',
] as const satisfies readonly TriggerType[];
const WEATHER_CONDITIONS =
  ['tailwind', 'headwind', 'crosswind', 'storm', 'calm'] as const satisfies readonly WeatherCondition[];
const OPPONENT_PERSONALITIES =
  ['aggressive', 'balanced', 'cautious', 'tricky'] as const satisfies readonly OpponentPersonality[];
const TOURNAMENT_NODE_TYPES =
  ['race', 'elite', 'shop', 'rest', 'event', 'boss'] as const satisfies readonly TournamentNodeType[];
const RUN_STATUSES = ['in_progress', 'victory', 'defeat', 'abandoned'] as const;
const REWARD_TYPES = ['part', 'coins', 'skill', 'airplane_unlock'] as const;
const STAT_KEYS = ['speed', 'glide', 'stability', 'trick', 'durability'] as const;

interface StoredValue<T> {
  readonly key: string;
  readonly value: T;
}

class GameDatabase extends Dexie {
  saves!: Table<StoredValue<SaveData>, string>;
  settings!: Table<StoredValue<GameSettings>, string>;
  cache!: Table<StoredValue<unknown>, string>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      saves: 'key',
      settings: 'key',
      cache: 'key',
    });
  }
}

export class SaveManager {
  private readonly db: GameDatabase;
  private initialized = false;

  constructor(databaseName = DATABASE_NAME) {
    this.db = new GameDatabase(databaseName);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.db.open();
    this.initialized = true;
  }

  async saveGame(data: SaveData): Promise<void> {
    await this.ensureInitialized();

    const saveData = parseSaveData(data);
    const existingSave = await this.db.saves.get(MAIN_SAVE_KEY);

    await this.db.transaction('rw', this.db.saves, async () => {
      if (existingSave) {
        await this.db.saves.put({
          key: BACKUP_SAVE_KEY,
          value: cloneValue(existingSave.value),
        });
      }

      await this.db.saves.put({
        key: MAIN_SAVE_KEY,
        value: saveData,
      });
    });
  }

  async loadGame(): Promise<SaveData | null> {
    await this.ensureInitialized();

    const [mainSave, autoSave, backupSave] = await Promise.all([
      this.db.saves.get(MAIN_SAVE_KEY),
      this.db.saves.get(AUTO_SAVE_KEY),
      this.db.saves.get(BACKUP_SAVE_KEY),
    ]);
    const record = mainSave ?? autoSave ?? backupSave;

    return record ? cloneValue(record.value) : null;
  }

  async deleteSave(): Promise<void> {
    await this.ensureInitialized();
    await this.db.saves.bulkDelete([MAIN_SAVE_KEY, AUTO_SAVE_KEY, BACKUP_SAVE_KEY]);
  }

  async hasSave(): Promise<boolean> {
    await this.ensureInitialized();

    const saveCount = await this.db.saves.where('key').anyOf([MAIN_SAVE_KEY, AUTO_SAVE_KEY, BACKUP_SAVE_KEY]).count();
    return saveCount > 0;
  }

  async autoSave(data: SaveData): Promise<void> {
    await this.ensureInitialized();

    await this.db.saves.put({
      key: AUTO_SAVE_KEY,
      value: parseSaveData(data),
    });
  }

  async saveSettings(settings: GameSettings): Promise<void> {
    await this.ensureInitialized();

    await this.db.settings.put({
      key: SETTINGS_KEY,
      value: parseGameSettings(settings),
    });
  }

  async loadSettings(): Promise<GameSettings | null> {
    await this.ensureInitialized();

    const record = await this.db.settings.get(SETTINGS_KEY);
    return record ? cloneValue(record.value) : null;
  }

  async exportSave(): Promise<string> {
    const save = await this.loadGame();

    if (!save) {
      throw new Error('No save data available to export');
    }

    return JSON.stringify(save, null, 2);
  }

  async importSave(json: string): Promise<void> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Invalid save JSON');
    }

    const saveData = parseSaveData(parsed);

    if (saveData.version !== CURRENT_SAVE_VERSION) {
      throw new Error(`Unsupported save version: ${saveData.version}`);
    }

    await this.saveGame(saveData);
  }

  createDefaultSaveData(now = Date.now()): SaveData {
    return {
      version: CURRENT_SAVE_VERSION,
      playerProfile: {
        name: '新手飞手',
        createdAt: now,
        totalPlayTime: 0,
        totalRaces: 0,
        totalWins: 0,
        bestScore: 0,
        longestFlight: 0,
      },
      unlockedAirplanes: ['classic_dart'],
      inventory: [],
      equippedLoadout: {
        airplaneId: 'classic_dart',
        parts: {
          nose: null,
          wing: null,
          tail: null,
          coating: null,
          weight: null,
        },
        skills: [],
      },
      storyProgress: {
        chapter: 1,
        completedEvents: [],
        npcRelationships: {},
        unlockedLocations: ['MainMenuScene'],
        completedDialogues: [],
      },
      metaProgress: {
        level: 1,
        experience: 0,
        permanentUpgrades: [],
        achievements: [],
        totalRunsCompleted: 0,
        bestTournamentRank: 0,
      },
      currency: {
        coins: 0,
        premiumTickets: 1,
      },
      settings: createDefaultGameSettings(),
      lastSavedAt: now,
    };
  }

  async close(): Promise<void> {
    this.db.close();
    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export function createDefaultGameSettings(): GameSettings {
  return {
    masterVolume: 1,
    bgmVolume: 0.8,
    sfxVolume: 0.8,
    language: 'zh-CN',
    showTutorial: true,
    autoSave: true,
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      largeText: false,
    },
  };
}

function parseSaveData(value: unknown): SaveData {
  const save = expectRecord(value, 'saveData');
  const version = expectInteger(save.version, 'saveData.version');

  if (version !== CURRENT_SAVE_VERSION) {
    throw new Error(`saveData.version must be ${CURRENT_SAVE_VERSION}`);
  }

  return {
    version,
    playerProfile: parsePlayerProfile(save.playerProfile, 'saveData.playerProfile'),
    unlockedAirplanes: expectStringArray(save.unlockedAirplanes, 'saveData.unlockedAirplanes'),
    inventory: expectArray(save.inventory, 'saveData.inventory').map((part, index) =>
      parsePart(part, `saveData.inventory[${index}]`),
    ),
    equippedLoadout: parseEquippedLoadout(save.equippedLoadout, 'saveData.equippedLoadout'),
    storyProgress: parseStoryProgress(save.storyProgress, 'saveData.storyProgress'),
    metaProgress: parseMetaProgress(save.metaProgress, 'saveData.metaProgress'),
    currency: parseCurrency(save.currency, 'saveData.currency'),
    settings: parseGameSettings(save.settings),
    activeTournamentRun:
      save.activeTournamentRun === undefined
        ? undefined
        : parseTournamentRun(save.activeTournamentRun, 'saveData.activeTournamentRun'),
    lastSavedAt: expectNonNegativeNumber(save.lastSavedAt, 'saveData.lastSavedAt'),
  };
}

function parsePlayerProfile(value: unknown, path: string): PlayerProfile {
  const profile = expectRecord(value, path);

  return {
    name: expectNonEmptyString(profile.name, `${path}.name`),
    createdAt: expectNonNegativeNumber(profile.createdAt, `${path}.createdAt`),
    totalPlayTime: expectNonNegativeNumber(profile.totalPlayTime, `${path}.totalPlayTime`),
    totalRaces: expectNonNegativeNumber(profile.totalRaces, `${path}.totalRaces`),
    totalWins: expectNonNegativeNumber(profile.totalWins, `${path}.totalWins`),
    bestScore: expectNonNegativeNumber(profile.bestScore, `${path}.bestScore`),
    longestFlight: expectNonNegativeNumber(profile.longestFlight, `${path}.longestFlight`),
  };
}

function parseStoryProgress(value: unknown, path: string): StoryProgress {
  const progress = expectRecord(value, path);
  const npcRelationshipsValue = expectRecord(progress.npcRelationships, `${path}.npcRelationships`);
  const npcRelationships = Object.fromEntries(
    Object.entries(npcRelationshipsValue).map(([key, entryValue]) => [key, expectNumber(entryValue, `${path}.npcRelationships.${key}`)]),
  );

  return {
    chapter: expectInteger(progress.chapter, `${path}.chapter`),
    completedEvents: expectStringArray(progress.completedEvents, `${path}.completedEvents`),
    npcRelationships,
    unlockedLocations: expectStringArray(progress.unlockedLocations, `${path}.unlockedLocations`),
    completedDialogues: expectStringArray(progress.completedDialogues, `${path}.completedDialogues`),
  };
}

function parseMetaProgress(value: unknown, path: string): MetaProgress {
  const progress = expectRecord(value, path);

  return {
    level: expectPositiveInteger(progress.level, `${path}.level`),
    experience: expectNonNegativeNumber(progress.experience, `${path}.experience`),
    permanentUpgrades: expectStringArray(progress.permanentUpgrades, `${path}.permanentUpgrades`),
    achievements: expectStringArray(progress.achievements, `${path}.achievements`),
    totalRunsCompleted: expectNonNegativeNumber(progress.totalRunsCompleted, `${path}.totalRunsCompleted`),
    bestTournamentRank: expectNonNegativeNumber(progress.bestTournamentRank, `${path}.bestTournamentRank`),
  };
}

function parseCurrency(value: unknown, path: string): SaveData['currency'] {
  const currency = expectRecord(value, path);

  return {
    coins: expectNonNegativeNumber(currency.coins, `${path}.coins`),
    premiumTickets: expectNonNegativeNumber(currency.premiumTickets, `${path}.premiumTickets`),
  };
}

function parseGameSettings(value: unknown): GameSettings {
  const settings = expectRecord(value, 'gameSettings');

  return {
    masterVolume: expectUnitInterval(settings.masterVolume, 'gameSettings.masterVolume'),
    bgmVolume: expectUnitInterval(settings.bgmVolume, 'gameSettings.bgmVolume'),
    sfxVolume: expectUnitInterval(settings.sfxVolume, 'gameSettings.sfxVolume'),
    language: expectLiteral(settings.language, ['zh-CN'], 'gameSettings.language'),
    showTutorial: expectBoolean(settings.showTutorial, 'gameSettings.showTutorial'),
    autoSave: expectBoolean(settings.autoSave, 'gameSettings.autoSave'),
    accessibility: parseAccessibility(settings.accessibility, 'gameSettings.accessibility'),
  };
}

function parseAccessibility(value: unknown, path: string): GameSettings['accessibility'] {
  const accessibility = expectRecord(value, path);

  return {
    highContrast: expectBoolean(accessibility.highContrast, `${path}.highContrast`),
    reducedMotion: expectBoolean(accessibility.reducedMotion, `${path}.reducedMotion`),
    largeText: expectBoolean(accessibility.largeText, `${path}.largeText`),
  };
}

function parseEquippedLoadout(value: unknown, path: string): SaveData['equippedLoadout'] {
  const loadout = expectRecord(value, path);
  const parts = expectRecord(loadout.parts, `${path}.parts`);

  return {
    airplaneId: expectNonEmptyString(loadout.airplaneId, `${path}.airplaneId`),
    parts: {
      nose: parseNullableString(parts.nose, `${path}.parts.nose`),
      wing: parseNullableString(parts.wing, `${path}.parts.wing`),
      tail: parseNullableString(parts.tail, `${path}.parts.tail`),
      coating: parseNullableString(parts.coating, `${path}.parts.coating`),
      weight: parseNullableString(parts.weight, `${path}.parts.weight`),
    },
    skills: expectStringArray(loadout.skills, `${path}.skills`),
  };
}

function parseTournamentRun(value: unknown, path: string): TournamentRun {
  const run = expectRecord(value, path);

  return {
    seed: expectInteger(run.seed, `${path}.seed`),
    map: parseTournamentMap(run.map, `${path}.map`),
    currentNodeId: expectPossiblyEmptyString(run.currentNodeId, `${path}.currentNodeId`),
    visitedNodeIds: expectStringArray(run.visitedNodeIds, `${path}.visitedNodeIds`),
    currentLayer: expectInteger(run.currentLayer, `${path}.currentLayer`),
    collectedParts: expectArray(run.collectedParts, `${path}.collectedParts`).map((part, index) =>
      parsePart(part, `${path}.collectedParts[${index}]`),
    ),
    activeBuffs: expectArray(run.activeBuffs, `${path}.activeBuffs`).map((buff, index) =>
      parseBuff(buff, `${path}.activeBuffs[${index}]`),
    ),
    runCoins: expectNonNegativeNumber(run.runCoins, `${path}.runCoins`),
    runSkills: expectArray(run.runSkills, `${path}.runSkills`).map((skill, index) =>
      parseSkill(skill, `${path}.runSkills[${index}]`),
    ),
    raceResults: expectArray(run.raceResults, `${path}.raceResults`).map((result, index) =>
      parseRaceResult(result, `${path}.raceResults[${index}]`),
    ),
    startedAt: expectNonNegativeNumber(run.startedAt, `${path}.startedAt`),
    status: expectLiteral(run.status, RUN_STATUSES, `${path}.status`),
  };
}

function parseTournamentMap(value: unknown, path: string): TournamentMap {
  const map = expectRecord(value, path);

  return {
    seed: expectInteger(map.seed, `${path}.seed`),
    layers: expectArray(map.layers, `${path}.layers`).map((layer, layerIndex) =>
      expectArray(layer, `${path}.layers[${layerIndex}]`).map((node, nodeIndex) =>
        parseTournamentNode(node, `${path}.layers[${layerIndex}][${nodeIndex}]`),
      ),
    ),
    totalLayers: expectPositiveInteger(map.totalLayers, `${path}.totalLayers`),
  };
}

function parseTournamentNode(value: unknown, path: string): TournamentNode {
  const node = expectRecord(value, path);
  const type = expectLiteral(node.type, TOURNAMENT_NODE_TYPES, `${path}.type`);

  return {
    id: expectNonEmptyString(node.id, `${path}.id`),
    type,
    position: parseVector(node.position, `${path}.position`),
    connections: expectStringArray(node.connections, `${path}.connections`),
    difficulty: expectInteger(node.difficulty, `${path}.difficulty`),
    rewards: expectArray(node.rewards, `${path}.rewards`).map((reward, index) => parseReward(reward, `${path}.rewards[${index}]`)),
    opponent: node.opponent === undefined ? undefined : parseOpponent(node.opponent, `${path}.opponent`),
    shopInventory:
      node.shopInventory === undefined
        ? undefined
        : expectArray(node.shopInventory, `${path}.shopInventory`).map((part, index) =>
            parsePart(part, `${path}.shopInventory[${index}]`),
          ),
    eventData: node.eventData === undefined ? undefined : parseEventData(node.eventData, `${path}.eventData`),
  };
}

function parseReward(value: unknown, path: string): Reward {
  const reward = expectRecord(value, path);
  const type = expectLiteral(reward.type, REWARD_TYPES, `${path}.type`);

  return {
    type,
    value:
      type === 'part'
        ? parsePart(reward.value, `${path}.value`)
        : type === 'skill'
          ? parseSkill(reward.value, `${path}.value`)
          : type === 'coins'
            ? expectNonNegativeNumber(reward.value, `${path}.value`)
            : expectNonEmptyString(reward.value, `${path}.value`),
    rarity: expectLiteral(reward.rarity, RARITIES, `${path}.rarity`),
  };
}

function parseEventData(value: unknown, path: string): TournamentNode['eventData'] {
  const eventData = expectRecord(value, path);

  return {
    id: expectNonEmptyString(eventData.id, `${path}.id`),
    description: expectNonEmptyString(eventData.description, `${path}.description`),
    choices: expectArray(eventData.choices, `${path}.choices`).map((choice, index) => {
      const choiceRecord = expectRecord(choice, `${path}.choices[${index}]`);
      const outcome = choiceRecord.outcome;

      return {
        text: expectNonEmptyString(choiceRecord.text, `${path}.choices[${index}].text`),
        outcome: isRewardRecord(outcome)
          ? parseReward(outcome, `${path}.choices[${index}].outcome`)
          : parsePartialAirplaneStats(outcome, `${path}.choices[${index}].outcome`),
      };
    }),
  };
}

function parseRaceResult(value: unknown, path: string): RaceResult {
  const result = expectRecord(value, path);

  return {
    raceId: expectNonEmptyString(result.raceId, `${path}.raceId`),
    score: expectNumber(result.score, `${path}.score`),
    distance: expectNumber(result.distance, `${path}.distance`),
    airTime: expectNumber(result.airTime, `${path}.airTime`),
    trickScore: expectNumber(result.trickScore, `${path}.trickScore`),
    ranking: expectPositiveInteger(result.ranking, `${path}.ranking`),
    totalParticipants: expectPositiveInteger(result.totalParticipants, `${path}.totalParticipants`),
    weather: parseWeather(result.weather, `${path}.weather`),
    opponentScores: expectArray(result.opponentScores, `${path}.opponentScores`).map((score, index) => {
      const opponentScore = expectRecord(score, `${path}.opponentScores[${index}]`);

      return {
        opponentId: expectNonEmptyString(opponentScore.opponentId, `${path}.opponentScores[${index}].opponentId`),
        score: expectNumber(opponentScore.score, `${path}.opponentScores[${index}].score`),
      };
    }),
  };
}

function parsePart(value: unknown, path: string): Part {
  const part = expectRecord(value, path);

  return {
    id: expectNonEmptyString(part.id, `${path}.id`),
    name: expectNonEmptyString(part.name, `${path}.name`),
    description: expectNonEmptyString(part.description, `${path}.description`),
    slot: expectLiteral(part.slot, PART_SLOTS, `${path}.slot`),
    rarity: expectLiteral(part.rarity, RARITIES, `${path}.rarity`),
    statModifiers: parsePartialAirplaneStats(part.statModifiers, `${path}.statModifiers`),
    setId: parseOptionalString(part.setId, `${path}.setId`),
    synergies:
      part.synergies === undefined ? undefined : expectStringArray(part.synergies, `${path}.synergies`),
    synergyBonus:
      part.synergyBonus === undefined ? undefined : parsePartialAirplaneStats(part.synergyBonus, `${path}.synergyBonus`),
    spriteKey: expectNonEmptyString(part.spriteKey, `${path}.spriteKey`),
  };
}

function parseSkill(value: unknown, path: string): Skill {
  const skill = expectRecord(value, path);
  const type = expectLiteral(skill.type, SKILL_TYPES, `${path}.type`);

  return {
    id: expectNonEmptyString(skill.id, `${path}.id`),
    name: expectNonEmptyString(skill.name, `${path}.name`),
    type,
    description: expectNonEmptyString(skill.description, `${path}.description`),
    cooldown: skill.cooldown === undefined ? undefined : expectNonNegativeNumber(skill.cooldown, `${path}.cooldown`),
    trigger: skill.trigger === undefined ? undefined : expectLiteral(skill.trigger, TRIGGER_TYPES, `${path}.trigger`),
    effect: parseSkillEffect(skill.effect, `${path}.effect`),
    iconKey: expectNonEmptyString(skill.iconKey, `${path}.iconKey`),
    rarity: expectLiteral(skill.rarity, RARITIES, `${path}.rarity`),
  };
}

function parseSkillEffect(value: unknown, path: string): Skill['effect'] {
  const effect = expectRecord(value, path);
  const type = expectLiteral(effect.type, ['stat_boost', 'force_apply', 'damage_reduce', 'special'], `${path}.type`);
  const valueField = type === 'stat_boost' ? parsePartialAirplaneStats(effect.value, `${path}.value`) : expectNumber(effect.value, `${path}.value`);

  return {
    type,
    target: expectLiteral(effect.target, ['self', 'opponent', 'environment'], `${path}.target`),
    value: valueField,
    duration: effect.duration === undefined ? undefined : expectNonNegativeNumber(effect.duration, `${path}.duration`),
    specialId: parseOptionalString(effect.specialId, `${path}.specialId`),
  };
}

function parseBuff(value: unknown, path: string): Buff {
  const buff = expectRecord(value, path);

  return {
    id: expectNonEmptyString(buff.id, `${path}.id`),
    name: expectNonEmptyString(buff.name, `${path}.name`),
    description: expectNonEmptyString(buff.description, `${path}.description`),
    duration: expectNonNegativeNumber(buff.duration, `${path}.duration`),
    rarity: expectLiteral(buff.rarity, RARITIES, `${path}.rarity`),
    stackable: expectBoolean(buff.stackable, `${path}.stackable`),
    iconKey: expectNonEmptyString(buff.iconKey, `${path}.iconKey`),
    statModifiers: parsePartialAirplaneStats(buff.statModifiers, `${path}.statModifiers`),
    specialEffect: parseOptionalString(buff.specialEffect, `${path}.specialEffect`),
    sourceSkillId: parseOptionalString(buff.sourceSkillId, `${path}.sourceSkillId`),
    startTime: buff.startTime === undefined ? undefined : expectNonNegativeNumber(buff.startTime, `${path}.startTime`),
  };
}

function parseOpponent(value: unknown, path: string): Opponent {
  const opponent = expectRecord(value, path);

  return {
    id: expectNonEmptyString(opponent.id, `${path}.id`),
    name: expectNonEmptyString(opponent.name, `${path}.name`),
    title: expectNonEmptyString(opponent.title, `${path}.title`),
    personality: expectLiteral(opponent.personality, OPPONENT_PERSONALITIES, `${path}.personality`),
    airplaneId: expectNonEmptyString(opponent.airplaneId, `${path}.airplaneId`),
    partIds: expectStringArray(opponent.partIds, `${path}.partIds`),
    dialogues: parseOpponentDialogues(opponent.dialogues, `${path}.dialogues`),
    difficulty: expectInteger(opponent.difficulty, `${path}.difficulty`),
    spriteKey: expectNonEmptyString(opponent.spriteKey, `${path}.spriteKey`),
    backstory: expectNonEmptyString(opponent.backstory, `${path}.backstory`),
  };
}

function parseOpponentDialogues(value: unknown, path: string): Opponent['dialogues'] {
  const dialogues = expectRecord(value, path);

  return {
    greeting: expectNonEmptyString(dialogues.greeting, `${path}.greeting`),
    onWin: expectNonEmptyString(dialogues.onWin, `${path}.onWin`),
    onLose: expectNonEmptyString(dialogues.onLose, `${path}.onLose`),
    taunt: expectNonEmptyString(dialogues.taunt, `${path}.taunt`),
    respect: expectNonEmptyString(dialogues.respect, `${path}.respect`),
  };
}

function parseWeather(value: unknown, path: string): Weather {
  const weather = expectRecord(value, path);

  return {
    id: expectNonEmptyString(weather.id, `${path}.id`),
    condition: expectLiteral(weather.condition, WEATHER_CONDITIONS, `${path}.condition`),
    windDirection: parseVector(weather.windDirection, `${path}.windDirection`),
    windStrength: expectNumber(weather.windStrength, `${path}.windStrength`),
    effects: parseWeatherEffects(weather.effects, `${path}.effects`),
    displayName: expectNonEmptyString(weather.displayName, `${path}.displayName`),
    description: expectNonEmptyString(weather.description, `${path}.description`),
    weight: expectNonNegativeNumber(weather.weight, `${path}.weight`),
  };
}

function parseWeatherEffects(value: unknown, path: string): Weather['effects'] {
  const effects = expectRecord(value, path);

  return {
    speedModifier: expectNumber(effects.speedModifier, `${path}.speedModifier`),
    glideModifier: expectNumber(effects.glideModifier, `${path}.glideModifier`),
    stabilityModifier: expectNumber(effects.stabilityModifier, `${path}.stabilityModifier`),
    visibilityRange: expectNumber(effects.visibilityRange, `${path}.visibilityRange`),
    turbulenceIntensity: expectNumber(effects.turbulenceIntensity, `${path}.turbulenceIntensity`),
  };
}

function parseVector(value: unknown, path: string): TournamentNode['position'] {
  const vector = expectRecord(value, path);

  return {
    x: expectNumber(vector.x, `${path}.x`),
    y: expectNumber(vector.y, `${path}.y`),
  };
}

function parsePartialAirplaneStats(value: unknown, path: string): Partial<AirplaneStats> {
  const stats = expectRecord(value, path);
  const entries = Object.entries(stats).map(([key, entryValue]) => {
    if (!STAT_KEYS.includes(key as (typeof STAT_KEYS)[number])) {
      throw new Error(`${path}.${key} must be a valid airplane stat key`);
    }

    return [key, expectNumber(entryValue, `${path}.${key}`)] as const;
  });

  return Object.fromEntries(entries);
}

function parseOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectNonEmptyString(value, path);
}

function parseNullableString(value: unknown, path: string): string | null {
  if (value === null) {
    return null;
  }

  return expectNonEmptyString(value, path);
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  return value;
}

function expectNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value;
}

function expectPossiblyEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${path} must be a string`);
  }

  return value;
}

function expectStringArray(value: unknown, path: string): readonly string[] {
  return expectArray(value, path).map((entry, index) => expectNonEmptyString(entry, `${path}[${index}]`));
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${path} must be a boolean`);
  }

  return value;
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }

  return value;
}

function expectInteger(value: unknown, path: string): number {
  const numberValue = expectNumber(value, path);

  if (!Number.isInteger(numberValue)) {
    throw new Error(`${path} must be an integer`);
  }

  return numberValue;
}

function expectPositiveInteger(value: unknown, path: string): number {
  const numberValue = expectInteger(value, path);

  if (numberValue <= 0) {
    throw new Error(`${path} must be greater than 0`);
  }

  return numberValue;
}

function expectNonNegativeNumber(value: unknown, path: string): number {
  const numberValue = expectNumber(value, path);

  if (numberValue < 0) {
    throw new Error(`${path} must be greater than or equal to 0`);
  }

  return numberValue;
}

function expectUnitInterval(value: unknown, path: string): number {
  const numberValue = expectNumber(value, path);

  if (numberValue < 0 || numberValue > 1) {
    throw new Error(`${path} must be between 0 and 1`);
  }

  return numberValue;
}

function expectLiteral<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  if (typeof value !== 'string') {
    throw new Error(`${path} must be one of: ${allowed.join(', ')}`);
  }

  const matched = allowed.find((item) => item === value);

  if (!matched) {
    throw new Error(`${path} must be one of: ${allowed.join(', ')}`);
  }

  return matched;
}

function isRewardRecord(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.type === 'string' &&
    REWARD_TYPES.includes(record.type as (typeof REWARD_TYPES)[number]) &&
    typeof record.rarity === 'string' &&
    RARITIES.includes(record.rarity as (typeof RARITIES)[number])
  );
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
