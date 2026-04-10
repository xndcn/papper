import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_GRAVITY,
  GAME_HEIGHT,
  GAME_WIDTH,
  resolveMatterDebug,
} from '@/utils/gameSettings';
import { CORE_SCENES } from '@/scenes';

declare global {
  interface Window {
    __PAPPER_GAME__?: Phaser.Game;
  }
}

function syncGameReference(game: Phaser.Game | undefined): void {
  window.__PAPPER_GAME__ = game;
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

let game = createGame();
syncGameReference(game);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    syncGameReference(undefined);
    game.destroy(true);
  });

  import.meta.hot.accept(() => {
    game = createGame();
    syncGameReference(game);
  });
}
