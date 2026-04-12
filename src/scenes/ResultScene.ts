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
import { claimRaceRewards } from '@/systems/TournamentSystem';
import type { RaceSceneData, ResultSceneData, Reward, SceneNavigationButton } from '@/types';

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

const REWARD_BUTTON_STYLE = {
  ...SCENE_BUTTON_STYLE,
  fontSize: '10px',
  padding: {
    x: 10,
    y: 6,
  },
} as const;

function formatRewardLabel(reward: Reward): string {
  if (reward.type === 'coins') {
    return `${typeof reward.value === 'number' ? reward.value : 0} 金币`;
  }

  if (reward.type === 'airplane_unlock') {
    return `解锁 ${String(reward.value)}`;
  }

  return typeof reward.value === 'object' && reward.value !== null && 'name' in reward.value
    ? String(reward.value.name)
    : String(reward.value);
}

function getResultHintText(data: ResultSceneData): string {
  if (data.nextTournamentRun) {
    return data.nextTournamentRun.status === 'in_progress'
      ? '点击“返回地图”继续当前进度，或返回主菜单结束本次 Run。'
      : '本次 Run 已结算完成，点击按钮返回主菜单。';
  }

  return data.replayData
    ? '点击按钮继续；移动端可直接轻触，桌面端也可用 Enter / Esc'
    : '当前结果不可重赛，请点击“返回菜单”继续；桌面端也可按 Esc';
}

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
    const hasTournamentFollowUp = data.nextTournamentRun !== undefined;
    const hasRewardOptions = hasTournamentFollowUp && (data.rewardOptions?.length ?? 0) > 0;
    const primaryButtonLabel = hasTournamentFollowUp
      ? hasRewardOptions
        ? '确认奖励'
        : data.nextTournamentRun.status === 'in_progress'
          ? '返回地图'
          : '完成 Run'
      : REPLAY_BUTTON.label;
    const primaryButtonY = hasRewardOptions ? GAME_CENTER_Y + 76 : GAME_CENTER_Y + 98;
    const rankingY = hasRewardOptions ? GAME_CENTER_Y + 48 : GAME_CENTER_Y + 62;
    const hintY = hasRewardOptions ? GAME_CENTER_Y + 96 : GAME_CENTER_Y + 128;
    let resolvedTournamentRun = data.nextTournamentRun;
    let selectedReward: Reward | undefined;
    let selectedRewardIndex = -1;
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
      .text(GAME_CENTER_X, rankingY, rankingLines.join('\n'), SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5)
      .setLineSpacing(hasRewardOptions ? 6 : 8);
    if (data.opponentResult && !hasRewardOptions) {
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
      .text(GAME_CENTER_X - 72, primaryButtonY, primaryButtonLabel, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const returnButton = this.add
      .text(GAME_CENTER_X + 72, primaryButtonY, RETURN_TO_MENU_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    if (!data.replayData && !hasTournamentFollowUp) {
      replayButton.disableInteractive();
      replayButton.setAlpha(0.45);
    }

    const hintText = this.add
      .text(
        GAME_CENTER_X,
        hintY,
        getResultHintText(data),
        SCENE_HINT_STYLE,
      )
      .setOrigin(0.5);

    const rewardButtons =
      hasRewardOptions && data.rewardOptions
        ? data.rewardOptions.map((reward, index) =>
            this.add
              .text(
                GAME_CENTER_X - 152 + index * 152,
                GAME_CENTER_Y + 114,
                `${reward.type === 'skill' ? '技能' : reward.type === 'part' ? '零件' : '金币'}\n${formatRewardLabel(reward)}`,
                REWARD_BUTTON_STYLE,
              )
              .setOrigin(0.5)
              .setAlign('center')
              .setInteractive({ useHandCursor: true })
              .on('pointerdown', () => {
                selectedReward = reward;
                selectedRewardIndex = index;
                resolvedTournamentRun = data.nextTournamentRun
                  ? claimRaceRewards(data.nextTournamentRun, reward, data.specialRewards)
                  : data.nextTournamentRun;
                hintText.setText(
                  `已选择奖励：${formatRewardLabel(reward)}${
                    data.specialRewards && data.specialRewards.length > 0
                      ? `；额外获得 ${data.specialRewards.map((item) => formatRewardLabel(item)).join('、')}`
                      : ''
                  }`,
                );
                rewardButtons.forEach((button, buttonIndex) => {
                  button.setAlpha(buttonIndex === selectedRewardIndex ? 1 : 0.55);
                });
              }),
          )
        : [];

    if (hasRewardOptions) {
      this.add.text(GAME_CENTER_X, GAME_CENTER_Y + 92, '胜利奖励三选一', SCENE_SUBTITLE_STYLE).setOrigin(0.5);
      if (data.specialRewards && data.specialRewards.length > 0) {
        this.add
          .text(
            GAME_CENTER_X,
            GAME_CENTER_Y + 16,
            `特殊奖励：${data.specialRewards.map((reward) => formatRewardLabel(reward)).join('、')}`,
            SCENE_HINT_STYLE,
          )
          .setOrigin(0.5);
      }
    }

    replayButton.on('pointerdown', () => {
      if (hasTournamentFollowUp) {
        if (hasRewardOptions && !selectedReward) {
          hintText.setText('请先在下方奖励面板中选择一项奖励。');
          return;
        }

        if (resolvedTournamentRun?.status === 'in_progress') {
          this.scene.start(SCENE_KEYS.TOURNAMENT_MAP, {
            run: resolvedTournamentRun,
            airplaneId: data.airplaneId,
          });
          return;
        }

        this.scene.start(RETURN_TO_MENU_BUTTON.target);
        return;
      }

      if (!this.tryReplay(data.replayData)) {
        hintText.setText(REPLAY_UNAVAILABLE_HINT);
      }
    });
    returnButton.on('pointerdown', () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    });

    this.input.keyboard?.once('keydown-ENTER', () => {
      if (hasTournamentFollowUp) {
        if (hasRewardOptions && !selectedReward) {
          hintText.setText('请先在下方奖励面板中选择一项奖励。');
          return;
        }

        if (resolvedTournamentRun?.status === 'in_progress') {
          this.scene.start(SCENE_KEYS.TOURNAMENT_MAP, {
            run: resolvedTournamentRun,
            airplaneId: data.airplaneId,
          });
          return;
        }

        this.scene.start(RETURN_TO_MENU_BUTTON.target);
        return;
      }

      if (!this.tryReplay(data.replayData)) {
        hintText.setText(REPLAY_UNAVAILABLE_HINT);
      }
    });
    this.input.keyboard?.once('keydown-ESC', () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    });
  }
}
