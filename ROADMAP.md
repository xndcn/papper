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

- [x] **Step 4: 构建场景与零件装配**
  - [x] 创建 `src/scenes/BuildScene.ts`：赛前构建界面
    - [x] 飞机选择列表（3 种基础机型，显示名称 + 类型标签 + 五维属性条/数值）
    - [x] 零件槽位面板（根据选中飞机的 slots 动态显示可用槽位）
    - [x] 零件背包列表（显示拥有的零件，可点击装入对应槽位）
    - [x] 实时属性预览（装备零件后实时更新五维数值显示）
    - [x] 天气预告（显示本场比赛的天气条件，辅助玩家做出选择）
    - [x] "出战"按钮 → 携带完整配置（飞机 + 零件 + 天气）启动 RaceScene
  - [x] 更新场景流转：MainMenuScene → BuildScene → RaceScene → ResultScene → MainMenuScene
  - [x] 更新 `src/config/constants.ts`：新增 BUILD 场景 key 和流转关系
  - [x] 验证：可选择飞机、装卸零件、看到属性变化、点击出战进入比赛

- [x] **Step 5: AI 对手系统**
  - [x] 创建 `src/systems/OpponentAI.ts`：AI 决策纯逻辑模块
    - `calculateAILaunchParams(opponent, weather)` — 根据性格和天气决定发射角度与力度（aggressive 偏好大力低角度，cautious 偏好中等力度中等角度）
    - `simulateOpponentFlight(launchParams, airplaneStats, weather, raceDuration)` — 简化飞行模拟：使用抛物线运动公式近似，基于发射参数和属性计算飞行距离与滞空时间（不做逐帧 Matter.js 物理，参考 PhysicsSystem 的力学公式简化计算）
    - `generateOpponentScore(flightResult)` — 生成 AI 的最终得分
  - [x] 更新 RaceScene：在发射阶段同时计算 AI 结果，飞行过程中显示 AI 飞机位置（用简化轨迹动画或进度指示器）
  - [x] 更新 ResultScene：展示排名对比（玩家 vs AI），显示双方得分和飞行数据
  - [x] 单元测试：AI 发射参数合理性、飞行距离与属性正相关、不同性格行为差异
  - [x] 验证：比赛中可看到 AI 对手存在感，结算时有明确的胜负排名

- [x] **Step 6: 完整比赛流程与场景打磨**
  - [x] BootScene 升级：显示游戏 Logo / 标题文字 + 最小化加载动画，自动过渡到 PreloadScene
  - [x] PreloadScene 升级：加载 JSON 数据文件（airplanes / parts / weather / opponents），显示像素风进度条和加载提示文本
  - [x] MainMenuScene 升级：游戏标题"纸翼传说"+ 副标题 + "开始比赛"按钮 + 简单纸飞机飘飞背景动画
  - [x] RaceScene HUD 增强：速度仪表、高度/距离计数器、风向指示器、AI 对手相对位置指示
  - [x] ResultScene 升级：排名展示（第 X 名/共 2 人）、得分明细（距离分 + 滞空分）、"再来一局" / "返回菜单"按钮
  - [x] 触屏兼容验证：确保 BuildScene 的点击选择、RaceScene 的拖拽发射和俯仰控制在移动端触屏正常工作
  - [x] 验证：完成从 MainMenu → Build → Race → Result → MainMenu 的完整闭环，所有场景 UI 可读可操作

- [x] **Step 7: 测试收尾与文档更新**
  - [x] 所有新增 systems 和 utils 模块的 Vitest 单元测试覆盖率 ≥ 80%
  - [x] Playwright MCP 视觉验证：所有场景截图 + 关键交互流程测试（构建→发射→飞行→结算完整流程）
  - [x] 更新 ROADMAP.md：标记 Phase 1 各 Step 完成状态
  - [x] 更新 CHANGELOG.md：记录 Phase 1 所有新增功能
  - [x] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过，`pnpm build` 成功

## Phase 2: Roguelike 循环

> 基于 Phase 1 已完成的 MVP（弹弓发射、飞机属性驱动、天气系统、AI 对手、构建场景），
> 将 Roguelike 循环拆解为 8 个 Step，逐步引入技能/Buff 系统、锦标赛路径地图、
> IndexedDB 存档、Meta 进度和馆主对手，最终形成可玩的多场比赛 Roguelike Run 闭环。

