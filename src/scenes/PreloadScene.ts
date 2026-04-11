import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  SCENE_KEYS,
  SCENE_SUBTITLE_STYLE,
  SCENE_TITLE_STYLE,
} from '@/config/constants';
import { PRELOAD_JSON_ASSETS } from '@/utils/scenePresentation';

export class PreloadScene extends Phaser.Scene {
  private progressText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private progressBar?: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 40, '加载资源中', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.progressText = this.add.text(GAME_CENTER_X, GAME_CENTER_Y - 12, '正在整理飞行资料 0%', SCENE_SUBTITLE_STYLE).setOrigin(0.5);
    this.hintText = this.add.text(GAME_CENTER_X, GAME_CENTER_Y + 34, '准备读取 JSON 数据文件', SCENE_SUBTITLE_STYLE).setOrigin(0.5);

    this.progressBar = this.add.rectangle(GAME_CENTER_X - 78, GAME_CENTER_Y + 10, 4, 10, 0x38bdf8);
    this.progressBar.setOrigin(0, 0.5);

    this.add.rectangle(GAME_CENTER_X, GAME_CENTER_Y + 10, 160, 14).setStrokeStyle(2, 0xe2e8f0);
    this.add.text(GAME_CENTER_X, GAME_CENTER_Y + 58, '飞机 / 零件 / 天气 / 对手档案即将入库', SCENE_SUBTITLE_STYLE).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      if (this.progressBar) {
        this.progressBar.width = Math.max(4, 156 * value);
      }
      this.progressText?.setText(`正在整理飞行资料 ${Math.round(value * 100)}%`);
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      const matchedAsset = PRELOAD_JSON_ASSETS.find((asset) => asset.key === file.key);
      this.hintText?.setText(`正在载入：${matchedAsset?.label ?? file.key}`);
    });

    this.load.once('complete', () => {
      if (this.progressBar) {
        this.progressBar.width = 156;
      }
      this.progressText?.setText('正在整理飞行资料 100%');
      this.hintText?.setText('数据装载完成，进入主菜单…');
    });

    for (const asset of PRELOAD_JSON_ASSETS) {
      this.load.json(asset.key, new URL(asset.relativePath, import.meta.url).href);
    }
  }

  create(): void {
    this.time.delayedCall(240, () => {
      this.scene.start(SCENE_KEYS.MAIN_MENU);
    });
  }
}
