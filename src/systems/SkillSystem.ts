import { MAX_STAT_VALUE, MIN_STAT_VALUE } from '@/config/constants';
import type { AirplaneStats, Buff, Skill, TriggerType } from '@/types';
import { clamp } from '@/utils/math';

const AIRPLANE_STAT_KEYS = ['speed', 'glide', 'stability', 'trick', 'durability'] as const;

export interface SkillState {
  readonly skill: Skill;
  readonly cooldownEnd: number;
  readonly uses: number;
  readonly isReady: boolean;
}

export interface PassiveTriggerEvent {
  readonly type: TriggerType;
}

export interface ActivatedSkillResult {
  readonly buff: Buff;
  readonly cooldownEnd: number;
}

export function activateSkill(skill: Skill, currentTime: number): ActivatedSkillResult {
  if (skill.type !== 'active') {
    throw new Error('activateSkill requires an active skill');
  }

  return {
    buff: {
      id: `${skill.id}_buff`,
      name: skill.name,
      description: skill.description,
      duration: skill.effect.duration ?? 0,
      rarity: skill.rarity,
      stackable: false,
      iconKey: skill.iconKey,
      statModifiers: extractStatModifiers(skill.effect.value),
      specialEffect: skill.effect.specialId,
      sourceSkillId: skill.id,
      startTime: currentTime,
    },
    cooldownEnd: currentTime + (skill.cooldown ?? 0),
  };
}

export function updateCooldowns(skillStates: readonly SkillState[], currentTime: number): SkillState[] {
  return skillStates.map((skillState) => ({
    ...skillState,
    isReady: isSkillReady(skillState, currentTime),
  }));
}

export function isSkillReady(skillState: SkillState, currentTime: number): boolean {
  return currentTime >= skillState.cooldownEnd;
}

export function applyBuff(buff: Buff, baseStats: AirplaneStats): AirplaneStats {
  return AIRPLANE_STAT_KEYS.reduce<AirplaneStats>(
    (stats, statKey) => ({
      ...stats,
      [statKey]: clampStat(stats[statKey] + (buff.statModifiers[statKey] ?? 0)),
    }),
    baseStats,
  );
}

export function getActiveBuffs(buffs: readonly Buff[], currentTime: number): Buff[] {
  return filterUnexpiredBuffs(buffs, currentTime);
}

export function removeExpiredBuffs(buffs: readonly Buff[], currentTime: number): Buff[] {
  return filterUnexpiredBuffs(buffs, currentTime);
}

export function calculateBuffedStats(baseStats: AirplaneStats, activeBuffs: readonly Buff[]): AirplaneStats {
  return resolveBuffConflicts(activeBuffs).reduce(
    (currentStats, buff) => applyBuff(buff, currentStats),
    baseStats,
  );
}

export function checkPassiveTrigger(skill: Skill, triggerEvent: PassiveTriggerEvent): boolean {
  return skill.type === 'passive' && skill.trigger === triggerEvent.type;
}

export function resolveBuffConflicts(buffs: readonly Buff[]): Buff[] {
  const resolvedBuffs: Buff[] = [];
  const groupIndexes = new Map<string, number>();

  for (const buff of buffs) {
    if (buff.stackable) {
      resolvedBuffs.push(buff);
      continue;
    }

    const groupKey = getConflictGroupKey(buff);
    const existingIndex = groupIndexes.get(groupKey);

    if (existingIndex === undefined) {
      groupIndexes.set(groupKey, resolvedBuffs.length);
      resolvedBuffs.push(buff);
      continue;
    }

    const existingBuff = resolvedBuffs[existingIndex];
    if (compareBuffPriority(buff, existingBuff) > 0) {
      resolvedBuffs[existingIndex] = buff;
    }
  }

  return resolvedBuffs;
}

function clampStat(value: number): number {
  return clamp(value, MIN_STAT_VALUE, MAX_STAT_VALUE);
}

function extractStatModifiers(value: Skill['effect']['value']): Partial<AirplaneStats> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return AIRPLANE_STAT_KEYS.reduce<Partial<AirplaneStats>>((statModifiers, statKey) => {
    if (typeof value[statKey] !== 'number') {
      return statModifiers;
    }

    return {
      ...statModifiers,
      [statKey]: value[statKey],
    };
  }, {});
}

function isBuffExpired(buff: Buff, currentTime: number): boolean {
  if (buff.startTime === undefined) {
    return false;
  }

  return currentTime >= buff.startTime + buff.duration;
}

function filterUnexpiredBuffs(buffs: readonly Buff[], currentTime: number): Buff[] {
  return buffs.filter((buff) => !isBuffExpired(buff, currentTime));
}

function getConflictGroupKey(buff: Buff): string {
  const affectedStats = AIRPLANE_STAT_KEYS.filter((statKey) => (buff.statModifiers[statKey] ?? 0) !== 0);

  if (affectedStats.length > 0) {
    return `stats:${affectedStats.join(',')}`;
  }

  if (buff.specialEffect) {
    return `effect:${buff.specialEffect}`;
  }

  return `buff:${buff.id}`;
}

function compareBuffPriority(nextBuff: Buff, currentBuff: Buff): number {
  // 非叠加 Buff 冲突时，按“总修正值更高 → 持续时间更长 → id 字典序更大”依次取优。
  const modifierDifference = getBuffModifierScore(nextBuff) - getBuffModifierScore(currentBuff);
  if (modifierDifference !== 0) {
    return modifierDifference;
  }

  const durationDifference = nextBuff.duration - currentBuff.duration;
  if (durationDifference !== 0) {
    return durationDifference;
  }

  return nextBuff.id.localeCompare(currentBuff.id);
}

function getBuffModifierScore(buff: Buff): number {
  return AIRPLANE_STAT_KEYS.reduce((score, statKey) => score + (buff.statModifiers[statKey] ?? 0), 0);
}
