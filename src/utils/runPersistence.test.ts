import { describe, expect, it } from 'vitest';

import { getParts } from '@/systems/ContentLoader';
import { SaveManager } from '@/systems/SaveManager';
import {
  applyAirplaneUnlockRewards,
  getRetainedRunCoins,
  getRetainedRunParts,
  settleCompletedRun,
} from '@/utils/runPersistence';
import type { RaceResult, TournamentRun } from '@/types';

const PARTS = getParts();
const TEST_WEATHER = {
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
} as const;

function createRaceResult(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    raceId: 'race_1',
    score: 320,
    distance: 860,
    airTime: 14500,
    trickScore: 40,
    ranking: 1,
    totalParticipants: 2,
    weather: TEST_WEATHER,
    opponentScores: [],
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
    currentNodeId: 'node_4',
    visitedNodeIds: ['node_0', 'node_1', 'node_2', 'node_3', 'node_4'],
    currentLayer: 4,
    collectedParts: [PARTS[0]!, PARTS[1]!],
    activeBuffs: [],
    runCoins: 80,
    runSkills: [],
    raceResults: [createRaceResult()],
    startedAt: 1000,
    status: 'victory',
    ...overrides,
  };
}

describe('runPersistence', () => {
  it('settles victorious runs into persistent save data and keeps all gained parts', () => {
    const save = new SaveManager('run-persistence-victory').createDefaultSaveData(1000);
    const settlement = settleCompletedRun(
      {
        ...save,
        activeTournamentRun: createRun(),
      },
      createRun(),
      2000,
    );

    expect(settlement.experienceGained).toBe(150);
    expect(settlement.retainedCoins).toBe(80);
    expect(settlement.retainedParts).toEqual([PARTS[0], PARTS[1]]);
    expect(settlement.saveData.metaProgress.experience).toBe(150);
    expect(settlement.saveData.metaProgress.totalRunsCompleted).toBe(1);
    expect(settlement.saveData.metaProgress.bestTournamentRank).toBe(1);
    expect(settlement.saveData.currency.coins).toBe(80);
    expect(settlement.saveData.inventory).toEqual([PARTS[0], PARTS[1]]);
    expect(settlement.saveData.playerProfile.totalRaces).toBe(1);
    expect(settlement.saveData.playerProfile.totalWins).toBe(1);
    expect(settlement.saveData.activeTournamentRun).toBeUndefined();
    expect(settlement.newlyUnlockedAirplanes).toContain('classic_glider');
  });

  it('settles defeated runs with non-zero experience, half coins, and only one retained part', () => {
    const save = new SaveManager('run-persistence-defeat').createDefaultSaveData(1000);
    const defeatedRun = createRun({
      currentLayer: 2,
      currentNodeId: 'node_2',
      visitedNodeIds: ['node_0', 'node_1', 'node_2'],
      runCoins: 81,
      status: 'defeat',
      raceResults: [
        createRaceResult({
          ranking: 2,
          score: 210,
          distance: 540,
          airTime: 9000,
        }),
      ],
    });
    const settlement = settleCompletedRun(
      {
        ...save,
        activeTournamentRun: defeatedRun,
      },
      defeatedRun,
      3000,
    );

    expect(getRetainedRunParts(defeatedRun)).toEqual([PARTS[0]]);
    expect(getRetainedRunCoins(defeatedRun)).toBe(40);
    expect(settlement.experienceGained).toBe(96);
    expect(settlement.saveData.inventory).toEqual([PARTS[0]]);
    expect(settlement.saveData.currency.coins).toBe(40);
    expect(settlement.saveData.metaProgress.totalRunsCompleted).toBe(1);
    expect(settlement.saveData.playerProfile.totalWins).toBe(0);
  });

  it('merges airplane unlock rewards and rejects unfinished runs', () => {
    const save = new SaveManager('run-persistence-rewards').createDefaultSaveData(1000);

    expect(
      applyAirplaneUnlockRewards(
        save,
        [
          {
            type: 'airplane_unlock',
            value: 'classic_glider',
            rarity: 'rare',
          },
        ],
        4000,
      ).unlockedAirplanes,
    ).toContain('classic_glider');
    expect(() =>
      settleCompletedRun(
        {
          ...save,
          activeTournamentRun: createRun({
            status: 'in_progress',
          }),
        },
        createRun({
          status: 'in_progress',
        }),
      ),
    ).toThrowError(/completed run/i);
  });
});
