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
- [x] **Step 4: 飞行体验与计分**
  - [x] 升力/阻力气动模拟（查表法 + 攻角计算）
  - [x] 飞行俯仰控制（触屏上/下半区微调攻角）
  - [x] 相机跟随 + 3 层视差背景（0.1x / 0.3x / 1.0x）
  - [x] 着陆检测（地面碰撞 + 越界）+ 计分（距离 + 滞空时间）
  - [x] 完整比赛循环：菜单→发射→飞行→着陆→结算→菜单
  - [x] 验证：可完整游戏循环，飞行手感合理（有明显升力效果）
- [x] **Step 5: 测试、文档与 CI**
  - [x] PhysicsSystem 单元测试（Vitest，80%+ 覆盖率）
  - [x] math.ts 单元测试（Vitest，80%+ 覆盖率）
  - [x] Playwright MCP 视觉验证（全场景截图 + 交互测试）
  - [x] 更新 ROADMAP.md + CHANGELOG.md
  - [x] GitHub Actions CI（`pnpm lint` / `pnpm test` / `pnpm test:coverage` / `pnpm build`）+ `main` 分支自动发布 GitHub Pages
  - [x] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过，`pnpm build` 成功

## Phase 1: MVP — 核心飞行体验

> 基于项目初始化阶段已完成的原型（弹弓发射、升阻力模拟、俯仰控制、计分结算），
> 将 MVP 核心飞行体验拆解为 7 个 Step，逐步引入数据驱动、飞机差异化、天气影响、
> 构建策略和 AI 对战，最终形成可玩的单场比赛闭环。

- [x] **Step 1: 数据模型与内容数据**
  - [x] 扩展 `src/types/index.ts`：新增 MVP 所需类型定义（参照 architecture.md §4 数据模型）
    - 飞机相关：AirplaneStats、AirplaneType、Airplane、PartSlot、Rarity、Part
    - 天气相关：WeatherCondition、Weather、WeatherEffects
    - 对手相关：Opponent、OpponentPersonality、OpponentDialogues
  - [x] 创建 `src/data/airplanes.json`：3 种基础机型数据（经典飞镖 speed / 经典滑翔机 stability / 蝴蝶翼 trick），含五维属性、可用槽位、解锁条件、描述文本
  - [x] 创建 `src/data/parts.json`：10 个基础零件数据（覆盖 nose/wing/tail/coating/weight 五种槽位，含 common 和 rare 稀有度），含属性修正值和描述
  - [x] 创建 `src/data/weather-presets.json`：3 种基础天气预设（calm / tailwind / headwind），含风向向量、风力强度和属性修正效果
  - [x] 创建 `src/data/opponents.json`：1 个基础 AI 对手数据（菜鸟级，aggressive 性格），含飞机配置、零件列表和对话文本
  - [x] 创建 `src/systems/ContentLoader.ts`：JSON 数据加载与缓存模块，提供 getAirplanes / getParts / getWeatherPresets / getOpponents 等类型安全的查询接口
  - [x] 单元测试：ContentLoader 查询接口 + 数据 schema 校验（确保 JSON 与 TypeScript 类型一致）
  - [x] 验证：`pnpm test:coverage` 通过，`pnpm lint` 通过，所有数据正确加载

- [x] **Step 2: 飞机属性驱动物理系统**
  - [x] 扩展 `src/systems/PhysicsSystem.ts`：新增 AirplaneStats → 物理参数的映射函数族（所有函数参数范围 1-10，返回 number）
    - `calculateStatBasedLaunchForce(speedStat, power, angle) → Vector2Like` — Speed 属性影响发射力大小
    - `calculateDragCoefficient(glideStat) → number` — Glide 属性影响空气阻力（高滑翔 → 低阻力 0.01，低滑翔 → 高阻力 0.05）
    - `calculateAngularDamping(stabilityStat) → number` — Stability 属性影响角速度阻尼（高稳定 → 高阻尼 0.2）
    - `calculateMaxTorque(trickStat) → number` — Trick 属性影响俯仰操控上限
    - `calculateCollisionRetention(durabilityStat) → number` — Durability 属性影响碰撞后速度保留比（0.3~0.9）
  - [x] 创建 `src/systems/AirplaneStatsSystem.ts`：零件加成计算模块
    - `calculateFinalStats(baseStats, equippedParts) → AirplaneStats` — 基础属性 + 零件修正 = 最终属性（每项 clamp 到 `MIN_STAT_VALUE`~`MAX_STAT_VALUE`，定义在 constants.ts）
  - [x] 更新 RaceScene：通过场景 data 接收飞机配置（AirplaneStats），将属性应用到物理参数（替换当前硬编码常量）
  - [x] 单元测试：属性映射函数边界值 + AirplaneStatsSystem 加成计算
  - [x] 验证：选择不同飞机（速度型 vs 稳定型）时飞行手感有明显差异

