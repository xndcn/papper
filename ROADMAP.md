# 开发路线图 (Roadmap)

> 本文档由 Agent 在开发过程中维护，记录已完成和计划中的功能。

## 当前阶段：项目初始化

- [x] 创建项目文档体系
- [x] 确认技术决策（分辨率、物理库、测试策略等），修正文档矛盾
- [x] **Step 1: 工程脚手架**
  - [x] package.json（pnpm + Phaser 3 + Vite + TypeScript）
  - [x] tsconfig.json（strict 模式，path alias `@/*`）
  - [x] vite.config.ts（Phaser 优化，PWA 占位注释）
  - [x] ESLint v9 flat config + Prettier
  - [x] Vitest 配置（覆盖率仅 systems/ + utils/）
  - [x] index.html + src/main.ts（480×270 Phaser 画布）
  - [x] 验证：`pnpm dev` 显示空白 Phaser 画布，无控制台报错
- [x] **Step 2: 场景框架**
  - [x] 5 个核心场景空壳（BootScene / PreloadScene / MainMenuScene / RaceScene / ResultScene）
  - [x] 完整场景流转（Boot→Preload→MainMenu→Race→Result→MainMenu）
  - [x] 类型定义（`src/types/index.ts`）+ 游戏常量（`src/config/constants.ts`）
  - [x] 验证：可点击完成全部场景导航，无报错
- [x] **Step 3: 物理发射系统**
  - [x] PhysicsSystem 纯逻辑模块（发射力计算、攻角计算、气动系数查表）
  - [x] math.ts 工具函数（向量运算、clamp、lerp）
  - [x] 拖拽弹弓发射交互 + 轨迹预览虚线
  - [x] 白色三角形纸飞机（Phaser Graphics + Matter.js 刚体）
  - [x] 地面静态物理体 + 碰撞检测
  - [x] 验证：可拖拽发射，飞机物理飞行并碰地停止
- [ ] **Step 4: 飞行体验与计分**
  - [ ] 升力/阻力气动模拟（查表法 + 攻角计算）
  - [ ] 飞行俯仰控制（触屏上/下半区微调攻角）
  - [ ] 相机跟随 + 3 层视差背景（0.1x / 0.3x / 1.0x）
  - [ ] 着陆检测（地面碰撞 + 越界）+ 计分（距离 + 滞空时间）
  - [ ] 完整比赛循环：菜单→发射→飞行→着陆→结算→菜单
  - [ ] 验证：可完整游戏循环，飞行手感合理（有明显升力效果）
- [x] **Step 5: 测试与文档**
  - [x] PhysicsSystem 单元测试（Vitest，80%+ 覆盖率）
  - [x] math.ts 单元测试（Vitest，80%+ 覆盖率）
  - [x] Playwright MCP 视觉验证（全场景截图 + 交互测试）
  - [x] 更新 ROADMAP.md + CHANGELOG.md
  - [x] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过，`pnpm build` 成功

## Phase 1: MVP — 核心飞行体验

- [ ] BootScene / PreloadScene 资源加载
- [ ] MainMenuScene 主菜单
- [ ] 基础飞行物理（发射 + 飞行 + 着陆）
- [ ] 3种基础纸飞机（速度型/特技型/稳定型各1种）
- [ ] 10个基础零件
- [ ] 简单的单场比赛流程（构建→发射→飞行→结算）
- [ ] 1个AI对手
- [ ] 基础天气系统（顺风/逆风）
- [ ] 触屏/鼠标输入支持

## Phase 2: Roguelike 循环

- [ ] 锦标赛分支路径地图（5场比赛）
- [ ] 赛间零件/buff选择
- [ ] 1位馆主级对手
- [ ] 主动技能系统（3种基础技能）
- [ ] 被动buff系统
- [ ] Meta进度（经验/解锁）
- [ ] IndexedDB 存档系统

## Phase 3: 世界地图与叙事

- [ ] 节点地图（6个场景：家/学校/后山/小卖部/公园/比赛场地）
- [ ] NPC对话系统
- [ ] Hades式渐进叙事
- [ ] 5位馆主完整实现
- [ ] 折纸教学图鉴

## Phase 4: 深度内容

- [ ] 30+种飞机完整实现
- [ ] 100+零件全套装效果
- [ ] 50+技能
- [ ] 每日挑战
- [ ] 成就系统
- [ ] 难度修改器

## Phase 5: 打磨与发布

- [ ] PWA离线支持
- [ ] 音效与音乐
- [ ] 性能优化
- [ ] 多语言支持（预留）
- [ ] 静态部署（GitHub Pages）

## 后期规划

- [ ] 可选WebLLM自定义工作台
- [ ] 其他折纸模型（纸鹤、纸船等）
- [ ] 社区功能（配置分享码）
