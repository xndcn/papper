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

const RETURN_TO_MENU_BUTTON: SceneNavigationButton = {
  label: '返回主菜单',
  target: SCENE_KEYS.MAIN_MENU,
};

const DEFAULT_RESULT_DATA: ResultSceneData = {
  distance: 0,
  flightTimeMs: 0,
  score: 0,
  summary: '尚未生成比赛结果。',
};

export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.RESULT);
  }

  create(data: ResultSceneData = DEFAULT_RESULT_DATA): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    const rankings = data.rankings ?? [
      {
        name: data.playerName ?? '你',
        distance: data.distance,
        flightTimeMs: data.flightTimeMs,
        score: data.score,
        isPlayer: true,
      },
    ];
    const playerRank = rankings.findIndex((entry) => entry.isPlayer) + 1;
    const rankingLines = rankings.map((entry, index) => {
      return `${index + 1}. ${entry.name} · ${entry.score} 分 · ${entry.distance}px · ${(entry.flightTimeMs / 1000).toFixed(1)}s`;
    });

    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 76, '比赛结算', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y - 50,
        `排名 ${playerRank}/${rankings.length} · 总分 ${data.score} · 飞行距离 ${data.distance}px · 滞空 ${(data.flightTimeMs / 1000).toFixed(1)}s`,
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5);
    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 18, data.summary, SCENE_SUBTITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 18, rankingLines.join('\n'), SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5)
      .setLineSpacing(8);
    if (data.opponentResult) {
      this.add
        .text(
          GAME_CENTER_X,
          GAME_CENTER_Y + 76,
          `对手 ${data.opponentResult.name} · ${data.opponentResult.title} · 发射角 ${data.opponentResult.launchAngleDegrees.toFixed(0)}° · 力度 ${(data.opponentResult.launchPower * 100).toFixed(0)}%`,
          SCENE_HINT_STYLE,
        )
        .setOrigin(0.5);
    }

    const returnButton = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 96, RETURN_TO_MENU_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    returnButton.on('pointerdown', () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    });

    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    });

    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 122, '点击按钮或按 Enter 回到 MainMenuScene', SCENE_HINT_STYLE)
      .setOrigin(0.5);
  }
}
