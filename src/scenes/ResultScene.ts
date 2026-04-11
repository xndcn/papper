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
import { calculateFlightScore } from '@/systems/RaceSystem';
import type { RaceSceneData, ResultSceneData, SceneNavigationButton } from '@/types';

const REPLAY_BUTTON: SceneNavigationButton = {
  label: '再来一局',
  target: SCENE_KEYS.RACE,
};
const REPLAY_UNAVAILABLE_HINT = '当前结果未保留重赛数据，请点击“返回菜单”返回主菜单';

const RETURN_TO_MENU_BUTTON: SceneNavigationButton = {
  label: '返回菜单',
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

  private tryReplay(replayData: RaceSceneData | undefined): boolean {
    if (!replayData) {
      return false;
    }

    this.scene.start(REPLAY_BUTTON.target, replayData);
    return true;
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
    const scoreBreakdown =
      data.scoreBreakdown ?? calculateFlightScore({ distancePx: data.distance, flightTimeMs: data.flightTimeMs });
    const rankingLines = rankings.map((entry, index) => {
      return `${index + 1}. ${entry.name} · ${entry.score} 分 · ${entry.distance}px · ${(entry.flightTimeMs / 1000).toFixed(1)}s`;
    });

    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 86, '比赛结算', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y - 58,
        `第 ${playerRank} 名 / 共 ${rankings.length} 人`,
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5);
    this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y - 28,
        `总分 ${data.score} · 距离分 ${scoreBreakdown.distanceScore} + 滞空分 ${scoreBreakdown.airtimeScore}`,
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5);
    this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y - 6,
        `飞行距离 ${data.distance}px · 滞空 ${(data.flightTimeMs / 1000).toFixed(1)}s`,
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5);
    this.add.text(GAME_CENTER_X, GAME_CENTER_Y + 20, data.summary, SCENE_SUBTITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 62, rankingLines.join('\n'), SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5)
      .setLineSpacing(8);
    if (data.opponentResult) {
      this.add
        .text(
          GAME_CENTER_X,
          GAME_CENTER_Y + 118,
          `对手 ${data.opponentResult.name} · ${data.opponentResult.title} · 发射角 ${data.opponentResult.launchAngleDegrees.toFixed(0)}° · 力度 ${(data.opponentResult.launchPower * 100).toFixed(0)}%`,
          SCENE_HINT_STYLE,
        )
        .setOrigin(0.5);
    }

    const replayButton = this.add
      .text(GAME_CENTER_X - 72, GAME_CENTER_Y + 98, REPLAY_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const returnButton = this.add
      .text(GAME_CENTER_X + 72, GAME_CENTER_Y + 98, RETURN_TO_MENU_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    if (!data.replayData) {
      replayButton.disableInteractive();
      replayButton.setAlpha(0.45);
    }

    const hintText = this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y + 128,
        data.replayData ? 'Enter 再来一局，Esc 返回主菜单，也可直接点击按钮' : '当前结果不可重赛，Esc 或点击“返回菜单”回到主菜单',
        SCENE_HINT_STYLE,
      )
      .setOrigin(0.5);

    replayButton.on('pointerdown', () => {
      if (!this.tryReplay(data.replayData)) {
        hintText.setText(REPLAY_UNAVAILABLE_HINT);
      }
    });
    returnButton.on('pointerdown', () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    });

    this.input.keyboard?.once('keydown-ENTER', () => {
      if (!this.tryReplay(data.replayData)) {
        hintText.setText(REPLAY_UNAVAILABLE_HINT);
      }
    });
    this.input.keyboard?.once('keydown-ESC', () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    });
  }
}