- [x] **Step 1: 技能与Buff数据模型与内容数据**
  - [x] 扩展 `src/types/index.ts`：新增 Phase 2 所需类型定义（参照 architecture.md「数据模型设计」章节）
    - [x] 技能相关：SkillType、TriggerType、SkillEffect、Skill
    - [x] Buff 相关：Buff
    - [x] 锦标赛相关：TournamentNodeType、TournamentNode、TournamentMap、TournamentRun、Reward、EventData
    - [x] 存档相关：PlayerProfile、StoryProgress、MetaProgress、GameSettings、SaveData
  - [x] 创建 `src/data/skills.json`：3 种基础主动技能数据（加速冲刺 active / 急转弯 active / 护盾 active）+ 2 种被动技能（逆风飞翔 passive / 凤凰涅槃 passive），含效果类型、冷却时间、触发条件、技能描述
  - [x] 创建 `src/data/buffs.json`：6 种被动 Buff 数据（风之祝福 / 纸甲 / 轻盈之体 / 精准投掷 / 最后冲刺 / 折纸之魂），含 Buff 效果、持续时间、稀有度和叠加规则
  - [x] 扩展 `src/systems/ContentLoader.ts`：新增 `getSkills()` / `getSkillById(id)` / `getSkillsByType(type)` / `getBuffs()` / `getBuffById(id)` 等类型安全的查询接口
  - [x] 单元测试：ContentLoader 新增查询接口 + skills/buffs 数据 schema 校验
  - [x] 验证：`pnpm test:coverage` 通过，`pnpm lint` 通过，所有技能和 Buff 数据正确加载

- [ ] **Step 2: SkillSystem 主动技能与Buff管理逻辑**
  - [ ] 创建 `src/systems/SkillSystem.ts`：技能与 Buff 纯逻辑模块
    - [ ] `activateSkill(skill, currentTime) → { buff: Buff, cooldownEnd: number }` — 激活主动技能，生成对应 Buff 并设置冷却
    - [ ] `updateCooldowns(skillStates, currentTime) → SkillState[]` — 更新所有技能的冷却状态（返回是否可用）
    - [ ] `isSkillReady(skillState, currentTime) → boolean` — 判断技能是否已冷却完毕
    - [ ] `applyBuff(buff, baseStats) → AirplaneStats` — 将单个 Buff 的属性修正应用到基础属性上
    - [ ] `getActiveBuffs(buffs, currentTime) → Buff[]` — 过滤出当前仍在生效的 Buff
    - [ ] `removeExpiredBuffs(buffs, currentTime) → Buff[]` — 移除已过期的 Buff
    - [ ] `calculateBuffedStats(baseStats, activeBuffs) → AirplaneStats` — 叠加所有生效 Buff 后的最终属性
    - [ ] `checkPassiveTrigger(skill, triggerEvent) → boolean` — 检查被动技能的触发条件是否满足
    - [ ] `resolveBuffConflicts(buffs) → Buff[]` — 同类 Buff 不叠加取最高值，互斥 Buff 处理
  - [ ] 创建辅助类型 `SkillState`（技能运行时状态：技能引用 + 冷却结束时间 + 使用次数）
  - [ ] 单元测试：技能激活冷却、Buff 叠加/过期/冲突、被动触发条件、属性修正计算
  - [ ] 验证：`pnpm test:coverage` ≥ 80%（systems/），`pnpm lint` 通过

- [ ] **Step 3: 锦标赛系统核心逻辑（TournamentSystem）**
  - [ ] 创建 `src/systems/TournamentSystem.ts`：锦标赛路径生成与 Run 状态管理纯逻辑模块
    - [ ] `generateTournamentMap(seed, layerCount?) → TournamentMap` — 基于种子生成分支路径地图（默认 5 层，每层 2-3 个节点），节点类型分布：普通比赛 > 商店/事件 > 精英 > Boss（最终层固定）
    - [ ] `getAvailableNodes(run) → TournamentNode[]` — 获取当前层可选的下一步节点
    - [ ] `selectNode(run, nodeId) → TournamentRun` — 选择节点，更新 Run 状态（推进到下一层，记录已访问节点）
    - [ ] `startRace(run, node) → RaceConfig` — 从比赛节点生成 RaceConfig（对手、天气、难度）
    - [ ] `completeRace(run, result) → TournamentRun` — 记录比赛结果，更新 Run 内金币和零件
    - [ ] `isRunComplete(run) → boolean` — 判断 Run 是否结束（胜利到达最终层/失败）
    - [ ] `getRunRewards(run) → Reward[]` — 计算 Run 结束时的总奖励（根据胜败差异化）
    - [ ] `abandonRun(run) → TournamentRun` — 放弃当前 Run
  - [ ] 创建 `src/utils/SeedManager.ts`：确定性伪随机数生成器（基于种子的 PRNG）
    - [ ] `createRNG(seed: number) → () => number` — 返回一个基于种子的 0-1 随机数生成函数
    - [ ] `randomInt(rng: () => number, min: number, max: number) → number` — 生成范围内的随机整数
    - [ ] `weightedChoice<T>(rng: () => number, items: T[], weights: number[]) → T` — 带权重的随机选择
    - [ ] `shuffle<T>(rng: () => number, array: T[]) → T[]` — 确定性洗牌
  - [ ] 新增更多 AI 对手到 `src/data/opponents.json`：新增 2-3 个不同难度和性格的对手（用于锦标赛普通比赛和精英比赛节点）
  - [ ] 单元测试：地图生成确定性（同种子同结果）、节点类型分布合理性、Run 状态流转、种子管理器
  - [ ] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过

