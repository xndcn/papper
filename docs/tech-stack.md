# 纸翼传说 - 技术选型参考

> 2D 像素风 Roguelike 纸飞机竞速游戏
>
> 目标平台：Web (PWA) / 移动端浏览器 / 桌面浏览器
>
> 最后更新：2026-04-07

---

## 目录

1. [游戏框架选型对比](#1-游戏框架选型对比)
2. [选择 Phaser 的理由](#2-选择-phaser-的理由)
3. [TypeScript + Vite 配置要点](#3-typescript--vite-配置要点)
4. [物理引擎选型](#4-物理引擎选型)
5. [存储方案](#5-存储方案)
6. [PWA 配置要点](#6-pwa-配置要点)
7. [静态部署方案](#7-静态部署方案)
8. [LLM 集成方案](#8-llm-集成方案)
9. [美术工具链](#9-美术工具链)
10. [性能预算](#10-性能预算)

---

## 1. 游戏框架选型对比

以下是我们评估过的主流 2D 游戏框架，重点关注在浏览器中实现像素风 Roguelike 竞速游戏的适配性。

| 维度 | Phaser 3/4 (JS) | Excalibur.js (TS) | Kaplay/Kaboom (JS) | macroquad (Rust/WASM) | Bevy (Rust/WASM) | Godot 4 Web (GDScript/WASM) |
|------|-----------------|-------------------|--------------------|-----------------------|-------------------|----------------------------|
| **Bundle Size (gzip)** | ~180KB | ~80KB | ~70KB | ~200KB (WASM) | ~2-5MB (WASM) | ~30-50MB (WASM) |
| **移动端支持** | 优秀，内置触控/手势/全屏 API | 良好，基本触控支持 | 良好，触控事件简洁 | 一般，需手动处理触控 | 实验性，移动端 WASM 不稳定 | 良好，但 WASM 体积过大 |
| **像素风渲染** | 优秀，内置 `pixelArt: true`，支持 Aseprite 直接导入 | 良好，需手动配置抗锯齿 | 良好，默认像素风友好 | 良好，需手动设置 nearest filter | 良好，需配置渲染管线 | 优秀，编辑器内置像素风预设 |
| **Tilemap 支持** | 优秀，原生 Tiled JSON/TMX 支持 | 基础，需要插件或手动解析 | 基础，内置简单 tilemap | 无内置，需第三方库 | 需 bevy_ecs_tilemap 插件 | 优秀，编辑器内置 TileMap 节点 |
| **物理引擎** | 优秀，内置 Arcade + Matter.js，可接 Box2D 插件 | 内置基础碰撞检测 | 内置简单碰撞系统 | 无内置，需接 rapier2d | 可接 bevy_rapier2d | 内置 Godot Physics 2D |
| **社区规模** | 最大，38.8K+ GitHub Stars，教程/插件丰富 | 中等，1.7K+ Stars | 中等，4K+ Stars | 小众，3K+ Stars | 大型但 Web 方向小众，30K+ Stars | 大型但 Web 导出为次要目标，90K+ Stars |
| **学习曲线** | 中等，API 文档完善 | 低，TypeScript 原生，API 直觉化 | 低，API 极简 | 高，需掌握 Rust + WASM 工具链 | 很高，Rust + ECS 架构 + WASM | 中等，但 Web 导出调试困难 |

### 框架简评

- **Phaser 3/4**：HTML5 游戏开发的事实标准，生态最完善，物理引擎选项最多，像素风和 Tilemap 支持一流。Phaser 4 正在开发中，架构更现代化。
- **Excalibur.js**：TypeScript 原生框架，类型安全极好，但生态和社区不如 Phaser，物理引擎能力偏弱。
- **Kaplay/Kaboom**：API 极简易上手，适合 Game Jam，但功能深度不足以支撑复杂 Roguelike 系统。
- **macroquad**：Rust 框架，性能极好，但 Web 端工具链复杂，移动端支持需大量手动工作。
- **Bevy**：Rust 生态最先进的 ECS 游戏引擎，但 WASM 产物体积过大（2-5MB），移动端浏览器兼容性存疑。
- **Godot 4 Web**：编辑器功能强大，但 Web 导出的 WASM 体积在 30-50MB，完全不适合 PWA 场景。

---

## 2. 选择 Phaser 的理由

> **已确认选择 Phaser 3**（v3.87+）。不预留 Phaser 4 升级抽象层——等 Phaser 4 正式稳定后再评估迁移路径。

综合评估后，**Phaser 3**（并关注 Phaser 4 升级路径）是本项目的最终选择。理由如下：

### 2.1 极致的 Bundle Size

- Phaser 3 核心 gzip 后 **< 200KB**，满足 PWA 对首屏加载的严格要求
- 相比 Godot Web（30-50MB）或 Bevy WASM（2-5MB），在移动网络下优势巨大
- 配合 Vite 的 tree-shaking 和代码分割，实际加载量可进一步优化

### 2.2 内置 3 种物理引擎

- **Arcade Physics**：轻量级，适合简单的 AABB 碰撞检测
- **Matter.js**：功能完整的 2D 刚体物理引擎，支持多边形碰撞、关节约束、摩擦力/空气阻力模拟，**非常适合纸飞机的飞行物理模拟**
- **Box2D 插件**：通过社区插件可接入 Box2D，提供工业级物理精度
- Matter.js 的关节系统可以模拟纸飞机的折翼效果，摩擦力参数可以模拟不同纸张材质的空气动力学特性

### 2.3 一流的像素风渲染

- 全局配置 `pixelArt: true` 即可启用 nearest-neighbor 插值，无模糊
- 原生支持 **Aseprite** 动画文件直接导入（JSON + spritesheet）
- 内置 sprite 动画系统，支持帧动画、骨骼动画
- 支持自定义渲染管线和 shader，方便后续添加像素风特效（CRT滤镜、像素化爆炸等）

### 2.4 一流的 Tilemap 支持

- 原生支持 **Tiled Map Editor** 导出的 JSON/TMX 格式
- 支持多图层、对象层、碰撞层
- 内置 tilemap 碰撞检测，与 Arcade/Matter.js 物理引擎无缝集成
- 支持动态 tilemap 修改（适合 Roguelike 的程序化关卡生成）

### 2.5 最大的 HTML5 游戏社区

- GitHub **38.8K+ Stars**，是最流行的 HTML5 游戏框架
- 海量教程、示例代码、开源项目可供参考
- 活跃的 Discord 社区和论坛，问题响应迅速
- 丰富的第三方插件生态：UI 系统、寻路、对话系统、存档管理等

### 2.6 官方 Vite 模板

- 官方提供 `phaser3-vite-template`，开箱即用
- 预配置 HMR 热重载、asset 管线、TypeScript 支持
- 与现代前端工具链无缝集成（ESLint, Prettier, Vitest 等）

### 2.7 已有纸飞机滑翔 Demo

- 社区中已有基于 Phaser + Matter.js 的纸飞机滑翔物理模拟 demo
- 可直接参考其空气动力学参数和物理配置
- 大幅降低飞行系统的原型开发风险

---

## 3. TypeScript + Vite 配置要点

### 3.1 tsconfig.json 严格模式

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,                    // 启用全部严格检查
    "noUncheckedIndexedAccess": true,  // 索引访问返回 T | undefined
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/scenes/*": ["src/scenes/*"],
      "@/entities/*": ["src/entities/*"],
      "@/systems/*": ["src/systems/*"],
      "@/assets/*": ["src/assets/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.2 Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    VitePWA({ /* 见 PWA 配置章节 */ }),
  ],
  build: {
    target: 'ES2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // 生产环境移除 console.log
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],  // Phaser 单独分包，利用浏览器缓存
        },
      },
    },
    assetsInlineLimit: 0,  // 禁止内联资源，像素图不应被 base64 编码
  },
  // 像素风渲染关键配置：确保图片不被压缩或转换
  assetsInclude: ['**/*.aseprite', '**/*.tmj', '**/*.tsx'],
});
```

### 3.3 Phaser 像素风渲染配置

```typescript
// src/main.ts
import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  pixelArt: true,           // 全局启用 nearest-neighbor 插值
  antialias: false,          // 关闭抗锯齿
  roundPixels: true,         // 渲染时对齐像素网格，避免亚像素模糊
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,              // 像素风基础分辨率（配合 32x32 tiles）
    height: 270,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0.5 },  // 纸飞机低重力，提供更好滑翔手感
      debug: import.meta.env.DEV, // 开发环境显示物理调试线
    },
  },
  // ...scenes
};
```

### 3.4 HMR 热重载配置

Phaser 的场景系统与 Vite HMR 需要特殊处理：

```typescript
// src/main.ts
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // 销毁当前 Phaser 实例，避免重复创建
    game.destroy(true);
  });
  import.meta.hot.accept(() => {
    // HMR 更新时重新创建游戏实例
    window.location.reload();
  });
}
```

> **注意**：Phaser 场景级别的 HMR 较难实现完美热替换，建议在开发时使用场景重启而非完整 HMR。对于非场景模块（工具函数、数据配置等），Vite 的 HMR 可以正常工作。

### 3.5 Path Aliases

通过 `vite-tsconfig-paths` 插件，`tsconfig.json` 中定义的 `paths` 会自动映射到 Vite 的 `resolve.alias`，无需重复配置。

推荐的项目目录结构：

```
src/
├── main.ts              # 入口文件，Phaser 配置
├── scenes/              # 游戏场景
│   ├── BootScene.ts
│   ├── MenuScene.ts
│   ├── RaceScene.ts
│   └── ShopScene.ts
├── entities/            # 游戏实体
│   ├── PaperPlane.ts
│   ├── Obstacle.ts
│   └── PowerUp.ts
├── systems/             # 游戏系统（物理、AI、关卡生成等）
│   ├── FlightPhysics.ts
│   ├── LevelGenerator.ts
│   └── WeatherSystem.ts
├── ui/                  # UI 组件
├── data/                # 游戏数据（JSON 配置）
├── assets/              # 静态资源
│   ├── sprites/
│   ├── tilemaps/
│   ├── audio/
│   └── fonts/
└── utils/               # 工具函数
```

---

## 4. 物理引擎选型

纸飞机竞速游戏的核心体验依赖于飞行手感，物理引擎的选择至关重要。

### 4.1 Arcade Physics

| 特性 | 说明 |
|------|------|
| 类型 | 轻量级 AABB 碰撞检测 |
| 适用场景 | 简单的平台跳跃、弹幕游戏 |
| 优势 | 极高性能，零配置开箱即用 |
| 劣势 | 不支持多边形碰撞、无关节系统、无真实摩擦力模拟 |

**结论**：Arcade Physics 过于简单，无法模拟纸飞机的空气动力学特性。

### 4.2 Matter.js（我们的选择）

| 特性 | 说明 |
|------|------|
| 类型 | 功能完整的 2D 刚体物理引擎 |
| 适用场景 | 需要真实物理模拟的游戏 |
| 优势 | 多边形碰撞、关节约束、摩擦力、空气阻力、刚体旋转 |
| 性能 | 中等，适合同屏 50-100 个物理体 |
| Bundle Size | ~50KB gzip（Phaser 已内置，无额外体积） |

**为什么选择 Matter.js 模拟纸飞机飞行**：

1. **空气阻力模拟**：通过 `frictionAir` 参数模拟不同纸张材质的空气动力学特性
2. **力与扭矩**：`applyForce()` 和 `setAngularVelocity()` 可精确控制纸飞机的推力和旋转
3. **关节系统（Constraints）**：可以用弹簧关节模拟纸飞机的柔性折翼效果
4. **碰撞回调**：完善的碰撞事件系统，支持实现各类道具拾取、障碍物碰撞反馈
5. **与 Phaser 深度集成**：Phaser 对 Matter.js 的封装非常完善，MatterPhysics 模块提供了便捷的 API

```typescript
// 纸飞机飞行物理示例
const plane = this.matter.add.sprite(x, y, 'paper-plane', undefined, {
  shape: { type: 'fromVertices', verts: planeVertices },
  frictionAir: 0.02,    // 空气阻力（不同纸张材质可调）
  friction: 0.1,        // 表面摩擦力
  restitution: 0.3,     // 弹性系数
  density: 0.001,       // 密度（纸飞机很轻）
});

