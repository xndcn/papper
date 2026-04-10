import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  SCENE_KEYS,
  SCENE_SUBTITLE_STYLE,
  SCENE_TITLE_STYLE,
} from '@/config/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 12, '纸翼传说', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 16, 'BootScene：初始化核心配置', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    this.time.delayedCall(250, () => {
      this.scene.start(SCENE_KEYS.PRELOAD);
    });
  }
}
