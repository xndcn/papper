import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SaveManager } from '@/systems/SaveManager';
import { generateTournamentMap } from '@/systems/TournamentSystem';
import type { SaveData, TournamentRun } from '@/types';

function createRun(): TournamentRun {
  const map = generateTournamentMap(2026, 3);

  return {
    seed: map.seed,
    map,
    currentNodeId: '',
    visitedNodeIds: [],
    currentLayer: -1,
    collectedParts: [],
    activeBuffs: [],
    runCoins: 0,
    runSkills: [],
    raceResults: [],
    startedAt: 1000,
    status: 'in_progress',
  };
}

describe('SaveManager', () => {
  let manager: SaveManager;
  let databaseName: string;

  beforeEach(async () => {
    databaseName = `test_pwl_${crypto.randomUUID()}`;
    manager = new SaveManager(databaseName);
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.close();
    await Dexie.delete(databaseName);
  });

  it('creates default save data and persists saves, autosaves, and settings', async () => {
    const save = manager.createDefaultSaveData(123456);
    const manualSave: SaveData = {
      ...save,
      currency: {
        ...save.currency,
        coins: 88,
      },
      lastSavedAt: 123456,
    };
    const settings = {
      ...save.settings,
      bgmVolume: 0.6,
      accessibility: {
        ...save.settings.accessibility,
        reducedMotion: true,
      },
    };

    expect(await manager.hasSave()).toBe(false);
    expect(await manager.loadGame()).toBeNull();
    expect(await manager.loadSettings()).toBeNull();
    expect(save.unlockedAirplanes).toEqual(['classic_dart']);
    expect(save.equippedLoadout.airplaneId).toBe('classic_dart');

    await manager.saveGame(manualSave);
    await manager.saveSettings(settings);

    expect(await manager.hasSave()).toBe(true);
    expect(await manager.loadGame()).toEqual(manualSave);
    expect(await manager.loadSettings()).toEqual(settings);

    await manager.deleteSave();
    await manager.autoSave(manualSave);

    expect(await manager.hasSave()).toBe(true);
    expect(await manager.loadGame()).toEqual(manualSave);
  });

  it('exports and imports validated save data', async () => {
    const run = createRun();
    const save: SaveData = {
      ...manager.createDefaultSaveData(234567),
      activeTournamentRun: run,
      currency: {
        coins: 120,
        premiumTickets: 2,
      },
      lastSavedAt: 234567,
    };

    await manager.saveGame(save);

    const exported = await manager.exportSave();
    const imported = JSON.parse(exported) as SaveData;

    expect(imported.currency.coins).toBe(120);
    expect(imported.activeTournamentRun).toEqual(run);

    await manager.deleteSave();
    await manager.importSave(exported);

    expect(await manager.loadGame()).toEqual(save);
  });

  it('rejects invalid save payloads and unsupported imports', async () => {
    const save = manager.createDefaultSaveData(345678);

    await expect(
      manager.saveGame({
        ...save,
        version: 0,
      }),
    ).rejects.toThrowError(/version/i);
    await expect(
      manager.saveSettings({
        ...save.settings,
        masterVolume: 2,
      }),
    ).rejects.toThrowError(/masterVolume/i);
    await expect(manager.importSave('{')).rejects.toThrowError(/json/i);
    await expect(
      manager.importSave(
        JSON.stringify({
          ...save,
          version: 99,
        }),
      ),
    ).rejects.toThrowError(/version/i);
  });
});