// 施加推力（模拟投掷/助推）
plane.applyForce({ x: thrustX, y: thrustY });

// 模拟升力（根据速度和攻角计算）
const velocity = plane.body.velocity;
const angle = plane.body.angle;
const liftForce = calculateLift(velocity, angle);
plane.applyForce(liftForce);
```

### 4.3 Rapier（可选未来升级路径）

| 特性 | 说明 |
|------|------|
| 类型 | Rust 编写的高性能 2D/3D 物理引擎，通过 WASM 运行 |
| 性能 | 比 Matter.js 快 5-10 倍 |
| Bundle Size | ~200KB gzip (WASM) |
| Phaser 集成 | Phaser 4 计划提供官方 Rapier 插件 |

**升级考虑**：

- 如果后续需要更复杂的物理模拟（大量碎片、布料模拟等），可考虑迁移到 Rapier
- Phaser 4 发布后评估官方 Rapier 插件的稳定性
- Matter.js 的 API 与 Rapier 的 JS bindings 差异较大，迁移需要重构物理层

**当前策略**：先用 Matter.js 快速原型验证飞行手感，保持物理系统的抽象层，为未来可能的引擎切换预留接口。

---

## 5. 存储方案

浏览器端游戏的存储需求与传统 Web 应用不同，需要处理较大的结构化游戏存档数据。

### 5.1 IndexedDB —— 游戏存档（主存储）

IndexedDB 是浏览器端唯一适合存储大量结构化数据的方案。直接使用 IndexedDB API 较为繁琐，推荐使用封装库。

**推荐方案对比**：

| 库 | 大小 (gzip) | API 风格 | 特点 |
|----|-------------|---------|------|
| **localForage** | ~3KB | Promise, 类 localStorage | 简单易用，自动降级 |
| **Dexie.js** | ~15KB | Promise, 类 ORM | 功能强大，支持索引/查询/版本迁移 |
| **idb** | ~1KB | Promise, 原生封装 | 最轻量，仅简化原生 API |

**推荐使用 Dexie.js**，原因：

1. 游戏存档可能包含复杂结构（角色数据、解锁记录、关卡进度、物品清单）
2. 需要版本迁移能力（游戏更新后存档结构可能变化）
3. 索引查询能力对排行榜、历史记录等功能有帮助

```typescript
// src/storage/GameDatabase.ts
import Dexie, { type Table } from 'dexie';

