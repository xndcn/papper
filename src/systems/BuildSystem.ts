import { calculateFinalStats } from '@/systems/AirplaneStatsSystem';
import type { Airplane, AirplaneStats, Part, PartSlot } from '@/types';

export type EquippedPartsBySlot = Readonly<Partial<Record<PartSlot, Part>>>;

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

  const remainingParts = { ...equippedParts };
  delete remainingParts[slot];
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