- [ ] **Step 4: IndexedDB 存档系统（Dexie.js + SaveManager）**
  - [ ] 安装 Dexie.js 依赖（`pnpm add dexie`）
  - [ ] 创建 `src/systems/SaveManager.ts`：基于 Dexie.js 封装 IndexedDB 的异步存储模块
    - [ ] `initialize() → Promise<void>` — 初始化数据库连接，创建 stores（saves / settings / cache）
    - [ ] `saveGame(data: SaveData) → Promise<void>` — 保存游戏存档（写入前 schema 校验）
    - [ ] `loadGame() → Promise<SaveData | null>` — 加载游戏存档
    - [ ] `deleteSave() → Promise<void>` — 删除存档
    - [ ] `hasSave() → Promise<boolean>` — 检查是否有存档
    - [ ] `autoSave(data: SaveData) → Promise<void>` — 自动存档（写入 auto_save key）
    - [ ] `saveSettings(settings: GameSettings) → Promise<void>` — 保存用户设置
    - [ ] `loadSettings() → Promise<GameSettings | null>` — 加载用户设置
    - [ ] `exportSave() → Promise<string>` — 导出存档为 JSON 字符串
    - [ ] `importSave(json: string) → Promise<void>` — 导入存档（含版本校验）
    - [ ] `createDefaultSaveData() → SaveData` — 创建初始默认存档数据
  - [ ] 创建 `src/utils/GameState.ts`：全局游戏状态单例（参照 architecture.md「状态管理方案」章节）
    - [ ] 持有 `currentSaveData` 和 `currentRun`
    - [ ] 提供 `getSaveData()` / `getCurrentRun()` / `updateSaveData()` / `updateRun()` 不可变更新接口
    - [ ] 集成事件发射（saveDataChanged / runChanged）
  - [ ] 单元测试：SaveManager CRUD 操作（使用 fake-indexeddb 测试）、schema 校验、存档导入导出、GameState 状态管理
  - [ ] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过，`pnpm build` 成功

- [ ] **Step 5: Meta 进度系统（ProgressSystem）**
  - [ ] 创建 `src/systems/ProgressSystem.ts`：跨 Run 永久进度管理纯逻辑模块
    - [ ] `addExperience(meta, amount) → MetaProgress` — 增加经验值，自动计算升级
    - [ ] `getMetaLevel(experience) → number` — 根据累计经验计算当前等级（参照 game-design.md「Meta 进度（永久保留）」章节经验等级表）
    - [ ] `getExperienceForLevel(level) → number` — 获取指定等级所需的累计经验
    - [ ] `checkUnlockConditions(meta, condition) → boolean` — 检查特定内容是否已满足解锁条件
    - [ ] `getUnlockedContent(meta) → { airplanes: string[], skills: string[], partPool: string[] }` — 根据当前等级返回已解锁的内容 ID 列表
    - [ ] `calculateRunRewardExperience(runResult, isVictory) → number` — 计算 Run 结束后获得的经验（胜利 100-150，失败 60-120）
    - [ ] `updateStatistics(profile, raceResult) → PlayerProfile` — 更新玩家累计统计（总比赛次数、最长飞行距离等）
  - [ ] 单元测试：经验-等级映射、升级边界、解锁条件判定、Run 奖励经验计算
  - [ ] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过

