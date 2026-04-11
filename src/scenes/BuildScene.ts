import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_WIDTH,
  SCENE_BUTTON_STYLE,
  SCENE_HINT_STYLE,
  SCENE_KEYS,
  SCENE_SUBTITLE_STYLE,
  SCENE_TITLE_STYLE,
} from '@/config/constants';
import {
  calculateBuildPreview,
  equipPart,
  getCompatibleParts,
  getEquippedPartsList,
  sanitizeEquippedParts,
  unequipPart,
  type EquippedPartsBySlot,
} from '@/systems/BuildSystem';
import { getAirplanes, getParts, getWeatherPresets } from '@/systems/ContentLoader';
import { selectWeather } from '@/systems/WeatherSystem';
import type { Airplane, AirplaneStats, BuildSceneData, Part, PartSlot, SceneNavigationButton, Weather } from '@/types';

const START_RACE_BUTTON: SceneNavigationButton = {
  label: '出战',
  target: SCENE_KEYS.RACE,
};

const RETURN_TO_MENU_BUTTON: SceneNavigationButton = {
  label: '返回菜单',
  target: SCENE_KEYS.MAIN_MENU,
};

const PANEL_TEXT_STYLE = {
  ...SCENE_SUBTITLE_STYLE,
  backgroundColor: '#162033',
  fontSize: '10px',
  padding: {
    x: 5,
    y: 4,
  },
} as const;

const SELECTED_PANEL_TEXT_STYLE = {
  ...PANEL_TEXT_STYLE,
  backgroundColor: '#1d4ed8',
} as const;

const EQUIPPED_PANEL_TEXT_STYLE = {
  ...PANEL_TEXT_STYLE,
  backgroundColor: '#0f766e',
} as const;

const SLOT_LABELS: Record<PartSlot, string> = {
  nose: '机鼻',
  wing: '机翼',
  tail: '尾翼',
  coating: '涂层',
  weight: '配重',
};

const AIRPLANE_TYPE_LABELS = {
  speed: '速度型',
  trick: '特技型',
  stability: '稳定型',
} as const;

const STAT_ROWS: ReadonlyArray<{
  readonly key: keyof AirplaneStats;
  readonly label: string;
  readonly color: number;
}> = [
  { key: 'speed', label: '速度', color: 0x38bdf8 },
  { key: 'glide', label: '滑翔', color: 0x22c55e },
  { key: 'stability', label: '稳定', color: 0xf59e0b },
  { key: 'trick', label: '特技', color: 0xe879f9 },
  { key: 'durability', label: '耐久', color: 0xf97316 },
];

interface AirplaneEntry {
  readonly nameText: Phaser.GameObjects.Text;
  readonly statsText: Phaser.GameObjects.Text;
}

function formatStatsSummary(stats: AirplaneStats): string {
  return `速${stats.speed} 滑${stats.glide} 稳${stats.stability} 技${stats.trick} 耐${stats.durability}`;
}

function formatPartModifiers(part: Part): string {
  const modifiers = Object.entries(part.statModifiers).map(([statKey, value]) => {
    const prefix = value > 0 ? '+' : '';
    const label = STAT_ROWS.find((row) => row.key === statKey)?.label ?? statKey;
    return `${label}${prefix}${value}`;
  });

  return modifiers.join(' · ');
}

