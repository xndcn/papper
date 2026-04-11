import airplanesData from '@/data/airplanes.json';
import opponentsData from '@/data/opponents.json';
import partsData from '@/data/parts.json';
import weatherPresetsData from '@/data/weather-presets.json';
import type {
  Airplane,
  AirplaneStats,
  FoldingStep,
  Opponent,
  OpponentDialogues,
  Part,
  PartSlot,
  Vector2,
  Weather,
  WeatherCondition,
  WeatherEffects,
} from '@/types';

const AIRPLANE_TYPES = ['speed', 'trick', 'stability'] as const;
const PART_SLOTS = ['nose', 'wing', 'tail', 'coating', 'weight'] as const;
const RARITIES = ['common', 'rare', 'legendary'] as const;
const WEATHER_CONDITIONS = ['tailwind', 'headwind', 'crosswind', 'storm', 'calm'] as const;
const OPPONENT_PERSONALITIES = ['aggressive', 'balanced', 'cautious', 'tricky'] as const;
const AIRPLANE_STAT_KEYS = ['speed', 'glide', 'stability', 'trick', 'durability'] as const;

interface ContentCache {
  readonly airplanes: readonly Airplane[];
  readonly airplanesById: ReadonlyMap<string, Airplane>;
  readonly parts: readonly Part[];
  readonly partsById: ReadonlyMap<string, Part>;
  readonly partsBySlot: ReadonlyMap<PartSlot, readonly Part[]>;
  readonly weatherPresets: readonly Weather[];
  readonly weatherPresetsByCondition: ReadonlyMap<WeatherCondition, Weather>;
  readonly opponents: readonly Opponent[];
  readonly opponentsById: ReadonlyMap<string, Opponent>;
}

let contentCache: ContentCache | null = null;

export function parseAirplanesDataset(dataset: unknown): readonly Airplane[] {
  const root = expectRecord(dataset, 'airplanes');
  const airplanes = expectArray(root.airplanes, 'airplanes');
  return airplanes.map((item, index) => parseAirplane(item, `airplanes[${index}]`));
}

export function parsePartsDataset(dataset: unknown): readonly Part[] {
  const root = expectRecord(dataset, 'parts');
  const parts = expectArray(root.parts, 'parts');
  return parts.map((item, index) => parsePart(item, `parts[${index}]`));
}

export function parseWeatherPresetsDataset(dataset: unknown): readonly Weather[] {
  const root = expectRecord(dataset, 'weatherPresets');
  const weatherPresets = expectArray(root.weatherPresets, 'weatherPresets');
  return weatherPresets.map((item, index) => parseWeather(item, `weatherPresets[${index}]`));
}

export function parseOpponentsDataset(dataset: unknown): readonly Opponent[] {
  const root = expectRecord(dataset, 'opponents');
  const opponents = expectArray(root.opponents, 'opponents');
  return opponents.map((item, index) => parseOpponent(item, `opponents[${index}]`));
}

export function getAirplanes(): readonly Airplane[] {
  return getContentCache().airplanes;
}

export function getAirplaneById(id: string): Airplane | undefined {
  return getContentCache().airplanesById.get(id);
}

export function getParts(): readonly Part[] {
  return getContentCache().parts;
}

export function getPartsBySlot(slot: PartSlot): readonly Part[] {
  return getContentCache().partsBySlot.get(slot) ?? [];
}

export function getWeatherPresets(): readonly Weather[] {
  return getContentCache().weatherPresets;
}

export function getWeatherPresetByCondition(condition: WeatherCondition): Weather | undefined {
  return getContentCache().weatherPresetsByCondition.get(condition);
}

export function getOpponents(): readonly Opponent[] {
  return getContentCache().opponents;
}

export function getOpponentById(id: string): Opponent | undefined {
  return getContentCache().opponentsById.get(id);
}

export function clearContentCache(): void {
  contentCache = null;
}

function getContentCache(): ContentCache {
  if (contentCache) {
    return contentCache;
  }

  const airplanes = parseAirplanesDataset(airplanesData);
  const parts = parsePartsDataset(partsData);
  const weatherPresets = parseWeatherPresetsDataset(weatherPresetsData);
  const opponents = parseOpponentsDataset(opponentsData);

  const airplanesById = createIdMap(airplanes, 'airplane');
  const partsById = createIdMap(parts, 'part');
  const opponentsById = createIdMap(opponents, 'opponent');
  const partsBySlot = createPartsBySlotMap(parts);
  const weatherPresetsByCondition = createWeatherByConditionMap(weatherPresets);

  for (const opponent of opponents) {
    if (!airplanesById.has(opponent.airplaneId)) {
      throw new Error(`opponent ${opponent.id} references unknown airplane: ${opponent.airplaneId}`);
    }
    for (const partId of opponent.partIds) {
      if (!partsById.has(partId)) {
        throw new Error(`opponent ${opponent.id} references unknown part: ${partId}`);
      }
    }
  }

  contentCache = {
    airplanes,
    airplanesById,
    parts,
    partsById,
    partsBySlot,
    weatherPresets,
    weatherPresetsByCondition,
    opponents,
    opponentsById,
  };

  return contentCache;
}

