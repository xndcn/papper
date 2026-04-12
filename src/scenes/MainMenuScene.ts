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
import { getAirplanes } from '@/systems/ContentLoader';
import { createTournamentRun } from '@/systems/TournamentSystem';
import type { Airplane, MainMenuSceneData, SceneNavigationButton } from '@/types';
import { persistGameState, ensureGameStateLoaded } from '@/utils/gamePersistence';
import { GameState } from '@/utils/GameState';

const OPEN_BUILD_BUTTON: SceneNavigationButton = {
  label: '读取存档中...',
  target: SCENE_KEYS.TOURNAMENT_MAP,
};

function formatStatsLabel(airplane: Airplane): string {
  const { speed, glide, stability, trick, durability } = airplane.baseStats;
  return `速度 ${speed} · 滑翔 ${glide} · 稳定 ${stability} · 特技 ${trick} · 耐久 ${durability}`;
}

export class MainMenuScene extends Phaser.Scene {
  private readonly airplanes = getAirplanes();
  private selectedAirplaneIndex = 0;
  private hasContinueRun = false;
  private isProcessingPrimaryAction = false;
  private selectedAirplaneNameText?: Phaser.GameObjects.Text;
  private selectedAirplaneStatsText?: Phaser.GameObjects.Text;
  private primaryActionButton?: Phaser.GameObjects.Text;
  private primaryActionHintText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.MAIN_MENU);
  }

  create(data?: MainMenuSceneData): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.createBackgroundAnimation();

    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 76, '纸翼传说', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y - 52, 'Paper Wings Legend · 调整纸翼，迎风启航', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);
    this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y - 30,
        '读取存档后可继续上次 Run，或从主菜单开始新的锦标赛挑战',
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5);

    this.selectedAirplaneNameText = this.add.text(GAME_CENTER_X, GAME_CENTER_Y + 4, '', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.selectedAirplaneStatsText = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 28, '', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    const previousButton = this.add
      .text(GAME_CENTER_X - 126, GAME_CENTER_Y + 4, '←', SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const nextButton = this.add
      .text(GAME_CENTER_X + 126, GAME_CENTER_Y + 4, '→', SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.primaryActionButton = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 72, OPEN_BUILD_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.primaryActionHintText = this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y + 96,
        data?.message ?? '正在检查本地存档与当前 Run 状态…',
        SCENE_HINT_STYLE,
      )
      .setOrigin(0.5);

    this.primaryActionButton.on('pointerdown', () => {
      void this.handlePrimaryAction();
    });
    previousButton.on('pointerdown', () => this.cycleAirplane(-1));
    nextButton.on('pointerdown', () => this.cycleAirplane(1));

    const handlePrevious = () => {
      this.cycleAirplane(-1);
    };
    const handleNext = () => {
      this.cycleAirplane(1);
    };
    const handleStart = () => {
      void this.handlePrimaryAction();
    };

    this.input.keyboard?.on('keydown-LEFT', handlePrevious);
    this.input.keyboard?.on('keydown-RIGHT', handleNext);
    this.input.keyboard?.on('keydown-ENTER', handleStart);
    const cleanupKeyboardListeners = () => {
      this.input.keyboard?.off('keydown-LEFT', handlePrevious);
      this.input.keyboard?.off('keydown-RIGHT', handleNext);
      this.input.keyboard?.off('keydown-ENTER', handleStart);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupKeyboardListeners);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupKeyboardListeners);

    this.add
      .text(
        GAME_CENTER_X,
        GAME_CENTER_Y + 112,
        '移动端可直接点击箭头与“开始锦标赛”；桌面端也可用 ← / → / Enter 快速操作',
        SCENE_HINT_STYLE,
      )
      .setOrigin(0.5);

    this.refreshSelection();
    void this.initializePrimaryAction();
  }

  private createBackgroundAnimation(): void {
    const planeConfigs = [
      { x: -40, y: 54, scale: 0.9, alpha: 0.24, duration: 7000 },
      { x: GAME_CENTER_X - 36, y: 104, scale: 0.7, alpha: 0.18, duration: 5600 },
      { x: GAME_CENTER_X + 84, y: 150, scale: 0.55, alpha: 0.14, duration: 4800 },
    ] as const;

    planeConfigs.forEach((config, index) => {
      const plane = this.add
        .triangle(config.x, config.y, 0, 10, 40, 0, 40, 20, 0xf8fafc, config.alpha)
        .setScale(config.scale)
        .setRotation(Phaser.Math.DegToRad(-12 + index * 8));

      this.tweens.add({
        targets: plane,
        x: GAME_CENTER_X + 300,
        y: config.y - 12 + index * 10,
        duration: config.duration,
        ease: 'Sine.InOut',
        repeat: -1,
        delay: index * 300,
        onRepeat: () => {
          plane.setPosition(-40, config.y);
        },
      });
    });
  }

  private async initializePrimaryAction(): Promise<void> {
    const saveData = await ensureGameStateLoaded();
    const activeRun = saveData.activeTournamentRun;

    this.selectedAirplaneIndex = this.resolveAirplaneIndex(saveData.equippedLoadout.airplaneId);
    this.hasContinueRun = activeRun?.status === 'in_progress';
    this.primaryActionButton?.setText(this.hasContinueRun ? '继续游戏' : '新游戏');
    this.primaryActionHintText?.setText(
      this.hasContinueRun
        ? '检测到进行中的锦标赛 Run，点击“继续游戏”可恢复到锦标赛地图。'
        : '未检测到进行中的 Run，点击“新游戏”会创建新的锦标赛进度并保存当前机型。',
    );
    this.refreshSelection();
  }

  private async handlePrimaryAction(): Promise<void> {
    if (this.isProcessingPrimaryAction) {
      return;
    }

    this.isProcessingPrimaryAction = true;
    this.primaryActionButton?.setAlpha(0.65);

    try {
      const saveData = await ensureGameStateLoaded();

      if (this.hasContinueRun && saveData.activeTournamentRun?.status === 'in_progress') {
        this.scene.start(OPEN_BUILD_BUTTON.target, {
          run: saveData.activeTournamentRun,
          airplaneId: saveData.equippedLoadout.airplaneId,
          message: '已恢复上次 Run 进度，继续选择下一条路径。',
        });
        return;
      }

      const tournamentRun = createTournamentRun(Date.now());
      const airplane = this.airplanes[this.selectedAirplaneIndex];
      GameState.getInstance().updateSaveData((currentSaveData) => ({
        ...currentSaveData,
        equippedLoadout: {
          ...currentSaveData.equippedLoadout,
          airplaneId: airplane.id,
        },
        activeTournamentRun: tournamentRun,
        lastSavedAt: Date.now(),
      }));
      await persistGameState();

      this.scene.start(OPEN_BUILD_BUTTON.target, {
        run: tournamentRun,
        airplaneId: airplane.id,
        message: '新的锦标赛 Run 已开始，先在地图中选择本轮前进路线。',
      });
    } finally {
      this.isProcessingPrimaryAction = false;
      this.primaryActionButton?.setAlpha(1);
    }
  }

  private cycleAirplane(direction: -1 | 1): void {
    this.selectedAirplaneIndex =
      (this.selectedAirplaneIndex + direction + this.airplanes.length) % this.airplanes.length;
    this.refreshSelection();
  }

  private resolveAirplaneIndex(airplaneId: string | undefined): number {
    if (!airplaneId) {
      return 0;
    }

    const resolvedIndex = this.airplanes.findIndex((airplane) => airplane.id === airplaneId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }

  private refreshSelection(): void {
    const airplane = this.airplanes[this.selectedAirplaneIndex];

    this.selectedAirplaneNameText?.setText(airplane.name);
    this.selectedAirplaneStatsText?.setText(`${airplane.description}\n${formatStatsLabel(airplane)}`);
  }
}
