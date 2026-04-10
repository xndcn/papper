import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  SCENE_BUTTON_STYLE,
  SCENE_HINT_STYLE,
  SCENE_KEYS,
  SCENE_SUBTITLE_STYLE,
  SCENE_TITLE_STYLE,
} from '@/config/constants';
import type { SceneNavigationButton } from '@/types';

const START_RACE_BUTTON: SceneNavigationButton = {
  label: '开始比赛',
  target: SCENE_KEYS.RACE,
};

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.MAIN_MENU);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 54, '主菜单', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y - 22, 'Step 2：Boot → Preload → MainMenu → Race → Result', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    const startButton = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 20, START_RACE_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      this.scene.start(START_RACE_BUTTON.target);
    });

    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.start(START_RACE_BUTTON.target);
    });

    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 58, '点击按钮或按 Enter 进入 RaceScene', SCENE_HINT_STYLE)
      .setOrigin(0.5);
  }
}
