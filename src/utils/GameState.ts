import type { SaveData, TournamentRun } from '@/types';

type GameStateEventMap = {
  saveDataChanged: SaveData | null;
  runChanged: TournamentRun | null;
};

type GameStateListener<T> = (payload: T) => void;

export class GameState {
  private static instance: GameState | null = null;

  private currentSaveData: SaveData | null = null;
  private currentRun: TournamentRun | null = null;
  private readonly listeners: {
    [K in keyof GameStateEventMap]: Set<GameStateListener<GameStateEventMap[K]>>;
  } = {
    saveDataChanged: new Set(),
    runChanged: new Set(),
  };

  static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }

    return GameState.instance;
  }

  static resetForTests(): void {
    GameState.instance = null;
  }

  initialize(saveData: SaveData): void {
    const nextSaveData = cloneValue(saveData);
    const nextRun = cloneValue(saveData.activeTournamentRun ?? null);

    this.currentSaveData = nextSaveData;
    this.currentRun = nextRun;

    this.emit('saveDataChanged', this.currentSaveData);
    this.emit('runChanged', this.currentRun);
  }

  getSaveData(): SaveData | null {
    return cloneValue(this.currentSaveData);
  }

  getCurrentRun(): TournamentRun | null {
    return cloneValue(this.currentRun);
  }

  updateSaveData(updater: (prev: SaveData) => SaveData): void {
    if (!this.currentSaveData) {
      throw new Error('GameState has not been initialized');
    }

    const nextSaveData = cloneValue(updater(cloneValue(this.currentSaveData)));
    const nextRun = cloneValue(nextSaveData.activeTournamentRun ?? null);
    const runChanged = !isEqual(this.currentRun, nextRun);

    this.currentSaveData = nextSaveData;
    this.currentRun = nextRun;

    this.emit('saveDataChanged', this.currentSaveData);

    if (runChanged) {
      this.emit('runChanged', this.currentRun);
    }
  }

  updateRun(updater: (prev: TournamentRun) => TournamentRun): void {
    if (!this.currentRun || !this.currentSaveData) {
      throw new Error('GameState does not have an active tournament run');
    }

    const nextRun = cloneValue(updater(cloneValue(this.currentRun)));

    this.currentRun = nextRun;
    this.currentSaveData = {
      ...this.currentSaveData,
      activeTournamentRun: nextRun,
    };

    this.emit('saveDataChanged', this.currentSaveData);
    this.emit('runChanged', this.currentRun);
  }

  setCurrentRun(run: TournamentRun | null): void {
    if (!this.currentSaveData) {
      throw new Error('GameState has not been initialized');
    }

    this.currentRun = cloneValue(run);
    this.currentSaveData = this.currentRun
      ? {
          ...this.currentSaveData,
          activeTournamentRun: this.currentRun,
        }
      : removeActiveTournamentRun(this.currentSaveData);

    this.emit('saveDataChanged', this.currentSaveData);
    this.emit('runChanged', this.currentRun);
  }

  on<K extends keyof GameStateEventMap>(event: K, listener: GameStateListener<GameStateEventMap[K]>): () => void {
    this.listeners[event].add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  off<K extends keyof GameStateEventMap>(event: K, listener: GameStateListener<GameStateEventMap[K]>): void {
    this.listeners[event].delete(listener);
  }

  private emit<K extends keyof GameStateEventMap>(event: K, payload: GameStateEventMap[K]): void {
    for (const listener of this.listeners[event]) {
      listener(cloneValue(payload));
    }
  }
}

function removeActiveTournamentRun(saveData: SaveData): SaveData {
  const nextSaveData: Partial<SaveData> = { ...saveData };
  delete nextSaveData.activeTournamentRun;
  return nextSaveData as SaveData;
}

function isEqual(left: SaveData | TournamentRun | null, right: SaveData | TournamentRun | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
