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
}

export interface RaceSceneData {
  readonly airplaneId?: string;
  readonly airplaneName?: string;
  readonly airplaneStats?: AirplaneStats;
}
