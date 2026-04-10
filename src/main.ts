import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_GRAVITY,
  GAME_HEIGHT,
  GAME_WIDTH,
  resolveMatterDebug,
} from '@/utils/gameSettings';

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
    scene: {
      create() {
        this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
      },
    },
  });
}

let game = createGame();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });

  import.meta.hot.accept(() => {
    game = createGame();
  });
}