function parseAirplane(value: unknown, path: string): Airplane {
  const airplane = expectRecord(value, path);

  return {
    id: expectString(airplane.id, `${path}.id`),
    name: expectString(airplane.name, `${path}.name`),
    nameEn: expectString(airplane.nameEn, `${path}.nameEn`),
    type: expectEnum(airplane.type, AIRPLANE_TYPES, `${path}.type`),
    description: expectString(airplane.description, `${path}.description`),
    baseStats: parseAirplaneStats(airplane.baseStats, `${path}.baseStats`),
    slots: expectArray(airplane.slots, `${path}.slots`).map((slot, index) =>
      expectEnum(slot, PART_SLOTS, `${path}.slots[${index}]`),
    ),
    specialAbility: expectString(airplane.specialAbility, `${path}.specialAbility`),
    evolutionFrom: expectOptionalString(airplane.evolutionFrom, `${path}.evolutionFrom`),
    foldingSteps: expectArray(airplane.foldingSteps, `${path}.foldingSteps`).map((step, index) =>
      parseFoldingStep(step, `${path}.foldingSteps[${index}]`),
    ),
    unlockCondition: expectString(airplane.unlockCondition, `${path}.unlockCondition`),
    spriteKey: expectString(airplane.spriteKey, `${path}.spriteKey`),
  };
}

function parsePart(value: unknown, path: string): Part {
  const part = expectRecord(value, path);

  return {
    id: expectString(part.id, `${path}.id`),
    name: expectString(part.name, `${path}.name`),
    description: expectString(part.description, `${path}.description`),
    slot: expectEnum(part.slot, PART_SLOTS, `${path}.slot`),
    rarity: expectEnum(part.rarity, RARITIES, `${path}.rarity`),
    statModifiers: parsePartialAirplaneStats(part.statModifiers, `${path}.statModifiers`),
    setId: expectOptionalString(part.setId, `${path}.setId`),
    synergies: parseOptionalStringArray(part.synergies, `${path}.synergies`),
    synergyBonus: parseOptionalPartialAirplaneStats(part.synergyBonus, `${path}.synergyBonus`),
    spriteKey: expectString(part.spriteKey, `${path}.spriteKey`),
  };
}

function parseWeather(value: unknown, path: string): Weather {
  const weather = expectRecord(value, path);

  return {
    id: expectString(weather.id, `${path}.id`),
    condition: expectEnum(weather.condition, WEATHER_CONDITIONS, `${path}.condition`),
    windDirection: parseVector2(weather.windDirection, `${path}.windDirection`),
    windStrength: expectNumber(weather.windStrength, `${path}.windStrength`),
    effects: parseWeatherEffects(weather.effects, `${path}.effects`),
    displayName: expectString(weather.displayName, `${path}.displayName`),
    description: expectString(weather.description, `${path}.description`),
    weight: expectNumber(weather.weight, `${path}.weight`),
  };
}

function parseOpponent(value: unknown, path: string): Opponent {
  const opponent = expectRecord(value, path);

  return {
    id: expectString(opponent.id, `${path}.id`),
    name: expectString(opponent.name, `${path}.name`),
    title: expectString(opponent.title, `${path}.title`),
    personality: expectEnum(opponent.personality, OPPONENT_PERSONALITIES, `${path}.personality`),
    airplaneId: expectString(opponent.airplaneId, `${path}.airplaneId`),
    partIds: expectArray(opponent.partIds, `${path}.partIds`).map((partId, index) =>
      expectString(partId, `${path}.partIds[${index}]`),
    ),
    dialogues: parseOpponentDialogues(opponent.dialogues, `${path}.dialogues`),
    difficulty: expectNumber(opponent.difficulty, `${path}.difficulty`),
    spriteKey: expectString(opponent.spriteKey, `${path}.spriteKey`),
    backstory: expectString(opponent.backstory, `${path}.backstory`),
  };
}

function parseFoldingStep(value: unknown, path: string): FoldingStep {
  const step = expectRecord(value, path);

  return {
    stepNumber: expectNumber(step.stepNumber, `${path}.stepNumber`),
    instruction: expectString(step.instruction, `${path}.instruction`),
    spriteFrame: expectString(step.spriteFrame, `${path}.spriteFrame`),
  };
}