interface SaveData {
  id: string;
  playerName: string;
  level: number;
  coins: number;
  unlockedPlanes: string[];
  upgrades: Record<string, number>;
  timestamp: number;
}

interface RunHistory {
  id: string;
  saveId: string;
  score: number;
  distance: number;
  level: string;
  timestamp: number;
}

class GameDatabase extends Dexie {
  saves!: Table<SaveData>;
  history!: Table<RunHistory>;

  constructor() {
    super('PaperWingsLegend');
    this.version(1).stores({
      saves: 'id, playerName, timestamp',
      history: 'id, saveId, score, timestamp',
    });
  }
}

export const db = new GameDatabase();
```

### 5.2 Cache API + Service Worker —— 静态资源离线缓存

使用 Service Worker 的 Cache API 缓存游戏的静态资源（精灵图、音频、tilemap 数据等），实现离线可玩。

- 精灵图集（spritesheet）和 tilemap JSON 文件使用 **Cache First** 策略
- 游戏逻辑 JS/CSS 使用 **Stale While Revalidate** 策略
- 具体实现见 [PWA 配置要点](#6-pwa-配置要点) 章节

### 5.3 localStorage —— 仅用于简单设置项

localStorage 的容量限制（通常 5-10MB）和同步阻塞特性使其不适合存储游戏存档。

**仅用于**：

- 音量设置
- 语言偏好
- 是否首次启动
- 简单的开关型设置

```typescript
// src/storage/settings.ts
interface GameSettings {
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly language: 'zh' | 'en';
  readonly showFps: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  language: 'zh',
  showFps: false,
};

