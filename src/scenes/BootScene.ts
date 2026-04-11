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

    const logo = this.add.graphics();
    logo.fillStyle(0xf8fafc, 1);
    logo.lineStyle(2, 0x38bdf8, 1);
    logo.beginPath();
    logo.moveTo(GAME_CENTER_X - 36, GAME_CENTER_Y - 34);
    logo.lineTo(GAME_CENTER_X + 18, GAME_CENTER_Y - 52);
    logo.lineTo(GAME_CENTER_X + 8, GAME_CENTER_Y - 8);
    logo.closePath();
    logo.fillPath();
    logo.strokePath();
    logo.fillStyle(0x38bdf8, 1);
    logo.fillCircle(GAME_CENTER_X - 42, GAME_CENTER_Y - 24, 4);

    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 4, '纸翼传说', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 18, 'Paper Wings Legend · Phase 1 MVP', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    const loadingText = this.add.text(GAME_CENTER_X, GAME_CENTER_Y + 46, '整理纸翼档案中', SCENE_SUBTITLE_STYLE).setOrigin(0.5);
    this.tweens.addCounter({
      from: 0,
      to: 3,
      duration: 500,
      repeat: -1,
      onUpdate: (tween) => {
        const dotCount = Math.round(tween.getValue());
        loadingText.setText(`整理纸翼档案中${'.'.repeat(dotCount)}`);
      },
    });

    this.time.delayedCall(650, () => {
      this.scene.start(SCENE_KEYS.PRELOAD);
    });
  }
}