- [x] **Step 3: 基础天气系统**
  - [x] 创建 `src/systems/WeatherSystem.ts`：天气纯逻辑模块
    - [x] `getWindVector(weather)` — 从天气预设获取风向力向量
    - [x] `calculateWindEffect(weather, airplaneStats)` — 计算风力对飞机的有效作用力（Stability 属性减少风力影响）
    - [x] `selectWeather(presets, seed?)` — 根据预设权重随机选择天气
  - [x] 在 RaceScene 飞行 update 循环中集成风力：每帧施加 windEffect 外力到飞机刚体
  - [x] RaceScene HUD 添加天气信息显示：当前天气名称 + 风向箭头指示
  - [x] 单元测试：风力计算（顺风加速 / 逆风减速 / 无风零力）、稳定属性减风验证
  - [x] 验证：顺风下飞机飞行距离显著增加，逆风下显著缩短；HUD 正确显示天气信息

- [ ] **Step 4: 构建场景与零件装配**
  - [ ] 创建 `src/scenes/BuildScene.ts`：赛前构建界面
    - 飞机选择列表（3 种基础机型，显示名称 + 类型标签 + 五维属性条/数值）
    - 零件槽位面板（根据选中飞机的 slots 动态显示可用槽位）
    - 零件背包列表（显示拥有的零件，可拖入/点击装入对应槽位）
    - 实时属性预览（装备零件后实时更新五维数值显示）
    - 天气预告（显示本场比赛的天气条件，辅助玩家做出选择）
    - "出战"按钮 → 携带完整配置（飞机 + 零件 + 天气）启动 RaceScene
  - [ ] 更新场景流转：MainMenuScene → BuildScene → RaceScene → ResultScene → MainMenuScene
  - [ ] 更新 `src/config/constants.ts`：新增 BUILD 场景 key 和流转关系
  - [ ] 验证：可选择飞机、装卸零件、看到属性变化、点击出战进入比赛

- [ ] **Step 5: AI 对手系统**
  - [ ] 创建 `src/systems/OpponentAI.ts`：AI 决策纯逻辑模块
    - `calculateAILaunchParams(opponent, weather)` — 根据性格和天气决定发射角度与力度（aggressive 偏好大力低角度，cautious 偏好中等力度中等角度）
    - `simulateOpponentFlight(launchParams, airplaneStats, weather, raceDuration)` — 简化飞行模拟：使用抛物线运动公式近似，基于发射参数和属性计算飞行距离与滞空时间（不做逐帧 Matter.js 物理，参考 PhysicsSystem 的力学公式简化计算）
    - `generateOpponentScore(flightResult)` — 生成 AI 的最终得分
  - [ ] 更新 RaceScene：在发射阶段同时计算 AI 结果，飞行过程中显示 AI 飞机位置（用简化轨迹动画或进度指示器）
  - [ ] 更新 ResultScene：展示排名对比（玩家 vs AI），显示双方得分和飞行数据
  - [ ] 单元测试：AI 发射参数合理性、飞行距离与属性正相关、不同性格行为差异
  - [ ] 验证：比赛中可看到 AI 对手存在感，结算时有明确的胜负排名

- [ ] **Step 6: 完整比赛流程与场景打磨**
  - [ ] BootScene 升级：显示游戏 Logo / 标题文字 + 最小化加载动画，自动过渡到 PreloadScene
  - [ ] PreloadScene 升级：加载 JSON 数据文件（airplanes / parts / weather / opponents），显示像素风进度条和加载提示文本
  - [ ] MainMenuScene 升级：游戏标题"纸翼传说"+ 副标题 + "开始比赛"按钮 + 简单纸飞机飘飞背景动画
  - [ ] RaceScene HUD 增强：速度仪表、高度/距离计数器、风向指示器、AI 对手相对位置指示
  - [ ] ResultScene 升级：排名展示（第 X 名/共 2 人）、得分明细（距离分 + 滞空分）、"再来一局" / "返回菜单"按钮
  - [ ] 触屏兼容验证：确保 BuildScene 的点击选择、RaceScene 的拖拽发射和俯仰控制在移动端触屏正常工作
  - [ ] 验证：完成从 MainMenu → Build → Race → Result → MainMenu 的完整闭环，所有场景 UI 可读可操作

- [ ] **Step 7: 测试收尾与文档更新**
  - [ ] 所有新增 systems 和 utils 模块的 Vitest 单元测试覆盖率 ≥ 80%
  - [ ] Playwright MCP 视觉验证：所有场景截图 + 关键交互流程测试（构建→发射→飞行→结算完整流程）
  - [ ] 更新 ROADMAP.md：标记 Phase 1 各 Step 完成状态
  - [ ] 更新 CHANGELOG.md：记录 Phase 1 所有新增功能
  - [ ] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过，`pnpm build` 成功

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