export function loadSettings(): GameSettings {
  const raw = localStorage.getItem('game-settings');
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem('game-settings', JSON.stringify(settings));
}
```

---

## 6. PWA 配置要点

将游戏封装为 PWA 可以实现"安装到主屏幕"和离线游玩体验。

### 6.1 vite-plugin-pwa 配置

```typescript
// vite.config.ts 中的 PWA 插件配置
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: [
    'favicon.ico',
    'apple-touch-icon.png',
    'mask-icon.svg',
  ],
  manifest: {
    name: '纸翼传说 - Paper Wings Legend',
    short_name: '纸翼传说',
    description: '2D 像素风 Roguelike 纸飞机竞速游戏',
    theme_color: '#1a1a2e',
    background_color: '#1a1a2e',
    display: 'fullscreen',
    orientation: 'landscape',     // 横屏优先（竞速游戏）
    categories: ['games'],
    icons: [
      {
        src: 'icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: 'screenshots/gameplay.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: '游戏画面',
      },
    ],
  },
  workbox: {
    // 预缓存：游戏核心资源
    globPatterns: [
      '**/*.{js,css,html}',
      '**/*.{png,jpg,webp,json,tmj}',
      '**/*.{mp3,ogg,wav}',
    ],
    // 运行时缓存策略
    runtimeCaching: [
      {
        // 精灵图和 tilemap：Cache First（不常更新）
        urlPattern: /\.(?:png|jpg|webp|json|tmj)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'game-assets',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
          },
        },
      },
      {
        // 音频资源：Cache First
        urlPattern: /\.(?:mp3|ogg|wav)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'audio-assets',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
    ],
  },
})
```

### 6.2 manifest.json 关键配置说明

| 字段 | 值 | 说明 |
|------|----|------|
| `display` | `fullscreen` | 全屏模式，隐藏浏览器 UI，提供沉浸式游戏体验 |
| `orientation` | `landscape` | 横屏模式，纸飞机竞速游戏的最佳体验方向 |
| `theme_color` | `#1a1a2e` | 深色主题，与像素风暗色调 UI 一致 |
| `background_color` | `#1a1a2e` | 启动画面背景色，避免白屏闪烁 |
| `categories` | `["games"]` | 标记为游戏类应用 |