function parseAirplaneStats(value: unknown, path: string): AirplaneStats {
  const stats = expectRecord(value, path);

  return {
    speed: expectNumber(stats.speed, `${path}.speed`),
    glide: expectNumber(stats.glide, `${path}.glide`),
    stability: expectNumber(stats.stability, `${path}.stability`),
    trick: expectNumber(stats.trick, `${path}.trick`),
    durability: expectNumber(stats.durability, `${path}.durability`),
  };
}

function parsePartialAirplaneStats(value: unknown, path: string): Partial<AirplaneStats> {
  const stats = expectRecord(value, path);
  const partialStats: Partial<AirplaneStats> = {};

  for (const [key, statValue] of Object.entries(stats)) {
    if (!AIRPLANE_STAT_KEYS.includes(key as (typeof AIRPLANE_STAT_KEYS)[number])) {
      throw new TypeError(`${path}.${key} is not a supported airplane stat`);
    }

    partialStats[key as keyof AirplaneStats] = expectNumber(statValue, `${path}.${key}`);
  }

  return partialStats;
}

function parseOptionalPartialAirplaneStats(value: unknown, path: string): Partial<AirplaneStats> | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parsePartialAirplaneStats(value, path);
}

function parseVector2(value: unknown, path: string): Vector2 {
  const vector = expectRecord(value, path);

  return {
    x: expectNumber(vector.x, `${path}.x`),
    y: expectNumber(vector.y, `${path}.y`),
  };
}

function parseWeatherEffects(value: unknown, path: string): WeatherEffects {
  const effects = expectRecord(value, path);

  return {
    speedModifier: expectNumber(effects.speedModifier, `${path}.speedModifier`),
    glideModifier: expectNumber(effects.glideModifier, `${path}.glideModifier`),
    stabilityModifier: expectNumber(effects.stabilityModifier, `${path}.stabilityModifier`),
    visibilityRange: expectNumber(effects.visibilityRange, `${path}.visibilityRange`),
    turbulenceIntensity: expectNumber(effects.turbulenceIntensity, `${path}.turbulenceIntensity`),
  };
}

function parseOpponentDialogues(value: unknown, path: string): OpponentDialogues {
  const dialogues = expectRecord(value, path);

  return {
    greeting: expectString(dialogues.greeting, `${path}.greeting`),
    onWin: expectString(dialogues.onWin, `${path}.onWin`),
    onLose: expectString(dialogues.onLose, `${path}.onLose`),
    taunt: expectString(dialogues.taunt, `${path}.taunt`),
    respect: expectString(dialogues.respect, `${path}.respect`),
  };
}

function parseOptionalStringArray(value: unknown, path: string): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectArray(value, path).map((entry, index) => expectString(entry, `${path}[${index}]`));
}

function createIdMap<T extends { readonly id: string }>(items: readonly T[], itemLabel: string): ReadonlyMap<string, T> {
  const byId = new Map<string, T>();

  for (const item of items) {
    if (byId.has(item.id)) {
      throw new Error(`duplicate ${itemLabel} id: ${item.id}`);
    }

    byId.set(item.id, item);
  }

  return byId;
}

function createPartsBySlotMap(parts: readonly Part[]): ReadonlyMap<PartSlot, readonly Part[]> {
  const partsBySlot = new Map<PartSlot, Part[]>(PART_SLOTS.map((slot) => [slot, []]));

  for (const part of parts) {
    partsBySlot.get(part.slot)?.push(part);
  }

  return new Map(Array.from(partsBySlot.entries(), ([slot, slotParts]) => [slot, slotParts as readonly Part[]]));
}

function createWeatherByConditionMap(weatherPresets: readonly Weather[]): ReadonlyMap<WeatherCondition, Weather> {
  const weatherByCondition = new Map<WeatherCondition, Weather>();

  for (const weatherPreset of weatherPresets) {
    if (weatherByCondition.has(weatherPreset.condition)) {
      throw new Error(`duplicate weather condition preset: ${weatherPreset.condition}`);
    }

    weatherByCondition.set(weatherPreset.condition, weatherPreset);
  }

  return weatherByCondition;
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array`);
  }

  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${path} must be a non-empty string`);
  }

  return value;
}

function expectOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectString(value, path);
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${path} must be a valid number`);
  }

  return value;
}

function expectEnum<T extends string>(value: unknown, allowedValues: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw new TypeError(`${path} must be one of: ${allowedValues.join(', ')}`);
  }

  return value as T;
}
