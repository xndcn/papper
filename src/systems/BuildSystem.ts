import { calculateFinalStats } from '@/systems/AirplaneStatsSystem';
import { calculateBuffedStats, createSkillBuff } from '@/systems/SkillSystem';
import type { Airplane, AirplaneStats, Part, PartSlot, Skill } from '@/types';

export type EquippedPartsBySlot = Readonly<Partial<Record<PartSlot, Part>>>;
export type EquippedSkills = readonly Skill[];

export function getCompatibleParts(airplane: Airplane, inventory: readonly Part[]): readonly Part[] {
  return inventory.filter((part) => airplane.slots.includes(part.slot));
}

export function equipPart(
  airplane: Airplane,
  equippedParts: EquippedPartsBySlot,
  part: Part,
): EquippedPartsBySlot {
  if (!airplane.slots.includes(part.slot)) {
    return equippedParts;
  }

  return {
    ...equippedParts,
    [part.slot]: part,
  };
}

export function unequipPart(equippedParts: EquippedPartsBySlot, slot: PartSlot): EquippedPartsBySlot {
  if (!(slot in equippedParts)) {
    return equippedParts;
  }

  const { [slot]: removedPart, ...remainingParts } = equippedParts;
  void removedPart;
  return remainingParts;
}

export function sanitizeEquippedParts(
  airplane: Airplane,
  equippedParts: EquippedPartsBySlot,
): EquippedPartsBySlot {
  return airplane.slots.reduce<Partial<Record<PartSlot, Part>>>((sanitizedParts, slot) => {
    const equippedPart = equippedParts[slot];
    if (!equippedPart) {
      return sanitizedParts;
    }

    return {
      ...sanitizedParts,
      [slot]: equippedPart,
    };
  }, {});
}

export function getEquippedPartsList(
  equippedParts: EquippedPartsBySlot,
  slotOrder: readonly PartSlot[],
): readonly Part[] {
  return slotOrder.flatMap((slot) => {
    const equippedPart = equippedParts[slot];
    return equippedPart ? [equippedPart] : [];
  });
}

export function calculateBuildPreview(airplane: Airplane, equippedParts: EquippedPartsBySlot): AirplaneStats {
  return calculateFinalStats(airplane.baseStats, getEquippedPartsList(equippedParts, airplane.slots));
}

export function getSkillSlotCount(airplane: Airplane): number {
  return airplane.type === 'stability' ? 3 : 2;
}

export function equipSkill(equippedSkills: EquippedSkills, skill: Skill, slotCount: number): EquippedSkills {
  if (skill.type !== 'active' || slotCount < 1) {
    return equippedSkills;
  }

  if (equippedSkills.some((equippedSkill) => equippedSkill.id === skill.id)) {
    return equippedSkills;
  }

  if (equippedSkills.length < slotCount) {
    return [...equippedSkills, skill];
  }

  return [...equippedSkills.slice(0, Math.max(0, slotCount - 1)), skill];
}

export function unequipSkill(equippedSkills: EquippedSkills, slotIndex: number): EquippedSkills {
  if (slotIndex < 0 || slotIndex >= equippedSkills.length) {
    return equippedSkills;
  }

  return equippedSkills.filter((_, index) => index !== slotIndex);
}

export function calculateBuildPreviewWithSkills(
  airplane: Airplane,
  equippedParts: EquippedPartsBySlot,
  passiveSkills: readonly Skill[],
): AirplaneStats {
  const basePreview = calculateBuildPreview(airplane, equippedParts);
  const passiveBuffs = passiveSkills
    .filter((skill) => skill.type === 'passive')
    .map((skill) => createSkillBuff(skill, 0));

  return calculateBuffedStats(basePreview, passiveBuffs);
}