### 6.3 Service Worker 缓存策略

| 资源类型 | 策略 | 原因 |
|---------|------|------|
| HTML / JS / CSS | **Stale While Revalidate** | 保证快速加载，同时自动更新 |
| 精灵图 / Tilemap | **Cache First** | 资源不常更新，优先使用缓存 |
| 音频文件 | **Cache First** | 同上 |
| 游戏数据 JSON（如果从 CDN 加载） | **Network First** | 确保获取最新游戏配置 |

### 6.4 离线体验注意事项

- 首次访问时需完整加载所有资源，显示加载进度条
- Service Worker 激活后即可离线游玩
- 游戏更新时通过 `registerType: 'autoUpdate'` 自动更新 Service Worker
- 建议在游戏主菜单提示用户"可以安装到主屏幕"

---

## 7. 静态部署方案

纸翼传说是纯前端静态游戏，不需要后端服务器，适合静态托管。

### 7.1 GitHub Pages

**推荐用于开发阶段和开源分发。**

**方案 A：gh-pages npm 包**

```bash
npm install -D gh-pages
```

```jsonc
// package.json
{
  "scripts": {
    "deploy": "vite build && gh-pages -d dist"
  }
}
```

**方案 B：GitHub Actions（推荐）**

```yaml
# .github/workflows/ci-pages.yml
name: CI and GitHub Pages

on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm test:coverage
      - run: pnpm build

  deploy-pages:
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: verify
    permissions:
      contents: read
      pages: write
      id-token: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: actions/configure-pages@v5
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec vite build --base="/${{ github.event.repository.name }}/"
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

> 对于仓库型 GitHub Pages（如 `https://xndcn.github.io/papper/`），Vite 构建时必须提供 `--base="/<repo-name>/"`，否则静态资源路径会指向站点根目录。

**优势**：免费、与代码仓库绑定、自动 CI/CD
**劣势**：自定义域名需额外配置、无服务端重定向

### 7.2 Netlify

**推荐用于正式发布。**

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

**优势**：自动 CI/CD、免费 SSL、自定义域名简单、CDN 全球分发、表单/函数等增值功能
**劣势**：免费额度有限（100GB/月带宽）

### 7.3 Vercel（备选）

- 配置与 Netlify 类似
- 同样支持自动 CI/CD 和 CDN
- 免费额度足够个人项目使用
- 作为 Netlify 不可用时的备选方案

### 7.4 itch.io（游戏平台分发）

**推荐用于游戏社区推广。**

```bash
# 使用 butler 命令行工具上传
butler push dist username/paper-wings-legend:html5
```

**优势**：
- 游戏玩家社区，天然流量
- 内嵌 iframe 运行，无需额外配置
- 支持付费下载和自愿赞助
- 参加 Game Jam 的首选平台

**注意事项**：
- itch.io 的 iframe 环境对 `fullscreen` API 有限制
- 需要在上传时指定游戏窗口尺寸
- 建议同时保留独立部署地址（GitHub Pages / Netlify）作为主站

### 部署策略建议

| 阶段 | 平台 | 用途 |
|------|------|------|
| 开发/测试 | GitHub Pages | 内部测试、PR 预览 |
| 正式发布 | Netlify | 主站，自定义域名 |
| 社区推广 | itch.io | 游戏平台分发，获取玩家反馈 |
| 备用 | Vercel | Netlify 故障时的备选 |

---

## 8. LLM 集成方案

纸翼传说中 LLM 主要用于生成游戏内文本内容（NPC 对话、道具描述、关卡叙事、随机事件等）。考虑到 PWA 离线可玩和 bundle size 限制，采用分层策略。

