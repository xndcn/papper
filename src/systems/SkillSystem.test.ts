import { describe, expect, it } from 'vitest';

import { MAX_STAT_VALUE, MIN_STAT_VALUE } from '@/config/constants';
import { getSkillById } from '@/systems/ContentLoader';
import {
  activateSkill,
  applyBuff,
  calculateBuffedStats,
  checkPassiveTrigger,
  getActiveBuffs,
  isSkillReady,
  removeExpiredBuffs,
  resolveBuffConflicts,
  updateCooldowns,
  type SkillState,
} from '@/systems/SkillSystem';
import type { AirplaneStats, Buff } from '@/types';

function createBaseStats(): AirplaneStats {
  return {
    speed: 5,
    glide: 5,
    stability: 5,
    trick: 5,
    durability: 5,
  };
}

function createBuff(overrides: Partial<Buff> = {}): Buff {
  return {
    id: 'test-buff',
    name: '测试 Buff',
    description: '用于单元测试',
    duration: 1000,
    rarity: 'common',
    stackable: false,
    iconKey: 'buff_test',
    statModifiers: {},
    ...overrides,
  };
}

describe('SkillSystem', () => {
  it('activates active skills into runtime buffs and cooldowns', () => {
    const skill = getSkillById('boost_dash');

    expect(skill).toBeDefined();

    const result = activateSkill(skill!, 5000);

    expect(result.cooldownEnd).toBe(17000);
    expect(result.buff).toEqual({
      id: 'boost_dash_buff',
      name: '加速冲刺',
      description: '瞬间压低机头换取爆发速度，短时间内显著提升前冲能力。',
      duration: 2000,
      rarity: 'common',
      stackable: false,
      iconKey: 'skill_boost_dash',
      statModifiers: {
        speed: 3,
        stability: -2,
      },
      sourceSkillId: 'boost_dash',
      startTime: 5000,
    });
  });

  it('rejects passive skills when manually activated', () => {
    const skill = getSkillById('headwind_rider');

    expect(skill).toBeDefined();
    expect(() => activateSkill(skill!, 1000)).toThrowError(/active skill/i);
  });

  it('updates cooldown snapshots and reports readiness consistently', () => {
    const skill = getSkillById('paper_shield');

    expect(skill).toBeDefined();

    const skillState: SkillState = {
      skill: skill!,
      cooldownEnd: 8000,
      uses: 1,
      isReady: false,
    };

    expect(isSkillReady(skillState, 7999)).toBe(false);
    expect(isSkillReady(skillState, 8000)).toBe(true);

    expect(updateCooldowns([skillState], 7999)).toEqual([
      {
        ...skillState,
        isReady: false,
      },
    ]);

    expect(updateCooldowns([skillState], 8000)).toEqual([
      {
        ...skillState,
        isReady: true,
      },
    ]);
  });

  it('applies buff modifiers while clamping stats to configured bounds', () => {
    const buffedStats = applyBuff(
      createBuff({
        statModifiers: {
          speed: 10,
          glide: -10,
          durability: 3,
        },
      }),
      {
        speed: MAX_STAT_VALUE,
        glide: MIN_STAT_VALUE,
        stability: 6,
        trick: 4,
        durability: 8,
      },
    );

    expect(buffedStats).toEqual({
      speed: MAX_STAT_VALUE,
      glide: MIN_STAT_VALUE,
      stability: 6,
      trick: 4,
      durability: MAX_STAT_VALUE,
    });
  });

  it('filters active buffs and removes expired runtime buffs', () => {
    const buffs = [
      createBuff({
        id: 'active-buff',
        duration: 2000,
        startTime: 1000,
      }),
      createBuff({
        id: 'expired-buff',
        duration: 500,
        startTime: 1000,
      }),
      createBuff({
        id: 'template-buff',
      }),
      createBuff({
        id: 'instant-buff',
        duration: 0,
        startTime: 1000,
      }),
    ];

    expect(getActiveBuffs(buffs, 1500).map((buff) => buff.id)).toEqual([
      'active-buff',
      'template-buff',
      'instant-buff',
    ]);
    expect(removeExpiredBuffs(buffs, 1500).map((buff) => buff.id)).toEqual([
      'active-buff',
      'template-buff',
      'instant-buff',
    ]);
  });

  it('resolves non-stackable conflicts before calculating final buffed stats', () => {
    const buffs = [
      createBuff({
        id: 'small-speed',
        statModifiers: {
          speed: 2,
        },
      }),
      createBuff({
        id: 'large-speed',
        statModifiers: {
          speed: 3,
        },
      }),
      createBuff({
        id: 'stable-flight',
        statModifiers: {
          stability: 1,
        },
      }),
      createBuff({
        id: 'stack-speed',
        stackable: true,
        statModifiers: {
          speed: 1,
        },
      }),
      createBuff({
        id: 'shield-short',
        duration: 1000,
        specialEffect: 'shared_shield',
      }),
      createBuff({
        id: 'shield-long',
        duration: 3000,
        specialEffect: 'shared_shield',
      }),
    ];

    expect(resolveBuffConflicts(buffs).map((buff) => buff.id)).toEqual([
      'large-speed',
      'stable-flight',
      'stack-speed',
      'shield-long',
    ]);
    expect(calculateBuffedStats(createBaseStats(), buffs)).toEqual({
      speed: 9,
      glide: 5,
      stability: 6,
      trick: 5,
      durability: 5,
    });
  });

  it('matches passive trigger events only for passive skills with the same trigger type', () => {
    const passiveSkill = getSkillById('headwind_rider');
    const activeSkill = getSkillById('boost_dash');

    expect(passiveSkill).toBeDefined();
    expect(activeSkill).toBeDefined();

    expect(checkPassiveTrigger(passiveSkill!, { type: 'on_headwind' })).toBe(true);
    expect(checkPassiveTrigger(passiveSkill!, { type: 'on_stall' })).toBe(false);
    expect(checkPassiveTrigger(activeSkill!, { type: 'manual' })).toBe(false);
  });
});
