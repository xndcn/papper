import {
  addExperience,
  calculateRunRewardExperience,
  getUnlockedContent,
  updateStatistics,
} from '@/systems/ProgressSystem';
import type { Part, Reward, SaveData, TournamentRun } from '@/types';

export interface CompletedRunSettlement {
  readonly saveData: SaveData;
  readonly experienceGained: number;
  readonly retainedParts: readonly Part[];
  readonly retainedCoins: number;
  readonly newlyUnlockedAirplanes: readonly string[];
}

export function describeCompletedRunSettlement(settlement: CompletedRunSettlement): readonly string[] {
  const summary = [
    `Run 结算经验 +${settlement.experienceGained}`,
    `永久金币 +${settlement.retainedCoins}`,
    `保留零件 ${settlement.retainedParts.length} 件`,
  ];

  if (settlement.newlyUnlockedAirplanes.length > 0) {
    summary.push(`解锁机型：${settlement.newlyUnlockedAirplanes.join('、')}`);
  }

  return summary;
}

export function applyAirplaneUnlockRewards(
  saveData: SaveData,
  rewards: readonly Reward[],
  now = Date.now(),
): SaveData {
  const unlockedAirplanes = mergeUniqueIds(saveData.unlockedAirplanes, getAirplaneUnlockIds(rewards));

  return unlockedAirplanes === saveData.unlockedAirplanes
    ? saveData
    : {
        ...saveData,
        unlockedAirplanes,
        lastSavedAt: now,
      };
}

export function settleCompletedRun(
  saveData: SaveData,
  run: TournamentRun,
  now = Date.now(),
): CompletedRunSettlement {
  if (run.status !== 'victory' && run.status !== 'defeat') {
    throw new Error('settleCompletedRun requires a completed run');
  }

  const retainedParts = getRetainedRunParts(run);
  const retainedCoins = getRetainedRunCoins(run);
  const experienceGained = calculateRunRewardExperience(run, run.status === 'victory');
  const metaProgressWithExperience = addExperience(saveData.metaProgress, experienceGained);
  const unlockedAirplanes = mergeUniqueIds(
    saveData.unlockedAirplanes,
    getUnlockedContent(metaProgressWithExperience).airplanes,
  );
  const existingUnlockedAirplaneIds = new Set(saveData.unlockedAirplanes);
  const newlyUnlockedAirplanes = unlockedAirplanes.filter((airplaneId) => !existingUnlockedAirplaneIds.has(airplaneId));
  const finalMetaProgress = {
    ...metaProgressWithExperience,
    totalRunsCompleted: saveData.metaProgress.totalRunsCompleted + 1,
    bestTournamentRank: resolveBestTournamentRank(saveData.metaProgress.bestTournamentRank, run),
  };
  const playerProfile = run.raceResults.reduce(updateStatistics, saveData.playerProfile);
  const saveWithoutRun = { ...saveData };
  Reflect.deleteProperty(saveWithoutRun, 'activeTournamentRun');

  return {
    saveData: {
      ...saveWithoutRun,
      playerProfile,
      inventory: [...saveData.inventory, ...retainedParts],
      unlockedAirplanes,
      metaProgress: finalMetaProgress,
      currency: {
        ...saveData.currency,
        coins: saveData.currency.coins + retainedCoins,
      },
      lastSavedAt: now,
    },
    experienceGained,
    retainedParts,
    retainedCoins,
    newlyUnlockedAirplanes,
  };
}

export function getRetainedRunParts(run: TournamentRun): readonly Part[] {
  if (run.status === 'victory') {
    return run.collectedParts;
  }

  if (run.status === 'defeat') {
    return run.collectedParts.slice(0, 1);
  }

  return [];
}

export function getRetainedRunCoins(run: TournamentRun): number {
  if (run.status === 'victory') {
    return run.runCoins;
  }

  if (run.status === 'defeat') {
    return Math.floor(run.runCoins * 0.5);
  }

  return 0;
}

function getAirplaneUnlockIds(rewards: readonly Reward[]): readonly string[] {
  return rewards.flatMap((reward) =>
    reward.type === 'airplane_unlock' && typeof reward.value === 'string' ? [reward.value] : [],
  );
}

function mergeUniqueIds(existingIds: readonly string[], nextIds: readonly string[]): readonly string[] {
  if (nextIds.length === 0) {
    return existingIds;
  }

  const seenIds = new Set(existingIds);
  const mergedIds = [...existingIds];

  for (const nextId of nextIds) {
    if (!seenIds.has(nextId)) {
      seenIds.add(nextId);
      mergedIds.push(nextId);
    }
  }

  return mergedIds.length === existingIds.length ? existingIds : mergedIds;
}

function resolveBestTournamentRank(previousBestRank: number, run: TournamentRun): number {
  const completedRanks = run.raceResults.map((result) => result.ranking).filter((ranking) => ranking > 0);
  const currentBestRank = completedRanks.length > 0 ? Math.min(...completedRanks) : 0;

  if (previousBestRank === 0) {
    return currentBestRank;
  }

  if (currentBestRank === 0) {
    return previousBestRank;
  }

  return Math.min(previousBestRank, currentBestRank);
}