### 8.1 预生成方案（主要方案）

**核心思路**：在开发阶段使用 LLM 批量生成内容，打包为 JSON 随游戏分发。

```
开发阶段：LLM API (GPT-4o / Claude) → 生成内容 → 审核/编辑 → 导出 JSON
运行阶段：游戏 → 读取 JSON → 按规则组合展示
```

**适用内容**：

| 内容类型 | 预生成量 | 存储格式 |
|---------|---------|---------|
| NPC 对话 | 500-1000 条 | `dialogues.json` |
| 道具描述 | 200-300 条 | `items.json` |
| 关卡叙事 | 50-100 段 | `narratives.json` |
| 随机事件 | 100-200 个 | `events.json` |
| 成就描述 | 50-100 条 | `achievements.json` |

**预生成工具脚本示例**：

```typescript
// scripts/generate-content.ts（开发工具，不打包进游戏）
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function generateDialogues(count: number): Promise<Dialogue[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: '你是一个像素风游戏的文案写手，风格幽默轻快...',
    messages: [{ role: 'user', content: `生成${count}条纸飞机主题NPC对话...` }],
  });
  // 解析、验证、返回
  return parseDialogues(response.content);
}
```

**优势**：零运行时开销、完全离线、内容质量可控（人工审核）
**劣势**：内容固定、无法动态个性化

### 8.2 运行时算法（轻量补充）

使用 Markov 链 + 模板系统在运行时生成轻量变化文本，增加游戏文本的多样性。

**代码体积**：约 **5-10KB** gzip

```typescript
// src/systems/TextGenerator.ts
interface TextTemplate {
  readonly pattern: string;
  readonly slots: Record<string, readonly string[]>;
}

// 模板示例
const templates: readonly TextTemplate[] = [
  {
    pattern: '一架{adjective}的纸飞机从{location}飞来，带着{item}的气息。',
    slots: {
      adjective: ['轻盈', '破旧', '闪亮', '神秘', '古老'],
      location: ['远方', '云层之上', '废弃的教室', '时间裂缝'],
      item: ['墨水', '折痕', '风', '记忆'],
    },
  },
  // ...更多模板
];

function generateText(template: TextTemplate, rng: () => number): string {
  return template.pattern.replace(
    /\{(\w+)\}/g,
    (_, slot: string) => {
      const options = template.slots[slot];
      if (!options) return `{${slot}}`;
      return options[Math.floor(rng() * options.length)];
    },
  );
}
```

**优势**：极轻量、完全离线、可控性强
**劣势**：文本多样性有限、需要手动编写模板和词库

### 8.3 可选 WebLLM 增强（WebGPU 浏览器）

对于支持 WebGPU 的现代浏览器，可选加载小型语言模型（SmolLM2-135M），在本地运行推理生成更丰富的文本。

**候选库**：

| 库 | 说明 | 模型大小 |
|----|------|---------|
| **@mlc-ai/web-llm** | 基于 Apache TVM 的 WebGPU 推理框架 | SmolLM2-135M: ~270MB（q4量化） |
| **Transformers.js** | Hugging Face 的浏览器端推理框架，支持 WebGPU/WASM | SmolLM2-135M: ~270MB（q4量化） |

**集成策略**：

```typescript
// src/systems/LLMEnhancer.ts（按需加载，不影响核心 bundle）
async function initWebLLM(): Promise<LLMEngine | null> {
  // 1. 检测 WebGPU 支持
  if (!navigator.gpu) return null;

  // 2. 检查用户是否开启了"AI 增强"选项
  const settings = loadSettings();
  if (!settings.enableAI) return null;

  // 3. 动态导入（code splitting，不影响初始 bundle）
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

  // 4. 加载模型（首次需下载约 270MB，之后缓存在 Cache API）
  const engine = await CreateMLCEngine('SmolLM2-135M-Instruct-q4f16_1-MLC', {
    initProgressCallback: (progress) => {
      updateLoadingBar(progress.progress);
    },
  });

  return engine;
}
```

**注意事项**：

- WebLLM 是**完全可选**的增强功能，游戏核心体验不依赖于它
- 模型文件约 270MB，首次加载后通过 Cache API 缓存
- SmolLM2-135M 的生成质量有限，主要用于简单的文本变化和填充
- 需要在 UI 中明确告知用户模型下载大小和 WebGPU 要求
- 生成的文本需要经过过滤和格式化，避免不合适的输出

