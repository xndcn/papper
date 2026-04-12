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
import type { Airplane, SceneNavigationButton, TournamentMapSceneData } from '@/types';

const OPEN_BUILD_BUTTON: SceneNavigationButton = {
  label: '开始锦标赛',
  target: SCENE_KEYS.TOURNAMENT_MAP,
};

function formatStatsLabel(airplane: Airplane): string {
  const { speed, glide, stability, trick, durability } = airplane.baseStats;
  return `速度 ${speed} · 滑翔 ${glide} · 稳定 ${stability} · 特技 ${trick} · 耐久 ${durability}`;
}

export class MainMenuScene extends Phaser.Scene {
  private readonly airplanes = getAirplanes();
  private selectedAirplaneIndex = 0;
  private selectedAirplaneNameText?: Phaser.GameObjects.Text;
  private selectedAirplaneStatsText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.MAIN_MENU);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.createBackgroundAnimation();

    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 76, '纸翼传说', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y - 52, 'Paper Wings Legend · 调整纸翼，迎风启航', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);
    this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y - 30, '选择基础机型后进入锦标赛地图，逐层挑战对手并推进本次 Run', SCENE_SUBTITLE_STYLE)
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

    const startButton = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 72, OPEN_BUILD_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      this.scene.start(OPEN_BUILD_BUTTON.target, this.createTournamentMapSceneData());
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
      this.scene.start(OPEN_BUILD_BUTTON.target, this.createTournamentMapSceneData());
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

  private createTournamentMapSceneData(): TournamentMapSceneData {
    const airplane = this.airplanes[this.selectedAirplaneIndex];

    return {
      airplaneId: airplane.id,
    };
  }

  private cycleAirplane(direction: -1 | 1): void {
    this.selectedAirplaneIndex =
      (this.selectedAirplaneIndex + direction + this.airplanes.length) % this.airplanes.length;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    const airplane = this.airplanes[this.selectedAirplaneIndex];

    this.selectedAirplaneNameText?.setText(airplane.name);
    this.selectedAirplaneStatsText?.setText(`${airplane.description}\n${formatStatsLabel(airplane)}`);
  }
}
