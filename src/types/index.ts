import { SCENE_KEYS } from '@/config/constants';

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export interface AirplaneStats {
  readonly speed: number;
  readonly glide: number;
  readonly stability: number;
  readonly trick: number;
  readonly durability: number;
}

export type AirplaneType = 'speed' | 'trick' | 'stability';

export type PartSlot = 'nose' | 'wing' | 'tail' | 'coating' | 'weight';

export type Rarity = 'common' | 'rare' | 'legendary';

export type SkillType = 'active' | 'passive';

export type TriggerType =
  | 'on_launch'
  | 'on_stall'
  | 'on_headwind'
  | 'on_collision'
  | 'on_trick'
  | 'on_low_speed'
  | 'on_high_altitude'
  | 'manual';

export type TournamentNodeType = 'race' | 'elite' | 'shop' | 'rest' | 'event' | 'boss';

export interface SkillEffect {
  readonly type: 'stat_boost' | 'force_apply' | 'damage_reduce' | 'special';
  readonly target: 'self' | 'opponent' | 'environment';
  readonly value: Partial<AirplaneStats> | number;
  readonly duration?: number;
  readonly specialId?: string;
}

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly type: SkillType;
  readonly description: string;
  readonly cooldown?: number;
  readonly trigger?: TriggerType;
  readonly effect: SkillEffect;
  readonly iconKey: string;
  readonly rarity: Rarity;
}

export interface Buff {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly duration: number;
  readonly rarity: Rarity;
  readonly stackable: boolean;
  readonly iconKey: string;
  readonly statModifiers: Partial<AirplaneStats>;
  readonly specialEffect?: string;
  readonly sourceSkillId?: string;
  readonly startTime?: number;
}

export interface FoldingStep {
  readonly stepNumber: number;
  readonly instruction: string;
  readonly spriteFrame: string;
}

export interface Airplane {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly type: AirplaneType;
  readonly description: string;
  readonly baseStats: AirplaneStats;
  readonly slots: readonly PartSlot[];
  readonly specialAbility: string;
  readonly evolutionFrom?: string;
  readonly foldingSteps: readonly FoldingStep[];
  readonly unlockCondition: string;
  readonly spriteKey: string;
}

export interface Part {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly slot: PartSlot;
  readonly rarity: Rarity;
  readonly statModifiers: Partial<AirplaneStats>;
  readonly setId?: string;
  readonly synergies?: readonly string[];
  readonly synergyBonus?: Partial<AirplaneStats>;
  readonly spriteKey: string;
}

export type WeatherCondition = 'tailwind' | 'headwind' | 'crosswind' | 'storm' | 'calm';

export interface WeatherEffects {
  readonly speedModifier: number;
  readonly glideModifier: number;
  readonly stabilityModifier: number;
  readonly visibilityRange: number;
  readonly turbulenceIntensity: number;
}

export interface Weather {
  readonly id: string;
  readonly condition: WeatherCondition;
  readonly windDirection: Vector2;
  readonly windStrength: number;
  readonly effects: WeatherEffects;
  readonly displayName: string;
  readonly description: string;
  readonly weight: number;
}

export type OpponentPersonality = 'aggressive' | 'balanced' | 'cautious' | 'tricky';

export interface OpponentDialogues {
  readonly greeting: string;
  readonly onWin: string;
  readonly onLose: string;
  readonly taunt: string;
  readonly respect: string;
}

export interface Opponent {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly personality: OpponentPersonality;
  readonly airplaneId: string;
  readonly partIds: readonly string[];
  readonly dialogues: OpponentDialogues;
  readonly difficulty: number;
  readonly spriteKey: string;
  readonly backstory: string;
}

export interface SceneNavigationButton {
  readonly label: string;
  readonly target: SceneKey;
}

export interface ResultSceneData {
  readonly distance: number;
  readonly flightTimeMs: number;
  readonly score: number;
  readonly summary: string;
  readonly playerName?: string;
  readonly airplaneId?: string;
  readonly opponentResult?: OpponentRaceResult;
  readonly rankings?: readonly RaceParticipantResult[];
  readonly replayData?: RaceSceneData;
  readonly scoreBreakdown?: ScoreBreakdown;
  readonly nextTournamentRun?: TournamentRun;
}

export interface BuildSceneData {
  readonly airplaneId?: string;
  readonly tournamentRun?: TournamentRun;
  readonly raceConfig?: RaceConfig;
}

export interface RaceSceneData {
  readonly airplaneId?: string;
  readonly airplaneName?: string;
  readonly airplaneStats?: AirplaneStats;
  readonly equippedParts?: readonly Part[];
  readonly weather?: Weather;
  readonly opponentId?: string;
  readonly tournamentRun?: TournamentRun;
  readonly tournamentNodeId?: string;
}