### 方案优先级

```
优先级 1：预生成 JSON（必须实现，零运行时成本）
优先级 2：Markov 链 + 模板系统（推荐实现，5-10KB 成本）
优先级 3：WebLLM 增强（可选实现，仅在 WebGPU 浏览器中可用）
```

---

## 9. 美术工具链

像素风游戏的美术工具链决定了资产制作效率和最终画面质量。

### 9.1 像素精灵图制作

**Aseprite**（首选，付费 $19.99）

- 像素艺术领域的行业标准工具
- 强大的帧动画编辑器：洋葱皮、动画预览、帧标签
- 原生导出 JSON + spritesheet 格式，Phaser 可直接加载
- 支持图层、调色板管理、对称绘制、tile 模式
- 支持导出为 `.aseprite` 格式，Phaser 有对应的 loader 插件

**LibreSprite**（备选，免费开源）

- Aseprite 的 GPLv2 分支，功能基本一致
- 缺少 Aseprite 近年的新功能（如 tilemap 模式）
- 适合预算有限的团队成员使用

**工作流**：

```
Aseprite 绘制动画 → 导出 JSON + PNG spritesheet → Phaser Aseprite Loader 加载
```

### 9.2 地图编辑

**Tiled Map Editor**（免费开源）

- 2D 游戏地图编辑的事实标准
- 支持正交/等距/六角 tilemap
- 对象层可放置 NPC、道具、触发区域
- 碰撞层与物理引擎集成
- 导出 JSON (`.tmj`) / TMX 格式，Phaser 原生支持
- 自定义属性系统，可定义风向、气流区域等游戏逻辑数据

**纸翼传说中的 Tilemap 使用**：

| 图层 | 用途 |
|------|------|
| Background | 远景背景（天空、云层、山脉） |
| Midground | 中景建筑、树木 |
| Foreground | 近景障碍物、装饰 |
| Collision | 物理碰撞边界 |
| Objects | NPC、道具、检查点位置 |
| Wind Zones | 风向/气流区域（自定义属性标注方向和强度） |

### 9.3 精灵图集打包

**TexturePacker**（付费，最专业）

- 自动化精灵图集打包，支持多种排列算法（MaxRects, Shelf 等）
- 多种输出格式，原生支持 Phaser 3 JSON Array/Hash 格式
- trim / extrude 功能防止像素出血
- 命令行工具可集成到 CI/CD 管线

**free-tex-packer**（免费开源替代）

- 基于 Web 的精灵图集打包工具
- 支持 Phaser 3 输出格式
- 功能够用，但自动化集成不如 TexturePacker

**建议**：开发初期使用 free-tex-packer，项目规模扩大后考虑 TexturePacker。

### 9.4 音效生成

**sfxr / jsfxr**