- [ ] **Step 6: 锦标赛地图场景与馆主对手**
  - [ ] 创建 `src/scenes/TournamentMapScene.ts`：锦标赛分支路径地图界面
    - [ ] 节点地图渲染：纵向排列，每层 2-3 个节点，用不同图标/颜色区分节点类型（普通比赛/精英/商店/事件/Boss）
    - [ ] 路径连线绘制：相邻层之间的连线，已访问路径标灰
    - [ ] 当前位置标记：高亮当前可选节点
    - [ ] 节点点击交互：点击可选节点 → 显示节点信息（对手/商店/事件描述）→ 确认选择
    - [ ] 锦标赛进度显示：当前层/总层数、已获金币、已收集零件数
    - [ ] "放弃 Run"按钮：确认后结算当前进度并返回主菜单
  - [ ] 新增 1 位馆主级对手到 `src/data/opponents.json`：林小冲（班级赛馆主，aggressive 性格，difficulty 6-7，速度型飞机，完整对话集含胜/败/嘲讽/尊重）
  - [ ] 扩展 `src/systems/OpponentAI.ts`：馆主级 AI 行为增强
    - [ ] 馆主发射参数更优化（更贴近最优角度，力度波动更小）
    - [ ] 馆主飞行模拟中应用其装备的零件和技能加成
  - [ ] 更新场景流转：MainMenuScene → TournamentMapScene → BuildScene → RaceScene → ResultScene → TournamentMapScene（循环直到 Run 结束）→ MainMenuScene
  - [ ] 更新 `src/config/constants.ts`：新增 TOURNAMENT_MAP 场景 key 和流转关系
  - [ ] 验证：可在锦标赛地图中选择节点、查看节点信息、进入比赛、比赛后返回地图继续选择

- [ ] **Step 7: 技能场景集成与赛间奖励**
  - [ ] 更新 `src/scenes/BuildScene.ts`：新增技能装备功能
    - [ ] 技能槽位面板（2-3 个槽位，根据飞机类型决定数量）
    - [ ] 可用技能列表（显示已解锁的主动技能，含名称、图标占位、冷却时间、效果描述）
    - [ ] 点击技能装入槽位 / 点击已装备技能卸下
    - [ ] 实时属性预览中考虑技能的被动效果
  - [ ] 更新 `src/scenes/RaceScene.ts`：集成主动技能激活与 Buff 显示
    - [ ] 技能操作 UI：屏幕底部显示已装备的技能按钮（含冷却倒计时遮罩）
    - [ ] 点击/触屏技能按钮触发技能激活，应用 Buff 到飞机物理参数
    - [ ] 飞行 HUD 显示当前生效的 Buff 图标和剩余时间
    - [ ] 被动技能自动触发检查（逆风触发、失速触发等），触发时显示提示
  - [ ] 更新 `src/scenes/ResultScene.ts`：赛间奖励选择
    - [ ] 比赛胜利后显示三选一奖励面板（随机生成：零件 / 金币 / 技能）
    - [ ] 奖励数据来源于 TournamentSystem.completeRace 的返回值
    - [ ] 选择奖励后更新 TournamentRun 状态（加入 collectedParts / runCoins / runSkills）
    - [ ] 精英/Boss 比赛额外显示特殊奖励
  - [ ] 验证：可在构建界面装备技能、比赛中使用技能并看到效果、赛后选择奖励

- [ ] **Step 8: 完整 Roguelike 循环集成与测试收尾**
  - [ ] 集成 SaveManager 到场景生命周期
    - [ ] MainMenuScene：检查存档 → 显示"继续游戏"（有存档时）/ "新游戏"
    - [ ] 比赛结束自动存档（通过 GameState.updateSaveData + SaveManager.autoSave）
    - [ ] Run 结束时：计算经验奖励 → 更新 MetaProgress → 保存存档 → 返回主菜单
  - [ ] 集成 ProgressSystem 到 Run 结算流程
    - [ ] Run 胜利/失败 → 分别计算经验（game-design.md「锦标赛 Run」章节 Run 结算规则）
    - [ ] 零件保留规则（胜利全额保留，失败保留 1 个）
    - [ ] 等级提升时检查新解锁内容
  - [ ] 完整 Roguelike Run 流程验证
    - [ ] 新游戏 → 主菜单 → 开始锦标赛 → 锦标赛地图（选择节点）→ 构建（选飞机 + 零件 + 技能）→ 比赛（使用技能）→ 结算（选奖励）→ 回到地图 → 重复 4-5 场 → Boss 战 → Run 结束 → 经验结算 → 主菜单
    - [ ] 继续游戏 → 加载存档 → 恢复到上次 Run 状态
  - [ ] 所有新增 systems 和 utils 模块的 Vitest 单元测试覆盖率 ≥ 80%
  - [ ] Playwright MCP 视觉验证：所有新场景截图 + 关键交互流程测试
  - [ ] 更新 ROADMAP.md：标记 Phase 2 各 Step 完成状态
  - [ ] 更新 CHANGELOG.md：记录 Phase 2 所有新增功能
  - [ ] 验证：`pnpm test:coverage` ≥ 80%，`pnpm lint` 通过，`pnpm build` 成功

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
