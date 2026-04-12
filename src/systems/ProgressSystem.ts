import { getAirplanes, getParts, getSkills } from '@/systems/ContentLoader';
import type { MetaProgress, PlayerProfile, RaceResult, TournamentRun } from '@/types';

const MAX_META_LEVEL = 30;
const COMMON_RARITY = 'common';
const LEGENDARY_RARITY = 'legendary';
const RARE_CONTENT_UNLOCK_LEVEL = 6;
const LEGENDARY_CONTENT_UNLOCK_LEVEL = 16;
const BASE_VICTORY_EXPERIENCE = 100;
const MAX_VICTORY_EXPERIENCE = 150;
const BASE_DEFEAT_EXPERIENCE = 60;
const MAX_DEFEAT_EXPERIENCE = 120;

const META_LEVEL_MILESTONES = [
  { level: 1, experience: 0 },
  { level: 6, experience: 500 },
  { level: 11, experience: 2000 },
  { level: 16, experience: 5000 },
  { level: 21, experience: 12000 },
  { level: MAX_META_LEVEL, experience: 30000 },
] as const;

export interface UnlockCondition {
  readonly minLevel?: number;
  readonly minExperience?: number;
  readonly requiredAchievements?: readonly string[];
  readonly requiredUpgrades?: readonly string[];
  readonly minRunsCompleted?: number;
  readonly maxBestTournamentRank?: number;
}

export interface UnlockedContent {
  readonly airplanes: readonly string[];
  readonly skills: readonly string[];
  readonly partPool: readonly string[];
}

export function addExperience(meta: MetaProgress, amount: number): MetaProgress {
  assertNonNegativeFiniteNumber(amount, 'amount');

  const experience = meta.experience + amount;

  return {
    ...meta,
    experience,
    level: getMetaLevel(experience),
  };
}

export function getMetaLevel(experience: number): number {
  assertNonNegativeFiniteNumber(experience, 'experience');

  let low = 1;
  let high = MAX_META_LEVEL;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (experience < getExperienceForLevel(mid)) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(1, high);
}

export function getExperienceForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > MAX_META_LEVEL) {
    throw new Error(`level must be an integer between 1 and ${MAX_META_LEVEL}`);
  }

  for (let index = 0; index < META_LEVEL_MILESTONES.length; index += 1) {
    const start = META_LEVEL_MILESTONES[index];
    const end = META_LEVEL_MILESTONES[index + 1];

    if (!end || level === start.level) {
      return start.experience;
    }

    if (level < end.level) {
      const levelProgress = (level - start.level) / (end.level - start.level);
      return Math.round(start.experience + (end.experience - start.experience) * levelProgress);
    }
  }

  return META_LEVEL_MILESTONES[META_LEVEL_MILESTONES.length - 1].experience;
}

export function checkUnlockConditions(meta: MetaProgress, condition: UnlockCondition): boolean {
  if (condition.minLevel !== undefined && meta.level < condition.minLevel) {
    return false;
  }

  if (condition.minExperience !== undefined && meta.experience < condition.minExperience) {
    return false;
  }

  if (condition.minRunsCompleted !== undefined && meta.totalRunsCompleted < condition.minRunsCompleted) {
    return false;
  }

  if (
    condition.maxBestTournamentRank !== undefined &&
    (meta.bestTournamentRank === 0 || meta.bestTournamentRank > condition.maxBestTournamentRank)
  ) {
    return false;
  }

  if (condition.requiredAchievements?.some((achievement) => !meta.achievements.includes(achievement))) {
    return false;
  }

  if (condition.requiredUpgrades?.some((upgrade) => !meta.permanentUpgrades.includes(upgrade))) {
    return false;
  }

  return true;
}

export function getUnlockedContent(meta: MetaProgress): UnlockedContent {
  return {
    airplanes: getAirplanes().map((airplane) => airplane.id),
    skills: getSkills()
      .filter((skill) => meta.level >= LEGENDARY_CONTENT_UNLOCK_LEVEL || skill.rarity !== LEGENDARY_RARITY)
      .map((skill) => skill.id),
    partPool: getParts()
      .filter((part) => meta.level >= RARE_CONTENT_UNLOCK_LEVEL || part.rarity === COMMON_RARITY)
      .filter((part) => meta.level >= LEGENDARY_CONTENT_UNLOCK_LEVEL || part.rarity !== LEGENDARY_RARITY)
      .map((part) => part.id),
  };
}

export function calculateRunRewardExperience(runResult: TournamentRun, isVictory: boolean): number {
  if (runResult.map.totalLayers <= 0) {
    throw new Error('runResult.map.totalLayers must be greater than 0');
  }
  if (runResult.currentLayer < 0 || runResult.currentLayer >= runResult.map.totalLayers) {
    throw new Error('runResult.currentLayer must be within the available layer range');
  }

  const totalLayers = runResult.map.totalLayers;
  const layerProgress = (runResult.currentLayer + 1) / totalLayers;
  const normalizedProgress = clamp(layerProgress, 0, 1);

  if (isVictory) {
    return Math.round(
      BASE_VICTORY_EXPERIENCE + (MAX_VICTORY_EXPERIENCE - BASE_VICTORY_EXPERIENCE) * normalizedProgress,
    );
  }

  return Math.round(BASE_DEFEAT_EXPERIENCE + (MAX_DEFEAT_EXPERIENCE - BASE_DEFEAT_EXPERIENCE) * normalizedProgress);
}

export function updateStatistics(profile: PlayerProfile, raceResult: RaceResult): PlayerProfile {
  return {
    ...profile,
    totalPlayTime: profile.totalPlayTime + raceResult.airTime,
    totalRaces: profile.totalRaces + 1,
    totalWins: profile.totalWins + (raceResult.ranking === 1 ? 1 : 0),
    bestScore: Math.max(profile.bestScore, raceResult.score),
    longestFlight: Math.max(profile.longestFlight, raceResult.distance),
  };
}

function assertNonNegativeFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
