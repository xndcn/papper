# 纸翼传说 (Paper Wings Legend)

> 一款在浏览器中运行的 2D 像素风 roguelike 纸飞机竞速游戏

<!-- TODO: 添加游戏截图/概念图 -->

## 游戏简介

你是一个热爱折纸飞机的孩子，梦想赢得全国纸飞机大赛冠军。在城镇中探索、收集各种纸飞机、学习折纸技巧、装备独特零件，参加一场又一场锦标赛。每次比赛都是一次全新的 roguelike 冒险——随机的对手、变化的风向、意想不到的道具，让每一场比赛都充满挑战。

失败不是终点。每次回到城镇，你都会发现新的故事、新的朋友、新的秘密。收集超过 30 种纸飞机，搭配上百种零件，打造属于你的最强纸飞机！

## 核心特色

- **混合 roguelike 玩法**：持久化的城镇探索 + run-based 锦标赛
- **策略构建制**：比赛前精心构建你的纸飞机，装备零件和技能
- **30+ 种纸飞机**：速度型、特技型、稳定型，每种都有独特能力
- **模块化零件系统**：机鼻、机翼、尾翼、涂装、配重——自由组合
- **三角克制 + 天气系统**：根据对手和天气调整策略
- **Hades 式渐进叙事**：每次回城都有新对话，失败也推进故事
- **像素风折纸教学**：在游戏中学习真实的纸飞机折法
- **完全离线可玩**：PWA 支持，随时随地畅玩

## 技术栈

| 技术 | 用途 |
|------|------|
| [Phaser 3](https://phaser.io/) | 游戏框架 |
| TypeScript | 开发语言 |
| [Vite](https://vitejs.dev/) | 构建工具 |
| Matter.js | 物理引擎（飞行模拟） |
| IndexedDB | 游戏存档 |
| Service Worker / PWA | 离线支持 |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm（推荐）或 npm

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/xndcn/papper.git
cd papper

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行单元测试
pnpm test

# 检查覆盖率
pnpm test:coverage

# 运行 Lint
pnpm lint

# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview
```

## 项目结构

```
papper/
├── src/                    # 源代码
│   ├── scenes/             # Phaser 场景
│   ├── entities/           # 游戏实体（飞机、零件、技能等）
│   ├── systems/            # 游戏系统（物理、比赛、进度等）
│   ├── ui/                 # UI 组件
│   ├── data/               # 预生成内容数据 (JSON)
│   ├── utils/              # 工具函数
│   └── main.ts             # 入口文件
├── public/                 # 静态资源
│   ├── assets/             # 精灵图、音效等
│   └── manifest.json       # PWA manifest
├── docs/                   # 项目文档
│   ├── tech-stack.md       # 技术选型参考
│   ├── game-design.md      # 游戏玩法设计
│   ├── architecture.md     # 系统架构
│   └── art-design.md       # 美术设计
├── tests/                  # 测试文件
├── CLAUDE.md               # Agent 开发规范
├── ROADMAP.md              # 开发路线图
├── CHANGELOG.md            # 变更日志
└── README.md               # 项目介绍（本文件）
```

## 文档导航

| 文档 | 说明 |
|------|------|
| [技术选型参考](docs/tech-stack.md) | 框架对比、选型理由、配置要点 |
| [游戏玩法设计](docs/game-design.md) | 核心循环、纸飞机系统、技能、叙事 |
| [系统架构](docs/architecture.md) | 模块划分、数据模型、场景流转 |
| [美术设计](docs/art-design.md) | 像素风格、角色设计、UI 规范 |
| [开发路线图](ROADMAP.md) | 开发计划与进度 |
| [变更日志](CHANGELOG.md) | 版本变更记录 |
| [Agent 规范](CLAUDE.md) | AI Agent 开发流程与规范 |

## 贡献指南

1. Fork 本项目
2. 创建你的特性分支 (`git checkout -b feat/amazing-feature`)
3. 提交你的更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 创建 Pull Request

请确保：
- 遵循 [CLAUDE.md](CLAUDE.md) 中的代码规范
- 通过所有测试（`pnpm test`）
- 测试覆盖率 >= 80%

## 许可证

MIT License