export class BuildScene extends Phaser.Scene {
  private readonly airplanes = getAirplanes();
  private readonly inventory = getParts();
  private selectedAirplaneIndex = 0;
  private weather!: Weather;
  private equippedParts: EquippedPartsBySlot = {};
  private airplaneEntries: AirplaneEntry[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private inventoryTexts: Phaser.GameObjects.Text[] = [];
  private weatherTitleText?: Phaser.GameObjects.Text;
  private weatherDescriptionText?: Phaser.GameObjects.Text;
  private previewTitleText?: Phaser.GameObjects.Text;
  private previewStatTexts: Phaser.GameObjects.Text[] = [];
  private statsGraphics?: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENE_KEYS.BUILD);
  }

  create(data?: BuildSceneData): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.selectedAirplaneIndex = this.resolveInitialAirplaneIndex(data?.airplaneId);
    this.weather = selectWeather(getWeatherPresets(), Date.now());
    this.equippedParts = {};

    this.add.text(GAME_WIDTH / 2, 18, '赛前构建', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        38,
        'Phase 1 · Step 4：选择机型、装配零件，并根据天气调整本场配置',
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5);

    this.add.text(22, 58, '机型列表', SCENE_SUBTITLE_STYLE);
    this.add.text(184, 58, '槽位装配', SCENE_SUBTITLE_STYLE);
    this.add.text(318, 58, '零件背包', SCENE_SUBTITLE_STYLE);

    this.createAirplaneEntries();
    this.weatherTitleText = this.add.text(22, 194, '', SCENE_SUBTITLE_STYLE);
    this.weatherDescriptionText = this.add.text(22, 210, '', SCENE_HINT_STYLE).setWordWrapWidth(160);
    this.previewTitleText = this.add.text(184, 194, '', SCENE_SUBTITLE_STYLE);
    this.previewStatTexts = STAT_ROWS.map((_, index) =>
      this.add.text(184, 210 + index * 10, '', SCENE_HINT_STYLE),
    );
    this.statsGraphics = this.add.graphics();

    const startButton = this.add
      .text(404, 236, START_RACE_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const returnButton = this.add
      .text(292, 236, RETURN_TO_MENU_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      this.launchRace();
    });
    returnButton.on('pointerdown', () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    });

    const handleEscape = () => {
      this.scene.start(RETURN_TO_MENU_BUTTON.target);
    };
    const handleEnter = () => {
      this.launchRace();
    };

    this.input.keyboard?.on('keydown-ESC', handleEscape);
    this.input.keyboard?.on('keydown-ENTER', handleEnter);
    const cleanupKeyboardListeners = () => {
      this.input.keyboard?.off('keydown-ESC', handleEscape);
      this.input.keyboard?.off('keydown-ENTER', handleEnter);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupKeyboardListeners);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupKeyboardListeners);

    this.add
      .text(
        GAME_WIDTH / 2,
        262,
        '移动端可直接点选机型、零件与“出战”；桌面端也可用 Enter 出战、Esc 返回',
        SCENE_HINT_STYLE,
      )
      .setOrigin(0.5, 1);

    this.refreshBuildView();
  }

  private createAirplaneEntries(): void {
    this.airplaneEntries = this.airplanes.map((airplane, index) => {
      const y = 78 + index * 34;
      const nameText = this.add
        .text(22, y, '', PANEL_TEXT_STYLE)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectAirplane(index));
      const statsText = this.add
        .text(22, y + 16, '', SCENE_HINT_STYLE)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectAirplane(index));

      nameText.setText(`${airplane.name} · ${AIRPLANE_TYPE_LABELS[airplane.type]}`);
      statsText.setText(formatStatsSummary(airplane.baseStats));

      return {
        nameText,
        statsText,
      };
    });
  }

  private getSelectedAirplane(): Airplane {
    return this.airplanes[this.selectedAirplaneIndex];
  }

  private resolveInitialAirplaneIndex(airplaneId: string | undefined): number {
    if (!airplaneId) {
      return 0;
    }

    const targetIndex = this.airplanes.findIndex((airplane) => airplane.id === airplaneId);
    return targetIndex >= 0 ? targetIndex : 0;
  }

  private selectAirplane(index: number): void {
    if (index === this.selectedAirplaneIndex) {
      return;
    }

    this.selectedAirplaneIndex = index;
    this.equippedParts = sanitizeEquippedParts(this.getSelectedAirplane(), this.equippedParts);
    this.refreshBuildView();
  }

  private refreshBuildView(): void {
    this.refreshAirplaneEntries();
    this.refreshSlotPanel();
    this.refreshInventoryPanel();
    this.refreshWeatherPanel();
    this.refreshStatsPreview();
  }

  private refreshAirplaneEntries(): void {
    this.airplaneEntries.forEach((entry, index) => {
      const isSelected = index === this.selectedAirplaneIndex;
      entry.nameText.setStyle(isSelected ? SELECTED_PANEL_TEXT_STYLE : PANEL_TEXT_STYLE);
      entry.statsText.setColor(isSelected ? '#e0f2fe' : SCENE_HINT_STYLE.color);
    });
  }

  private refreshSlotPanel(): void {
    for (const slotText of this.slotTexts) {
      slotText.destroy();
    }
    this.slotTexts = [];

    this.getSelectedAirplane().slots.forEach((slot, index) => {
      const equippedPart = this.equippedParts[slot];
      const slotText = this.add
        .text(
          184,
          78 + index * 22,
          equippedPart ? `${SLOT_LABELS[slot]}：${equippedPart.name}` : `${SLOT_LABELS[slot]}：空槽`,
          equippedPart ? EQUIPPED_PANEL_TEXT_STYLE : PANEL_TEXT_STYLE,
        )
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.equippedParts = unequipPart(this.equippedParts, slot);
          this.refreshBuildView();
        });

      this.slotTexts.push(slotText);
    });
  }

  private refreshInventoryPanel(): void {
    for (const inventoryText of this.inventoryTexts) {
      inventoryText.destroy();
    }
    this.inventoryTexts = [];

    getCompatibleParts(this.getSelectedAirplane(), this.inventory).forEach((part, index) => {
      const isEquipped = this.equippedParts[part.slot]?.id === part.id;
      const inventoryText = this.add
        .text(
          318,
          78 + index * 14,
          `${SLOT_LABELS[part.slot]}·${part.name} ${formatPartModifiers(part)}`,
          isEquipped ? EQUIPPED_PANEL_TEXT_STYLE : PANEL_TEXT_STYLE,
        )
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.equippedParts = equipPart(this.getSelectedAirplane(), this.equippedParts, part);
          this.refreshBuildView();
        });

      this.inventoryTexts.push(inventoryText);
    });
  }

  private refreshWeatherPanel(): void {
    this.weatherTitleText?.setText(`天气预告：${this.weather.displayName}`);
    this.weatherDescriptionText?.setText(this.weather.description);
  }

  private refreshStatsPreview(): void {
    const airplane = this.getSelectedAirplane();
    const previewStats = calculateBuildPreview(airplane, this.equippedParts);

    this.previewTitleText?.setText(`${airplane.name} · 实时属性预览`);
    this.statsGraphics?.clear();

    STAT_ROWS.forEach((row, index) => {
      const y = 212 + index * 10;
      const barWidth = previewStats[row.key] * 10;

      this.previewStatTexts[index]?.setText(`${row.label} ${previewStats[row.key]}`);
      this.statsGraphics?.fillStyle(0x1e293b, 1);
      this.statsGraphics?.fillRect(232, y, 104, 6);
      this.statsGraphics?.fillStyle(row.color, 1);
      this.statsGraphics?.fillRect(232, y, barWidth, 6);
    });
  }

  private launchRace(): void {
    const airplane = this.getSelectedAirplane();

    this.scene.start(START_RACE_BUTTON.target, {
      airplaneId: airplane.id,
      airplaneName: airplane.name,
      airplaneStats: calculateBuildPreview(airplane, this.equippedParts),
      equippedParts: getEquippedPartsList(this.equippedParts, airplane.slots),
      weather: this.weather,
    });
  }
}
