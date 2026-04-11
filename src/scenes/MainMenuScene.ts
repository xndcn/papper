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
import type { Airplane, BuildSceneData, SceneNavigationButton } from '@/types';

const OPEN_BUILD_BUTTON: SceneNavigationButton = {
  label: '进入构建',
  target: SCENE_KEYS.BUILD,
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

    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 54, '主菜单', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
        .text(GAME_CENTER_X, GAME_CENTER_Y - 28, 'Phase 1 · Step 4：选择基础机型，再进入构建界面装配零件', SCENE_SUBTITLE_STYLE)
        .setOrigin(0.5);

    this.selectedAirplaneNameText = this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 2, '', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.selectedAirplaneStatsText = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 24, '', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    const previousButton = this.add
      .text(GAME_CENTER_X - 126, GAME_CENTER_Y - 2, '←', SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const nextButton = this.add
      .text(GAME_CENTER_X + 126, GAME_CENTER_Y - 2, '→', SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const startButton = this.add
      .text(GAME_CENTER_X, GAME_CENTER_Y + 62, OPEN_BUILD_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      this.scene.start(OPEN_BUILD_BUTTON.target, this.createBuildSceneData());
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
      this.scene.start(OPEN_BUILD_BUTTON.target, this.createBuildSceneData());
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
      .text(GAME_CENTER_X, GAME_CENTER_Y + 104, '点击箭头或按 ← / → 切换飞机，按 Enter 进入构建', SCENE_HINT_STYLE)
      .setOrigin(0.5);

    this.refreshSelection();
  }

  private createBuildSceneData(): BuildSceneData {
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
    this.selectedAirplaneStatsText?.setText(formatStatsLabel(airplane));
  }
}
