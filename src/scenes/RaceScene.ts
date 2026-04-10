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
import type { ResultSceneData, SceneNavigationButton } from '@/types';

const FINISH_RACE_BUTTON: SceneNavigationButton = {
  label: '完成本场飞行',
  target: SCENE_KEYS.RESULT,
};

export class RaceScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.RACE);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 56, '比赛场景', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y - 24, 'RaceScene：Step 3/4 会在这里接入发射、飞行与计分', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    const airplane = this.add.triangle(GAME_CENTER_X, GAME_CENTER_Y + 12, 0, 12, 28, 0, 0, -12, 0xf8fafc);
    airplane.setStrokeStyle(2, 0x38bdf8);

    const finishButton = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 64, FINISH_RACE_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const finishRace = (): void => {
      const resultData: ResultSceneData = {
        distance: 120,
        flightTimeMs: 3600,
        summary: '原型流程验证完成，后续可在此接入真实比赛结果。',
      };

      this.scene.start(FINISH_RACE_BUTTON.target, resultData);
    };

    finishButton.on('pointerdown', finishRace);
    this.input.keyboard?.once('keydown-ENTER', finishRace);

    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 96, '点击按钮或按 Enter 进入 ResultScene', SCENE_HINT_STYLE)
      .setOrigin(0.5);
  }
}
