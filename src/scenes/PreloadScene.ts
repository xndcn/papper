import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  SCENE_KEYS,
  SCENE_SUBTITLE_STYLE,
  SCENE_TITLE_STYLE,
} from '@/config/constants';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 24, '加载资源中', SCENE_TITLE_STYLE).setOrigin(0.5);

    const progressBar = this.add.rectangle(GAME_CENTER_X - 80, GAME_CENTER_Y + 6, 0, 10, 0x38bdf8);
    progressBar.setOrigin(0, 0.5);

    this.add.rectangle(GAME_CENTER_X, GAME_CENTER_Y + 6, 160, 12).setStrokeStyle(2, 0xe2e8f0);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 28, 'PreloadScene：Step 2 场景框架占位加载', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    this.tweens.add({
      targets: progressBar,
      width: 160,
      duration: 300,
      ease: 'Linear',
      onComplete: () => {
        this.scene.start(SCENE_KEYS.MAIN_MENU);
      },
    });
  }
}