- 经典的 8-bit 风格音效生成器
- [jsfxr](https://sfxr.me/) 是基于浏览器的版本，无需安装
- 支持生成：激光、爆炸、跳跃、拾取、伤害等类型的音效
- 导出为 WAV 格式

**纸翼传说需要的音效类型**：

| 音效 | sfxr 类型 | 说明 |
|------|----------|------|
| 纸飞机投掷 | Blip / Jump | 短促、清脆 |
| 折纸变形 | Powerup | 升级感 |
| 碰撞障碍物 | Hit / Hurt | 撞击反馈 |
| 拾取道具 | Pickup / Coin | 奖励反馈 |
| 加速气流 | Laser（调低频） | 嗖的一声 |
| 坠落 | Explosion（低音） | 下落感 |

### 9.5 音乐制作

**Beepbox**（推荐，免费在线工具）

- 基于浏览器的 chiptune 音乐编辑器
- 上手极快，无需音乐专业背景
- 支持多音轨、多种芯片音色
- 直接导出 WAV / MP3
- 非常适合像素风游戏的 BGM

**FamiTracker**（备选，Windows）

- 经典的 NES 风格 tracker 音乐编辑器
- 完全模拟 NES 的 2A03 音频芯片
- 学习曲线较陡，但表现力极强
- 适合追求正宗 8-bit 音乐风格的项目

**音乐需求清单**：

| 场景 | 风格 | 时长 | Loop |
|------|------|------|------|
| 主菜单 | 轻快、充满期待 | 60-90秒 | 是 |
| 竞速关卡 | 紧张、节奏快 | 120-180秒 | 是 |
| Boss 关卡 | 紧迫、史诗感 | 90-120秒 | 是 |
| 商店/升级 | 轻松、悠闲 | 60秒 | 是 |
| 胜利/结算 | 欢快、成就感 | 10-15秒 | 否 |
| 失败 | 低落但不沮丧 | 5-10秒 | 否 |

---

## 10. 性能预算

严格的性能预算确保游戏在中端移动设备上流畅运行。

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **初始 bundle (gzip)** | < 500KB | 包含 Phaser (~180KB) + 游戏逻辑 (~200KB) + 框架开销 (~120KB) |
| **首次绘制 (FCP)** | < 2秒 (4G网络) | 4G 网络下载速度约 5Mbps，500KB 约 0.8秒 + 解析执行 ~1秒 |
| **游戏数据 (JSON, gzip)** | < 500KB | 包含 NPC 对话、道具数据、关卡配置、预生成文本等 |
| **总资源量** | < 5MB | 包含精灵图、tilemap、音频、字体等所有资源 |
| **帧率** | 60 FPS (中端手机) | 基准设备：2022年中端 Android 手机（Snapdragon 695 级别） |
| **内存占用** | < 200MB | 包含纹理缓存、物理引擎、音频缓冲、游戏状态 |

### 资源预算分配

```
总预算：5MB
├── 精灵图集 (PNG)     1.5MB    30%
├── Tilemap (JSON+图集) 1.0MB    20%
├── 音频 (MP3/OGG)     1.5MB    30%
├── 游戏数据 (JSON)     0.5MB    10%
├── 字体               0.3MB     6%
└── 其他               0.2MB     4%
```

### 性能优化策略

1. **资源分包加载**：按场景/关卡分包，只加载当前需要的资源
2. **纹理图集**：合并小图为图集，减少 draw call
3. **对象池**：障碍物、粒子等频繁创建/销毁的对象使用对象池复用
4. **离屏剔除**：不渲染视口外的对象
5. **物理休眠**：远离玩家的物理体进入 sleep 状态
6. **音频压缩**：使用 MP3/OGG 格式而非 WAV，音效采用较低采样率（22050Hz）
7. **懒加载**：非核心资源（WebLLM 模型、成就图标等）延迟加载

### 监控与测试

```typescript
// src/utils/performance.ts
function monitorPerformance(game: Phaser.Game): void {
  // FPS 监控
  game.events.on('step', () => {
    const fps = game.loop.actualFps;
    if (fps < 50) {
      console.warn(`FPS drop: ${fps.toFixed(1)}`);
    }
  });

  // 内存监控（仅 Chrome）
  if ('memory' in performance) {
    setInterval(() => {
      const mem = (performance as any).memory;
      const usedMB = mem.usedJSHeapSize / 1024 / 1024;
      if (usedMB > 180) {
        console.warn(`Memory high: ${usedMB.toFixed(1)}MB`);
      }
    }, 5000);
  }
}
```

---

## 附录：技术栈总览

| 层 | 技术选型 | 说明 |
|----|---------|------|
| 语言 | TypeScript (strict mode) | 类型安全，减少运行时错误 |
| 构建工具 | Vite | 极速 HMR，优秀的 tree-shaking |
| 游戏框架 | Phaser 3 (关注 Phaser 4) | HTML5 游戏开发标准 |
| 物理引擎 | Matter.js (内置于 Phaser) | 飞行物理模拟 |
| 状态管理 | Phaser Scene + 自定义 EventBus | 场景间数据传递 |
| 持久化存储 | Dexie.js (IndexedDB) | 游戏存档 |
| 设置存储 | localStorage | 简单配置项 |
| PWA | vite-plugin-pwa + Workbox | 离线支持 |
| 像素美术 | Aseprite / LibreSprite | 精灵动画 |
| 地图编辑 | Tiled Map Editor | 关卡设计 |
| 图集打包 | TexturePacker / free-tex-packer | 精灵合并 |
| 音效 | jsfxr | 8-bit 音效 |
| 音乐 | Beepbox / FamiTracker | Chiptune BGM |
| 文本生成（开发时） | Claude / GPT-4o API | 预生成游戏内容 |
| 文本生成（运行时） | Markov 链 + 模板系统 | 轻量动态文本 |
| 文本生成（可选增强） | @mlc-ai/web-llm (WebGPU) | 本地 AI 生成 |
| 部署 | Netlify (主) / GitHub Pages / itch.io | 静态托管 |
| CI/CD | GitHub Actions | 自动构建部署 |