export interface TournamentMapSceneData {
  readonly run?: TournamentRun;
  readonly airplaneId?: string;
  readonly message?: string;
}

export interface RaceConfig {
  readonly seed: number;
  readonly nodeId: string;
  readonly nodeType: Extract<TournamentNodeType, 'race' | 'elite' | 'boss'>;
  readonly difficulty: number;
  readonly opponent: Opponent;
  readonly weather: Weather;
  readonly rewards: readonly Reward[];
}

export interface RaceParticipantResult {
  readonly name: string;
  readonly distance: number;
  readonly flightTimeMs: number;
  readonly score: number;
  readonly isPlayer?: boolean;
}

export interface OpponentRaceResult extends RaceParticipantResult {
  readonly id: string;
  readonly title: string;
  readonly personality: OpponentPersonality;
  readonly launchAngleDegrees: number;
  readonly launchPower: number;
}

export interface ScoreBreakdown {
  readonly distanceScore: number;
  readonly airtimeScore: number;
}

export interface PlayerProfile {
  readonly name: string;
  readonly createdAt: number;
  readonly totalPlayTime: number;
  readonly totalRaces: number;
  readonly totalWins: number;
  readonly bestScore: number;
  readonly longestFlight: number;
}

export interface StoryProgress {
  readonly chapter: number;
  readonly completedEvents: readonly string[];
  readonly npcRelationships: Readonly<Record<string, number>>;
  readonly unlockedLocations: readonly string[];
  readonly completedDialogues: readonly string[];
}

export interface MetaProgress {
  readonly level: number;
  readonly experience: number;
  readonly permanentUpgrades: readonly string[];
  readonly achievements: readonly string[];
  readonly totalRunsCompleted: number;
  readonly bestTournamentRank: number;
}

export interface GameSettings {
  readonly masterVolume: number;
  readonly bgmVolume: number;
  readonly sfxVolume: number;
  readonly language: 'zh-CN';
  readonly showTutorial: boolean;
  readonly autoSave: boolean;
  readonly accessibility: {
    readonly highContrast: boolean;
    readonly reducedMotion: boolean;
    readonly largeText: boolean;
  };
}

export interface Reward {
  readonly type: 'part' | 'coins' | 'skill' | 'airplane_unlock';
  readonly value: Part | number | Skill | string;
  readonly rarity: Rarity;
}

export interface EventData {
  readonly id: string;
  readonly description: string;
  readonly choices: readonly {
    readonly text: string;
    readonly outcome: Reward | Partial<AirplaneStats>;
  }[];
}

export interface TournamentNode {
  readonly id: string;
  readonly type: TournamentNodeType;
  readonly position: Vector2;
  readonly connections: readonly string[];
  readonly difficulty: number;
  readonly rewards: readonly Reward[];
  readonly opponent?: Opponent;
  readonly shopInventory?: readonly Part[];
  readonly eventData?: EventData;
}

export interface TournamentMap {
  readonly seed: number;
  readonly layers: readonly (readonly TournamentNode[])[];
  readonly totalLayers: number;
}

export interface RaceResult {
  readonly raceId: string;
  readonly score: number;
  readonly distance: number;
  readonly airTime: number;
  readonly trickScore: number;
  readonly ranking: number;
  readonly totalParticipants: number;
  readonly weather: Weather;
  readonly opponentScores: readonly { readonly opponentId: string; readonly score: number }[];
}

export interface TournamentRun {
  readonly seed: number;
  readonly map: TournamentMap;
  readonly currentNodeId: string;
  readonly visitedNodeIds: readonly string[];
  readonly currentLayer: number;
  readonly collectedParts: readonly Part[];
  readonly activeBuffs: readonly Buff[];
  readonly runCoins: number;
  readonly runSkills: readonly Skill[];
  readonly raceResults: readonly RaceResult[];
  readonly startedAt: number;
  readonly status: 'in_progress' | 'victory' | 'defeat' | 'abandoned';
}

export interface SaveData {
  readonly version: number;
  readonly playerProfile: PlayerProfile;
  readonly unlockedAirplanes: readonly string[];
  readonly inventory: readonly Part[];
  readonly equippedLoadout: {
    readonly airplaneId: string;
    readonly parts: Readonly<Record<PartSlot, string | null>>;
    readonly skills: readonly string[];
  };
  readonly storyProgress: StoryProgress;
  readonly metaProgress: MetaProgress;
  readonly currency: {
    readonly coins: number;
    readonly premiumTickets: number;
  };
  readonly settings: GameSettings;
  readonly activeTournamentRun?: TournamentRun;
  readonly lastSavedAt: number;
}
