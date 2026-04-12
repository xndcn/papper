import { SaveManager } from '@/systems/SaveManager';
import type { SaveData } from '@/types';
import { GameState } from '@/utils/GameState';

const saveManager = new SaveManager();
let loadPromise: Promise<SaveData> | null = null;

export async function ensureGameStateLoaded(): Promise<SaveData> {
  const existingSaveData = GameState.getInstance().getSaveData();

  if (existingSaveData) {
    return existingSaveData;
  }

  loadPromise ??= loadInitialSaveData();
  return loadPromise;
}

export async function persistGameState(options: { readonly auto?: boolean } = {}): Promise<SaveData> {
  const saveData = GameState.getInstance().getSaveData();

  if (!saveData) {
    throw new Error('GameState has not been initialized');
  }

  await saveManager.initialize();

  if (options.auto) {
    if (saveData.settings.autoSave) {
      await saveManager.autoSave(saveData);
    }
  } else {
    await saveManager.saveGame(saveData);
  }

  return saveData;
}

async function loadInitialSaveData(): Promise<SaveData> {
  await saveManager.initialize();

  const loadedSaveData = await saveManager.loadGame();
  const resolvedSaveData = loadedSaveData ?? saveManager.createDefaultSaveData();
  GameState.getInstance().initialize(resolvedSaveData);

  return resolvedSaveData;
}
