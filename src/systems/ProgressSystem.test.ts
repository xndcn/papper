import { describe, expect, it } from 'vitest';

import {
  addExperience,
  calculateRunRewardExperience,
  checkUnlockConditions,
  getExperienceForLevel,
  getMetaLevel,
  getUnlockedContent,
  updateStatistics,
  type UnlockCondition,
} from '@/systems/ProgressSystem';
import type { MetaProgress, PlayerProfile, TournamentRun } from '@/types';

function createMetaProgress(overrides: Partial<MetaProgress> = {}): MetaProgress {
  return {
    level: 1,
    experience: 0,
    permanentUpgrades: [],
    achievements: [],
    totalRunsCompleted: 0,
    bestTournamentRank: 0,
    ...overrides,
  };
}

function createPlayerProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    name: '测试飞手',
    createdAt: 1000,
    totalPlayTime: 0,
    totalRaces: 0,
    totalWins: 0,
    bestScore: 0,
    longestFlight: 0,
    ...overrides,
  };
}

function createRun(overrides: Partial<TournamentRun> = {}): TournamentRun {
  return {
    seed: 2026,
    map: {
      seed: 2026,
      layers: [],
      totalLayers: 5,
    },
    currentNodeId: 'node_2',
    visitedNodeIds: ['node_0', 'node_1', 'node_2'],
    currentLayer: 2,
    collectedParts: [],
    activeBuffs: [],
    runCoins: 0,
    runSkills: [],
    raceResults: [],
    startedAt: 1000,
    status: 'in_progress',
    ...overrides,
  };
}

describe('ProgressSystem', () => {
  it('maps experience thresholds to levels and upgrades meta progress', () => {
    expect(getExperienceForLevel(1)).toBe(0);
    expect(getExperienceForLevel(5)).toBe(400);
    expect(getExperienceForLevel(6)).toBe(500);
    expect(getExperienceForLevel(10)).toBe(1700);
    expect(getExperienceForLevel(16)).toBe(5000);
    expect(getExperienceForLevel(30)).toBe(30000);

    expect(getMetaLevel(0)).toBe(1);
    expect(getMetaLevel(399)).toBe(4);
    expect(getMetaLevel(400)).toBe(5);
    expect(getMetaLevel(500)).toBe(6);
    expect(getMetaLevel(30000)).toBe(30);
    expect(getMetaLevel(999999)).toBe(30);

    expect(
      addExperience(
        createMetaProgress({
          level: 4,
          experience: 390,
        }),
        15,
      ),
    ).toEqual(
      createMetaProgress({
        level: 5,
        experience: 405,
      }),
    );
  });

  it('checks unlock conditions against meta progress state', () => {
    const meta = createMetaProgress({
      level: 12,
      experience: 2400,
      permanentUpgrades: ['tree_speed_1', 'tree_speed_2'],
      achievements: ['first_boss_clear'],
      totalRunsCompleted: 8,
      bestTournamentRank: 1,
    });

    const satisfied: UnlockCondition = {
      minLevel: 10,
      minExperience: 2000,
      requiredUpgrades: ['tree_speed_1'],
      requiredAchievements: ['first_boss_clear'],
      minRunsCompleted: 5,
      maxBestTournamentRank: 1,
    };
    const unsatisfied: UnlockCondition = {
      minLevel: 13,
      requiredAchievements: ['legend_clear'],
    };

    expect(checkUnlockConditions(meta, satisfied)).toBe(true);
    expect(checkUnlockConditions(meta, unsatisfied)).toBe(false);
  });

  it('returns unlocked content pools based on meta level tiers', () => {
    const beginnerUnlocks = getUnlockedContent(
      createMetaProgress({
        level: 1,
      }),
    );
    const advancedUnlocks = getUnlockedContent(
      createMetaProgress({
        level: 16,
        experience: 5000,
      }),
    );

    expect(beginnerUnlocks.airplanes).toEqual(['classic_dart', 'classic_glider', 'butterfly_wing']);
    expect(beginnerUnlocks.skills).toContain('boost_dash');
    expect(beginnerUnlocks.skills).not.toContain('phoenix_rise');
    expect(beginnerUnlocks.partPool).toContain('iron_nose_clip');
    expect(beginnerUnlocks.partPool).not.toContain('streamlined_nose_cone');

    expect(advancedUnlocks.skills).toContain('phoenix_rise');
    expect(advancedUnlocks.partPool).toContain('streamlined_nose_cone');
    expect(advancedUnlocks.partPool).toContain('balance_beads');
  });

  it('calculates bounded run reward experience for victories and defeats', () => {
    expect(
      calculateRunRewardExperience(
        createRun({
          currentLayer: 4,
          visitedNodeIds: ['a', 'b', 'c', 'd', 'e'],
        }),
        true,
      ),
    ).toBe(150);

    expect(
      calculateRunRewardExperience(
        createRun({
          currentLayer: 2,
          visitedNodeIds: ['a', 'b', 'c'],
        }),
        false,
      ),
    ).toBe(96);
  });

  it('updates persistent player statistics from race results', () => {
    const updated = updateStatistics(createPlayerProfile(), {
      raceId: 'race_1',
      score: 320,
      distance: 860,
      airTime: 14500,
      trickScore: 40,
      ranking: 1,
      totalParticipants: 2,
      weather: {
        id: 'calm_day',
        condition: 'calm',
        windDirection: { x: 1, y: 0 },
        windStrength: 0,
        effects: {
          speedModifier: 1,
          glideModifier: 1,
          stabilityModifier: 1,
          visibilityRange: 1000,
          turbulenceIntensity: 0,
        },
        displayName: '平静晴空',
        description: '无明显风扰动。',
        weight: 1,
      },
      opponentScores: [],
    });

    expect(updated.totalRaces).toBe(1);
    expect(updated.totalWins).toBe(1);
    expect(updated.totalPlayTime).toBe(14500);
    expect(updated.bestScore).toBe(320);
    expect(updated.longestFlight).toBe(860);
  });
});
