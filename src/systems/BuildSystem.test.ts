import { describe, expect, it } from 'vitest';

import {
  calculateBuildPreview,
  calculateBuildPreviewWithSkills,
  equipPart,
  equipSkill,
  getCompatibleParts,
  getEquippedPartsList,
  getSkillSlotCount,
  sanitizeEquippedParts,
  unequipSkill,
  unequipPart,
  type EquippedPartsBySlot,
} from '@/systems/BuildSystem';
import { getSkillById } from '@/systems/ContentLoader';
import type { Airplane, Part } from '@/types';

const TEST_AIRPLANE: Airplane = {
  id: 'test-airplane',
  name: '测试机型',
  nameEn: 'Test Airplane',
  type: 'speed',
  description: '用于测试',
  baseStats: {
    speed: 5,
    glide: 4,
    stability: 3,
    trick: 2,
    durability: 6,
  },
  slots: ['nose', 'wing', 'tail'],
  specialAbility: '无',
  foldingSteps: [],
  unlockCondition: '初始解锁',
  spriteKey: 'test-airplane',
};

function createPart(id: string, slot: Part['slot'], statModifiers: Part['statModifiers']): Part {
  return {
    id,
    name: id,
    description: '用于测试',
    slot,
    rarity: 'common',
    statModifiers,
    spriteKey: id,
  };
}

describe('BuildSystem', () => {
  it('filters inventory parts to airplane-compatible slots', () => {
    const compatibleNose = createPart('nose-upgrade', 'nose', { speed: 1 });
    const compatibleWing = createPart('wing-upgrade', 'wing', { glide: 2 });
    const incompatibleWeight = createPart('weight-upgrade', 'weight', { stability: 2 });

    expect(getCompatibleParts(TEST_AIRPLANE, [compatibleNose, compatibleWing, incompatibleWeight])).toEqual([
      compatibleNose,
      compatibleWing,
    ]);
    expect(equipPart(TEST_AIRPLANE, {}, incompatibleWeight)).toEqual({});
  });

  it('equips parts by slot, replaces existing parts, and calculates preview stats', () => {
    const firstNose = createPart('nose-upgrade-a', 'nose', { speed: 1 });
    const replacementNose = createPart('nose-upgrade-b', 'nose', { speed: 2, durability: 1 });
    const wingPart = createPart('wing-upgrade', 'wing', { glide: 3 });

    const equippedWithFirst = equipPart(TEST_AIRPLANE, {}, firstNose);
    const equippedWithReplacement = equipPart(TEST_AIRPLANE, equippedWithFirst, replacementNose);
    const finalEquipped = equipPart(TEST_AIRPLANE, equippedWithReplacement, wingPart);

    expect(getEquippedPartsList(finalEquipped, TEST_AIRPLANE.slots)).toEqual([replacementNose, wingPart]);
    expect(calculateBuildPreview(TEST_AIRPLANE, finalEquipped)).toEqual({
      speed: 7,
      glide: 7,
      stability: 3,
      trick: 2,
      durability: 7,
    });
  });

  it('removes incompatible equipped parts after switching airplanes', () => {
    const equippedParts: EquippedPartsBySlot = {
      nose: createPart('nose-upgrade', 'nose', { speed: 1 }),
      wing: createPart('wing-upgrade', 'wing', { glide: 2 }),
      weight: createPart('weight-upgrade', 'weight', { stability: 2 }),
    };

    expect(sanitizeEquippedParts(TEST_AIRPLANE, equippedParts)).toEqual({
      nose: equippedParts.nose,
      wing: equippedParts.wing,
    });
    expect(unequipPart({}, 'tail')).toEqual({});
  });

  it('assigns airplane skill slots and applies passive skill modifiers in build preview', () => {
    const passiveSkill = getSkillById('headwind_rider');

    expect(passiveSkill).toBeDefined();
    expect(getSkillSlotCount(TEST_AIRPLANE)).toBe(2);
    expect(
      getSkillSlotCount({
        ...TEST_AIRPLANE,
        type: 'stability',
      }),
    ).toBe(3);
    expect(
      calculateBuildPreviewWithSkills(TEST_AIRPLANE, {}, passiveSkill ? [passiveSkill] : []),
    ).toEqual({
      speed: 5,
      glide: 5,
      stability: 5,
      trick: 2,
      durability: 6,
    });
  });

  it('equips active skills into limited slots and supports removing by slot index', () => {
    const firstSkill = getSkillById('boost_dash');
    const secondSkill = getSkillById('sharp_turn');
    const thirdSkill = getSkillById('paper_shield');

    expect(firstSkill).toBeDefined();
    expect(secondSkill).toBeDefined();
    expect(thirdSkill).toBeDefined();

    const equippedFirst = equipSkill([], firstSkill!, 2);
    const equippedSecond = equipSkill(equippedFirst, secondSkill!, 2);
    const replacedWhenFull = equipSkill(equippedSecond, thirdSkill!, 2);

    expect(equippedFirst.map((skill) => skill.id)).toEqual(['boost_dash']);
    expect(equippedSecond.map((skill) => skill.id)).toEqual(['boost_dash', 'sharp_turn']);
    expect(replacedWhenFull.map((skill) => skill.id)).toEqual(['boost_dash', 'paper_shield']);
    expect(unequipSkill(replacedWhenFull, 0).map((skill) => skill.id)).toEqual(['paper_shield']);
  });
});
