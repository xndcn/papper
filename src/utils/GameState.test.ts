import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SaveManager } from '@/systems/SaveManager';
import { generateTournamentMap } from '@/systems/TournamentSystem';
import { GameState } from '@/utils/GameState';

function createRun() {
  const map = generateTournamentMap(77, 3);

  return {
    seed: map.seed,
    map,
    currentNodeId: map.layers[0]?.[0]?.id ?? '',
    visitedNodeIds: map.layers[0]?.[0] ? [map.layers[0][0].id] : [],
    currentLayer: 0,
    collectedParts: [],
    activeBuffs: [],
    runCoins: 20,
    runSkills: [],
    raceResults: [],
    startedAt: 500,
    status: 'in_progress' as const,
  };
}

describe('GameState', () => {
  beforeEach(() => {
    GameState.resetForTests();
  });

  it('initializes singleton state from save data and keeps run state in sync', () => {
    const state = GameState.getInstance();
    const save = new SaveManager('game-state-defaults').createDefaultSaveData(1000);
    const run = createRun();
    const saveListener = vi.fn();
    const runListener = vi.fn();

    state.on('saveDataChanged', saveListener);
    state.on('runChanged', runListener);
    state.initialize({
      ...save,
      activeTournamentRun: run,
    });

    expect(GameState.getInstance()).toBe(state);
    expect(state.getSaveData()?.activeTournamentRun).toEqual(run);
    expect(state.getCurrentRun()).toEqual(run);

    state.updateRun((currentRun) => ({
      ...currentRun,
      runCoins: currentRun.runCoins + 30,
    }));

    expect(state.getCurrentRun()?.runCoins).toBe(50);
    expect(state.getSaveData()?.activeTournamentRun?.runCoins).toBe(50);
    expect(saveListener).toHaveBeenCalledTimes(2);
    expect(runListener).toHaveBeenCalledTimes(2);
  });

  it('applies immutable save updates and can clear the current run', () => {
    const state = GameState.getInstance();
    const originalSave = new SaveManager('game-state-updates').createDefaultSaveData(2000);
    const run = createRun();

    state.initialize({
      ...originalSave,
      activeTournamentRun: run,
    });

    state.updateSaveData((save) => ({
      ...save,
      currency: {
        ...save.currency,
        coins: save.currency.coins + 10,
      },
    }));

    const updatedSave = state.getSaveData();

    expect(updatedSave?.currency.coins).toBe(10);
    expect(originalSave.currency.coins).toBe(0);

    state.setCurrentRun(null);

    expect(state.getCurrentRun()).toBeNull();
    expect(state.getSaveData()?.activeTournamentRun).toBeUndefined();
  });
});
