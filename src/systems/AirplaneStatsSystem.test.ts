import { describe, expect, it } from 'vitest';

import { MAX_STAT_VALUE, MIN_STAT_VALUE } from '@/config/constants';
import { calculateFinalStats } from '@/systems/AirplaneStatsSystem';
import type { AirplaneStats, Part } from '@/types';

function createPart(statModifiers: Part['statModifiers']): Part {
  return {
    id: 'test-part',
    name: '测试零件',
    description: '用于单元测试',
    slot: 'nose',
    rarity: 'common',
    statModifiers,
    spriteKey: 'test-part',
  };
}

describe('AirplaneStatsSystem', () => {
  it('adds part modifiers on top of base stats', () => {
    const baseStats: AirplaneStats = {
      speed: 6,
      glide: 5,
      stability: 4,
      trick: 3,
      durability: 7,
    };

    const finalStats = calculateFinalStats(baseStats, [
      createPart({ speed: 2, stability: 1 }),
      createPart({ glide: 3, trick: -1 }),
    ]);

    expect(finalStats).toEqual({
      speed: 8,
      glide: 8,
      stability: 5,
      trick: 2,
      durability: 7,
    });
  });

  it('clamps final stats to the configured min and max values', () => {
    const baseStats: AirplaneStats = {
      speed: MAX_STAT_VALUE,
      glide: MIN_STAT_VALUE,
      stability: 5,
      trick: 5,
      durability: 5,
    };

    const finalStats = calculateFinalStats(baseStats, [
      createPart({ speed: 5, glide: -5, durability: 10 }),
    ]);

    expect(finalStats).toEqual({
      speed: MAX_STAT_VALUE,
      glide: MIN_STAT_VALUE,
      stability: 5,
      trick: 5,
      durability: MAX_STAT_VALUE,
    });
  });
});
