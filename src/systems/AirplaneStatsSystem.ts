import { MAX_STAT_VALUE, MIN_STAT_VALUE } from '@/config/constants';
import type { AirplaneStats, Part } from '@/types';
import { clamp } from '@/utils/math';

type AirplaneStatKey = keyof AirplaneStats;

function sumStatModifiers(equippedParts: readonly Part[], statKey: AirplaneStatKey): number {
  return equippedParts.reduce((total, part) => total + (part.statModifiers[statKey] ?? 0), 0);
}

function clampStat(statValue: number): number {
  return clamp(statValue, MIN_STAT_VALUE, MAX_STAT_VALUE);
}

export function calculateFinalStats(baseStats: AirplaneStats, equippedParts: readonly Part[]): AirplaneStats {
  return {
    speed: clampStat(baseStats.speed + sumStatModifiers(equippedParts, 'speed')),
    glide: clampStat(baseStats.glide + sumStatModifiers(equippedParts, 'glide')),
    stability: clampStat(baseStats.stability + sumStatModifiers(equippedParts, 'stability')),
    trick: clampStat(baseStats.trick + sumStatModifiers(equippedParts, 'trick')),
    durability: clampStat(baseStats.durability + sumStatModifiers(equippedParts, 'durability')),
  };
}
