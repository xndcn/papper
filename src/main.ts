import '@fontsource/noto-sans-sc/chinese-simplified-400.css';

import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_GRAVITY,
  GAME_HEIGHT,
  GAME_WIDTH,
  resolveMatterDebug,
} from '@/utils/gameSettings';
import { CORE_SCENES } from '@/scenes';

const FONT_LOAD_TIMEOUT_MS = 2000;

declare global {
  interface Window {
    __PAPER_GAME__?: Phaser.Game;
  }
}

function syncGameReference(game: Phaser.Game | undefined): void {
  window.__PAPER_GAME__ = game;
}

async function waitForSceneFont(): Promise<void> {
  if (!('fonts' in document)) {
    return;
  }

  try {
    await Promise.race([
      document.fonts.load(`16px "Noto Sans SC"`),
      new Promise((resolve) => {
        window.setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Fall back to system fonts if the bundled web font fails to initialize.
  }
}

function createGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: GAME_BACKGROUND_COLOR,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: 'matter',
      matter: {
        gravity: GAME_GRAVITY,
        debug: resolveMatterDebug(import.meta.env.DEV),
      },
    },
    scene: CORE_SCENES,
  });
}

let game: Phaser.Game | undefined;

async function bootstrapGame(): Promise<void> {
  await waitForSceneFont();
  game = createGame();
  syncGameReference(game);
}

void bootstrapGame();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    syncGameReference(undefined);
    game?.destroy(true);
  });

  import.meta.hot.accept(async () => {
    await waitForSceneFont();
    game = createGame();
    syncGameReference(game);
  });
}
