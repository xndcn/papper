# 纸翼传说 — 系统架构文档

> Paper Wings Legend System Architecture

## 目录

- [1. 整体架构概览](#1-整体架构概览)
- [2. 核心模块划分](#2-核心模块划分)
- [3. 场景架构](#3-场景架构scene-flow)
- [4. 数据模型设计](#4-数据模型设计)
- [5. 物理模拟设计](#5-物理模拟设计)
- [6. 内容数据格式](#6-内容数据格式)
- [7. 状态管理方案](#7-状态管理方案)
- [8. PWA/离线架构](#8-pwa离线架构)

---

## 1. 整体架构概览

纸翼传说采用分层架构设计，各层职责清晰、依赖单向向下。整体架构由五层组成，从上到下依次为表现层、游戏逻辑层、数据层、内容生成层和基础设施层。

```
┌─────────────────────────────────────────────────────────────────┐
│                      表现层 Presentation                        │
│  Phaser 渲染引擎 ─ 场景(Scene)管理 ─ UI 组件 ─ 动画/粒子系统    │
├─────────────────────────────────────────────────────────────────┤
│                    游戏逻辑层 Game Logic                         │
│  RaceSystem ─ SkillSystem ─ ProgressSystem ─ WeatherSystem     │
│  NarrativeSystem ─ TournamentSystem ─ PhysicsSystem            │
├─────────────────────────────────────────────────────────────────┤
│                       数据层 Data                               │
│  SaveManager(IndexedDB) ─ ContentLoader(JSON) ─ ConfigManager  │
├─────────────────────────────────────────────────────────────────┤
│                 内容生成层 Content Generation                    │
│  预生成数据(JSON) ─ MarkovNameGenerator ─ TemplateGenerator     │
│  StatCalculator ─ SeedManager                                  │
├─────────────────────────────────────────────────────────────────┤
│                   基础设施层 Infrastructure                      │
│  PWA / Service Worker ─ Matter.js 物理引擎 ─ Vite 构建工具      │
│  浏览器 API (IndexedDB / Canvas / Web Audio)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 各层职责说明

**表现层 (Presentation Layer)**

负责一切用户可见的内容和交互。基于 Phaser 3/4 的 Scene 系统组织页面，每个场景对应一个游戏画面（主菜单、地图、比赛等）。UI 组件（HUD、对话框、构建界面）作为场景内的 GameObject 存在。像素风渲染通过 Phaser 的渲染配置实现，包括整数缩放、最近邻插值等。表现层只调用游戏逻辑层提供的接口，不直接操作数据层。

**游戏逻辑层 (Game Logic Layer)**

封装所有游戏规则和业务逻辑。各 System 模块是无状态的纯逻辑单元，接收输入参数、返回计算结果，不持有可变状态。这一层决定比赛胜负、技能效果、天气影响、叙事推进等核心玩法。逻辑层通过数据层读写存档和配置，通过内容生成层获取动态内容。

**数据层 (Data Layer)**

管理游戏的持久化存储和数据访问。SaveManager 封装 IndexedDB（通过 Dexie.js 库），提供存档的读写接口。ContentLoader 负责加载和缓存预生成的 JSON 数据文件。ConfigManager 管理游戏配置（音量、画质、语言等）。数据层对上层提供统一的异步数据访问接口，屏蔽底层存储细节。

**内容生成层 (Content Generation Layer)**

分为两部分：预生成数据和运行时算法。预生成数据是构建时通过 LLM 批量生成并人工审核的 JSON 文件（飞机、零件、技能、对话等）。运行时算法包括 Markov 链名称生成、模板系统、公式计算器和种子管理器，用于在游戏过程中动态生成变体内容（如每日挑战的随机种子、锦标赛路径等）。

**基础设施层 (Infrastructure Layer)**

提供底层技术支撑。Vite 负责开发时的 HMR 热更新和生产构建优化。Service Worker 实现 PWA 离线缓存策略。Matter.js 提供 2D 物理模拟能力。浏览器原生 API（Canvas 渲染、Web Audio 音频、IndexedDB 存储）是最终的运行环境。

### 依赖方向

依赖关系严格单向向下：表现层 -> 游戏逻辑层 -> 数据层 -> 基础设施层。内容生成层被数据层和游戏逻辑层共同使用。任何层不得反向依赖上层模块。通过事件系统（EventEmitter）实现下层向上层的通知，避免循环依赖。

---

## 2. 核心模块划分

### 2.1 游戏引擎层

#### SceneManager (Phaser 场景管理器)

Phaser 内置的场景管理器负责场景的生命周期管理。每个场景继承 `Phaser.Scene`，实现 `preload`、`create`、`update` 三个核心生命周期方法。场景之间通过 `this.scene.start()`、`this.scene.launch()`、`this.scene.stop()` 进行切换。

关键设计决策：
- 一次只有一个主场景处于活跃状态，避免多场景并行的复杂性
- HUD 作为独立场景以 overlay 方式叠加在比赛场景之上
- 场景切换时通过 `data` 参数传递必要的初始化数据

#### Matter.js 物理引擎封装

PhysicsSystem 封装 Matter.js 的底层 API，对外提供游戏语义化的接口。不直接暴露 Matter.js 的 Body、Engine 等对象给其他模块，而是通过 PhysicsSystem 提供 `applyLaunchForce()`、`applyWind()`、`getLiftCoefficient()` 等游戏化接口。

```
PhysicsSystem
├── initEngine()          # 初始化 Matter.js Engine 和 World
├── createAirplaneBody()  # 根据飞机属性创建物理刚体
├── applyLaunchForce()    # 施加发射初始力
├── applyAerodynamics()   # 每帧计算升力/阻力并施加
├── applyWind()           # 施加风力外力
├── checkCollision()      # 碰撞检测与响应
├── getFlightState()      # 获取当前飞行状态（位置/速度/角度）
└── cleanup()             # 销毁物理实体和引擎
```

#### 渲染管线（像素风渲染配置）

通过 Phaser 的游戏配置实现像素风格渲染：

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,                    // 像素风基础分辨率（配合 32x32 tiles）
  height: 270,
  pixelArt: true,                // 启用最近邻插值
  roundPixels: true,             // 整数像素对齐
  scale: {
    mode: Phaser.Scale.FIT,      // 自适应缩放
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',           // 使用 Matter.js
    matter: {
      gravity: { x: 0, y: 0.5 },
      debug: false,
    },
  },
};
```

内部渲染分辨率固定为 480x270（16:9），与 32x32 tiles 对齐。通过整数倍缩放（x2=960x540, x4=1920x1080）适配不同屏幕尺寸。所有精灵使用最近邻插值，保证像素风格清晰锐利。

#### InputManager (输入管理)

统一抽象触屏、鼠标和键盘输入，对外提供一致的交互接口：

```
InputManager
├── onTap(callback)        # 点击/轻触
├── onSwipe(callback)      # 滑动（方向 + 速度）
├── onHold(callback)       # 长按
├── onRelease(callback)    # 释放
├── getPointerPosition()   # 当前指针位置
└── isKeyDown(key)         # 键盘按键状态
```

设计要点：
- 触屏和鼠标事件统一映射为 pointer 事件
- 键盘输入作为桌面端的补充操作方式
- 所有输入事件支持订阅/取消订阅模式
- 滑动手势识别：计算触摸起始点到终止点的方向和距离

### 2.2 数据层

#### SaveManager

基于 Dexie.js 封装 IndexedDB 的异步存储接口，提供游戏存档的 CRUD 操作。

```
SaveManager
├── initialize()                    # 初始化数据库连接
├── saveGame(data: SaveData)        # 保存游戏存档
├── loadGame(): SaveData | null     # 加载游戏存档
├── deleteSave()                    # 删除存档
├── hasSave(): boolean              # 检查是否有存档
├── saveSettings(settings)          # 保存用户设置
├── loadSettings(): Settings        # 加载用户设置
├── exportSave(): string            # 导出存档（JSON 字符串）
└── importSave(json: string)        # 导入存档
```

关键设计：
- 所有存储操作均为异步（返回 Promise）
- 存档数据在写入前进行 schema 校验
- 自动存档：在关键节点（比赛结束、场景切换）触发
- 支持存档导出/导入，便于跨设备迁移

#### ContentLoader

负责加载 `src/data/` 目录下的预生成 JSON 数据文件，并在内存中缓存以避免重复加载。

```
ContentLoader
├── loadAirplanes(): Airplane[]
├── loadParts(): Part[]
├── loadSkills(): Skill[]
├── loadOpponents(): Opponent[]
├── loadDialogues(): Dialogue[]
├── loadWeatherPresets(): WeatherPreset[]
├── getAirplaneById(id: string): Airplane | undefined
├── getPartsBySlot(slot: PartSlot): Part[]
├── getSkillsByType(type: SkillType): Skill[]
└── clearCache()
```

加载策略：
- BootScene 中预加载所有 JSON 文件
- 解析后缓存为 `ReadonlyMap` 以支持快速查找
- 数据文件通过 Vite 的 JSON 导入机制加载，享受 tree-shaking 和压缩

#### ConfigManager

管理游戏运行时配置，包括用户设置和系统常量。

```
ConfigManager
├── get<T>(key: string): T
├── set(key: string, value: unknown): void
├── getVolume(): { master, bgm, sfx }
├── setVolume(channel, value): void
├── getLanguage(): string
├── isAccessibilityEnabled(): boolean
└── resetToDefaults(): void
```

配置分为两类：
- **用户设置**：音量、语言、辅助功能选项等，持久化到 IndexedDB
- **系统常量**：物理参数、平衡性数值等，从代码中的常量对象读取

### 2.3 游戏逻辑层

#### RaceSystem

比赛核心逻辑模块，管理一场比赛的完整生命周期。

```
RaceSystem
├── initializeRace(config: RaceConfig): RaceState
├── launchAirplane(state, angle, power): RaceState
├── updateFlight(state, delta): RaceState
├── calculateScore(state): ScoreResult
├── determineRanking(scores: ScoreResult[]): RankingResult
├── applySkillEffect(state, skill): RaceState
├── checkRaceEnd(state): boolean
└── generateRewards(ranking, difficulty): Reward[]
```

比赛流程：
1. 初始化：设置赛道参数、对手数据、天气条件
2. 发射阶段：玩家控制发射角度和力度
3. 飞行阶段：实时物理模拟 + 技能激活 + 天气影响
4. 评分阶段：根据飞行距离、滞空时间、特技得分计算总分
5. 结算阶段：排名计算、奖励发放

评分公式：
```
总分 = 飞行距离分 × 距离权重
     + 滞空时间分 × 时间权重
     + 特技得分 × 特技权重
     + 天气加成
     + 技能加成
```

#### ProgressSystem

管理 meta 进度，即跨 run 持久化的玩家成长系统。

```
ProgressSystem
├── unlockAirplane(id: string): SaveData
├── addToInventory(part: Part): SaveData
├── updateStoryProgress(event: string): SaveData
├── getUnlockedAirplanes(): Airplane[]
├── getMetaLevel(): number
├── checkUnlockConditions(): UnlockEvent[]
├── applyMetaUpgrade(upgrade: MetaUpgrade): SaveData
└── getStatistics(): PlayerStatistics
```

持久化数据包括：
- 已解锁的飞机列表
- 零件库存
- 故事进度标记
- 累计统计（总比赛次数、总飞行距离、最高分等）
- Meta 升级等级

#### SkillSystem

技能激活、buff 叠加和冷却计算。

```
SkillSystem
├── activateSkill(skill, context): SkillResult
├── applyBuff(buff, target): BuffedStats
├── updateCooldowns(skills, delta): Skill[]
├── checkPassiveTrigger(skill, event): boolean
├── getActiveBuffs(buffs, currentTime): Buff[]
├── calculateBuffedStats(base, buffs): AirplaneStats
├── removeExpiredBuffs(buffs, currentTime): Buff[]
└── resolveSkillConflicts(skills): Skill[]
```

技能类型：
- **主动技能（Active）**：玩家手动触发，有冷却时间。例如"紧急加速"——瞬间提升速度 30%，持续 2 秒，冷却 15 秒。
- **被动技能（Passive）**：满足特定条件自动触发。例如"逆风飞翔"——逆风时自动获得稳定性 +20% buff。

Buff 叠加规则：
- 同类 buff 不叠加，取最高值
- 不同类 buff 可叠加
- buff 有持续时间，到期自动移除
- 某些 buff 存在互斥关系（如加速 vs 减速）

#### WeatherSystem

天气生成和天气对飞行影响的计算。

```
WeatherSystem
├── generateWeather(seed: number): Weather
├── getWindVector(weather): Vector2
├── calculateWindEffect(weather, airplaneStats): ForceVector
├── getVisibilityModifier(weather): number
├── getTurbulence(weather, position): ForceVector
├── transitionWeather(current, next, progress): Weather
└── getWeatherPreset(condition: WeatherCondition): Weather
```

天气要素：
- **风向**（tailwind/headwind/crosswind）：决定风力方向
- **风力强度**（0-10）：决定风力大小
- **天气条件**（calm/tailwind/headwind/crosswind/storm）：影响可见度和额外效果
- **湍流系数**：在暴风天气中引入随机扰动力

天气对飞行的影响：
- 顺风增加水平速度
- 逆风降低水平速度，但高稳定性飞机受影响较小
- 侧风产生横向力和额外扭矩
- 暴风天气增加随机湍流
- 天气影响程度与飞机的稳定属性成反比

#### NarrativeSystem

叙事状态机和对话管理，实现 Hades 式渐进叙事。

```
NarrativeSystem
├── getAvailableDialogues(context: NarrativeContext): Dialogue[]
├── triggerDialogue(dialogueId: string): DialogueSequence
├── advanceDialogue(current: DialogueSequence): DialogueSequence
├── checkNarrativeTriggers(event: GameEvent): Dialogue | null
├── updateRelationship(npcId, delta): void
├── getStoryState(): StoryState
├── markDialogueCompleted(dialogueId): void
└── getNpcMood(npcId): NpcMood
```

设计要点：
- 对话数据以 JSON 文件形式存储，支持条件分支
- 每个对话有触发条件（比赛次数、胜负、特定飞机使用等）
- NPC 好感度系统影响对话选项和奖励
- 失败后返回城镇会触发安慰/鼓励类对话，推进叙事
- 重复对话自动跳过，优先展示未见内容

#### TournamentSystem

锦标赛路径生成和 run 状态管理，是 roguelike 循环的核心。

```
TournamentSystem
├── generateTournamentMap(seed: number): TournamentMap
├── getCurrentNode(): TournamentNode
├── selectPath(nodeId: string): TournamentRun
├── startRace(node: TournamentNode): RaceConfig
├── completeRace(result: RaceResult): TournamentRun
├── enterShop(node: ShopNode): ShopInventory
├── isRunComplete(run: TournamentRun): boolean
├── getRunRewards(run: TournamentRun): Reward[]
└── abandonRun(): SaveData
```

锦标赛结构：
- 分支路径地图，类似 Slay the Spire 的节点地图
- 节点类型：普通比赛、精英比赛、商店、休息点、事件节点
- 每条路径的难度递增，精英节点奖励更丰厚
- 最终节点为 Boss 比赛（锦标赛决赛）
- 种子(seed)决定地图布局、对手配置、商店库存

### 2.4 UI 层

#### HUD

飞行中信息显示组件，以 overlay 场景叠加在 RaceScene 上。

```
HUD
├── speedometer          # 当前速度显示
├── altimeter            # 当前高度显示
├── distanceMeter        # 飞行距离显示
├── trickScoreDisplay    # 特技得分显示
├── skillSlots           # 技能槽（冷却指示）
├── buffIcons            # 当前生效 buff 图标
├── miniMap              # 小地图（显示赛道和对手位置）
├── windIndicator        # 风向/风力指示器
└── angleOfAttackGauge   # 攻角仪表
```

HUD 设计原则：
- 信息密度适中，不遮挡赛道核心区域
- 关键信息（速度、距离）置于屏幕顶部
- 技能操作区域置于屏幕底部，适合拇指操作
- 支持半透明模式减少视觉干扰

#### AirplaneBuilder

飞机/零件装配界面，在 BuildScene 中使用。

```
AirplaneBuilder
├── airplaneSelector     # 飞机选择列表
├── partSlots            # 零件槽位展示（5 个槽位）
├── partInventory        # 零件背包列表
├── statRadarChart       # 五维属性雷达图
├── skillPreview         # 技能预览
├── setBonus             # 套装效果提示
└── confirmButton        # 确认出战
```

交互流程：
1. 选择基础飞机（展示各飞机的基础属性和特殊能力）
2. 为 5 个槽位（机鼻/机翼/尾翼/涂装/配重）装备零件
3. 实时预览最终属性（雷达图动态更新）
4. 套装效果和协同加成高亮提示
5. 确认出战进入比赛

#### Aerodex

图鉴/收藏界面，展示玩家已收集和未收集的内容。

```
Aerodex
├── airplaneCollection   # 飞机图鉴（已解锁/未解锁）
├── partCatalog          # 零件目录
├── skillLibrary         # 技能图鉴
├── opponentGallery      # 对手列表（已遭遇/未遭遇）
├── foldingGuide         # 折纸教程（已学习的折法）
├── statistics           # 统计数据总览
└── achievementList      # 成就列表
```

图鉴设计：
- 未收集的条目显示为剪影/问号
- 已收集的条目可查看详细属性和描述
- 收集进度百分比展示
- 折纸教程以像素动画形式展示真实折法

#### DialogBox

NPC 对话框组件，在多个场景中复用。

```
DialogBox
├── speakerPortrait      # 说话者像素头像
├── speakerName          # 说话者名称
├── textArea             # 对话文本区域（打字机效果）
├── choiceButtons        # 对话选项按钮（如有）
├── nextIndicator        # 翻页指示器
├── skipButton           # 跳过按钮
└── emotionIndicator     # 情绪指示图标
```

对话框特性：
- 打字机效果逐字显示文本
- 点击/空格键加速显示或翻到下一句
- 支持分支对话选项
- 说话者头像根据情绪变化切换表情

#### TournamentMap

锦标赛分支路径 UI，在 TournamentMapScene 中使用。

```
TournamentMap
├── nodeGraph            # 节点地图（可滚动）
├── currentPosition      # 当前位置标记
├── pathLines            # 路径连线
├── nodeIcons            # 节点图标（比赛/商店/事件/Boss）
├── nodeTooltip          # 节点悬停信息
├── difficultyIndicator  # 难度等级指示
└── progressBar          # 锦标赛进度条
```

地图布局：
- 纵向排列，从底部（起点）到顶部（决赛）
- 每层 2-4 个节点，相邻层之间有连线表示可选路径
- 不同节点类型用不同图标区分
- 已访问节点标灰，当前可选节点高亮

### 2.5 内容生成层

#### ContentGenerator

运行时内容生成的总入口，协调各子生成器。

```
ContentGenerator
├── MarkovNameGenerator   # Markov 链名称生成
├── TemplateGenerator     # 模板系统
├── StatCalculator        # 基于公式的属性计算
└── SeedManager           # 种子管理
```

#### MarkovNameGenerator

基于 Markov 链算法生成飞机名称和 NPC 名称，确保名称具有游戏世界的风味。

```
MarkovNameGenerator
├── train(corpus: string[])          # 用预设语料库训练
├── generate(seed?: number): string  # 生成一个名称
├── generateBatch(count, seed): string[]
└── setOrder(n: number)              # 设置 Markov 链阶数
```

训练语料包括：
- 飞机名称语料：纸鹤、风之翼、银箭号、天际追风者等
- NPC 名称语料：常见中文名 + 昵称模式

#### TemplateGenerator

基于模板和词池的内容生成系统，用于生成描述文本、对话变体等。

```
TemplateGenerator
├── registerTemplate(id, template)
├── registerWordPool(poolId, words)
├── generate(templateId, context): string
└── generateWithSeed(templateId, seed): string
```

模板示例：
```
"这架{adjective}的{airplane_type}，据说是{origin}最有名的折纸大师{master_name}的得意之作。"
```

#### StatCalculator

基于公式和约束条件计算属性值，用于动态生成零件属性和对手强度。

```
StatCalculator
├── calculatePartStats(rarity, slot, seed): Partial<AirplaneStats>
├── calculateOpponentDifficulty(stage, seed): DifficultyConfig
├── calculateRewardValue(difficulty, luck): RewardConfig
└── applyStatCurve(baseValue, level): number
```

属性生成遵循预算系统：
- 每个零件有一个总属性预算，根据稀有度确定
- common: 预算 3-5, rare: 预算 6-8, legendary: 预算 9-12
- 预算分配到各属性维度上，允许负值（负面效果换取更强的正面属性）

#### SeedManager

管理随机种子，确保特定场景下的可重现随机性。

```
SeedManager
├── getDailySeed(): number            # 每日挑战种子（基于日期）
├── getShareableSeed(): string        # 可分享种子（编码为短字符串）
├── fromShareableCode(code): number   # 从分享码解析种子
├── createSeededRng(seed): RNG        # 创建确定性随机数生成器
└── generateRunSeed(): number         # 生成新 run 的种子
```

种子用途：
- 每日挑战：所有玩家在同一天面对相同的锦标赛布局
- 可分享种子：玩家可以分享有趣的 run 配置给朋友
- Run 种子：决定整个 run 的随机要素（对手、商店、事件）

---

## 3. 场景架构（Scene Flow）

### 场景流转图

```
BootScene
  │  (加载核心资源: Phaser 配置、基础精灵表、字体)
  ↓
PreloadScene
  │  (加载游戏资源: 所有精灵图、音频、JSON数据文件, 显示加载进度条)
  ↓
MainMenuScene
  │  (主菜单: 开始新游戏 / 继续游戏 / 设置 / 图鉴)
  ↓
WorldMapScene ←─────────────────────────────────────────────┐
  │  (大地图: 城镇节点选择)                                   │
  ├→ HomeScene                                               │
  │    (家: 自动存档, NPC对话, 查看存档信息)                    │
  │    └→ 返回 WorldMapScene                                  │
  ├→ SchoolScene                                             │
  │    (学校: 学习新折法, 解锁新机型, 折纸教程动画)             │
  │    └→ 返回 WorldMapScene                                  │
  ├→ ShopScene                                               │
  │    (小卖部: 使用金币购买零件, 查看每日特价)                  │
  │    └→ 返回 WorldMapScene                                  │
  ├→ ParkScene                                               │
  │    (公园: NPC交流/触发支线, 练习飞行)                       │
  │    └→ 返回 WorldMapScene                                  │
  ├→ MountainScene                                           │
  │    (后山试飞场: 自由试飞, 测试飞机配置, 无排名)             │
  │    └→ 返回 WorldMapScene                                  │
  └→ TournamentMapScene ←──────────────────────┐             │
       │  (锦标赛分支路径地图: 选择下一节点)      │             │
       ├→ BuildScene                            │             │
       │    │  (赛前构建: 选飞机, 装零件, 配技能)  │             │
       │    ↓                                   │             │
       │  RaceScene                             │             │
       │    │  (比赛飞行: 物理模拟, 实时操控)     │             │
       │    ↓                                   │             │
       │  ResultScene                           │             │
       │    │  (比赛结算: 排名, 奖励选择, 零件获取)│             │
       │    └→ 回到 TournamentMapScene ─────────┘             │
       │                                                     │
       ├→ TournamentShopScene                                │
       │    (赛间商店: 购买/升级零件, 恢复耐久)                 │
       │    └→ 回到 TournamentMapScene                        │
       │                                                     │
       └→ Run结束 (胜利/失败)                                 │
            └→ 返回 WorldMapScene ────────────────────────────┘
```

### 各场景详细说明

#### BootScene

**职责**：最小化初始加载，让游戏尽快显示画面。

| 项目 | 说明 |
|------|------|
| 加载内容 | Phaser 引擎初始化、基础精灵表（Loading 动画）、位图字体 |
| 输入数据 | 无 |
| 输出数据 | 无（仅设置全局配置） |
| 过渡条件 | 核心资源加载完成 → 自动切换到 PreloadScene |
| 耗时目标 | < 500ms |

#### PreloadScene

**职责**：加载所有游戏资源，显示带进度条的加载画面。

| 项目 | 说明 |
|------|------|
| 加载内容 | 精灵图（角色、飞机、场景）、音频（BGM、SFX）、JSON 数据文件、图块地图 |
| 输入数据 | 无 |
| 输出数据 | 所有资源注册到 Phaser 缓存 |
| 过渡条件 | 全部资源加载完成 → MainMenuScene |
| UI 元素 | 像素风进度条、加载提示文本 |

#### MainMenuScene

**职责**：游戏入口菜单，提供核心导航。

| 项目 | 说明 |
|------|------|
| 功能 | 新游戏、继续游戏（有存档时显示）、设置、图鉴 |
| 输入数据 | SaveManager 检查是否有存档 |
| 输出数据 | 新游戏 → 初始化 SaveData；继续 → 加载现有 SaveData |
| 过渡目标 | WorldMapScene（新游戏/继续）、SettingsScene、Aerodex |
| 特殊效果 | 背景动画（纸飞机飘飞）、BGM 开始播放 |

#### WorldMapScene

**职责**：城镇大地图，作为非比赛时段的核心导航枢纽。

| 项目 | 说明 |
|------|------|
| 功能 | 展示城镇地图、可交互节点、NPC 位置标记 |
| 输入数据 | SaveData（已解锁地点、当前故事进度） |
| 输出数据 | 选中的目标场景 + 场景初始化参数 |
| 过渡目标 | HomeScene / SchoolScene / ShopScene / ParkScene / MountainScene / TournamentMapScene |
| 动态内容 | 根据故事进度显示/隐藏特定节点、NPC 位置变化 |

#### HomeScene

**职责**：玩家的家，自动存档点和核心 NPC（家人）对话场所。

| 项目 | 说明 |
|------|------|
| 功能 | 自动存档、与家人对话、查看收集品 |
| 输入数据 | SaveData |
| 输出数据 | 更新后的 SaveData（存档） |
| 叙事功能 | 比赛失败后触发鼓励对话、故事关键节点触发剧情对话 |

#### SchoolScene

**职责**：学习新折法和解锁新机型的场所。

| 项目 | 说明 |
|------|------|
| 功能 | 折纸课程（解锁新飞机）、技能学习、NPC 老师对话 |
| 输入数据 | SaveData（当前解锁进度、金币数量） |
| 输出数据 | 新解锁的飞机/技能 → 更新 SaveData |
| 特殊功能 | 像素动画展示折纸步骤 |

#### ShopScene

**职责**：零件商店，使用游戏内货币购买零件和消耗品。

| 项目 | 说明 |
|------|------|
| 功能 | 浏览商品、购买零件、每日特价刷新 |
| 输入数据 | SaveData（金币、库存）、每日种子（决定库存） |
| 输出数据 | 购买的零件 → 更新 SaveData.inventory |
| 刷新机制 | 每日重置库存（基于每日种子） |

#### ParkScene

**职责**：公园场景，NPC 社交和练习飞行。

| 项目 | 说明 |
|------|------|
| 功能 | 与 NPC 交流、接受支线任务、简单练习 |
| 输入数据 | SaveData（NPC 好感度、任务状态） |
| 输出数据 | 对话完成标记、任务进度更新 |
| 叙事功能 | 遇到不同对手角色、获取比赛情报 |

#### MountainScene

**职责**：后山试飞场，自由飞行测试。

| 项目 | 说明 |
|------|------|
| 功能 | 选择飞机和零件、自由飞行测试、无排名无奖励 |
| 输入数据 | SaveData（已解锁飞机和零件） |
| 输出数据 | 无（纯测试场景） |
| 用途 | 让玩家在正式比赛前测试配置，熟悉操控 |

#### TournamentMapScene

**职责**：锦标赛分支路径地图，roguelike run 的导航界面。

| 项目 | 说明 |
|------|------|
| 功能 | 展示 run 地图、选择下一节点、查看节点信息 |
| 输入数据 | TournamentRun（种子、当前节点、路径地图） |
| 输出数据 | 选中的节点 → 对应场景的初始化参数 |
| 生成逻辑 | 首次进入时由 TournamentSystem.generateTournamentMap(seed) 生成 |

#### BuildScene

**职责**：赛前飞机构建界面。

| 项目 | 说明 |
|------|------|
| 功能 | 选择飞机、装备零件、配置技能、查看属性预览 |
| 输入数据 | TournamentRun（可用飞机、已收集零件、已获技能） |
| 输出数据 | 最终飞机配置 → RaceConfig |
| UI 组件 | AirplaneBuilder（见 UI 层说明） |

#### RaceScene

**职责**：比赛飞行的核心场景，实时物理模拟。

| 项目 | 说明 |
|------|------|
| 功能 | 飞机发射、飞行控制、物理模拟、技能使用、对手 AI |
| 输入数据 | RaceConfig（飞机配置、对手列表、天气条件、赛道参数） |
| 输出数据 | RaceResult（飞行数据、得分、排名） |
| 叠加场景 | HUD 场景以 overlay 模式叠加 |
| 帧循环 | PhysicsSystem.update() → SkillSystem.updateCooldowns() → HUD.refresh() |

#### ResultScene

**职责**：比赛结算界面。

| 项目 | 说明 |
|------|------|
| 功能 | 展示排名、得分明细、奖励选择（三选一零件/金币） |
| 输入数据 | RaceResult |
| 输出数据 | 选择的奖励 → 更新 TournamentRun |
| 过渡目标 | TournamentMapScene（继续 run）或 WorldMapScene（run 结束） |

#### TournamentShopScene

**职责**：锦标赛进行中的临时商店。

| 项目 | 说明 |
|------|------|
| 功能 | 使用本次 run 获得的金币购买/升级零件 |
| 输入数据 | TournamentRun（金币、当前库存） |
| 输出数据 | 购买的零件 → 更新 TournamentRun |
| 库存生成 | 基于 run 种子 + 当前阶段确定性生成 |

---

## 4. 数据模型设计

### 核心类型定义

```typescript
// ============================================================
// 基础类型
// ============================================================

/** 飞机类型: 速度型 / 特技型 / 稳定型 */
type AirplaneType = 'speed' | 'trick' | 'stability';

/** 天气条件 */
type WeatherCondition = 'tailwind' | 'headwind' | 'crosswind' | 'storm' | 'calm';

/** 零件槽位: 机鼻 / 机翼 / 尾翼 / 涂装 / 配重 */
type PartSlot = 'nose' | 'wing' | 'tail' | 'coating' | 'weight';

/** 稀有度 */
type Rarity = 'common' | 'rare' | 'legendary';

/** 技能类型 */
type SkillType = 'active' | 'passive';

/** 触发条件类型 */
type TriggerType =
  | 'on_launch'
  | 'on_stall'
  | 'on_headwind'
  | 'on_collision'
  | 'on_trick'
  | 'on_low_speed'
  | 'on_high_altitude'
  | 'manual';

/** 锦标赛节点类型 */
type TournamentNodeType = 'race' | 'elite' | 'shop' | 'rest' | 'event' | 'boss';

/** 2D 向量 */
interface Vector2 {
  readonly x: number;
  readonly y: number;
}

// ============================================================
// 飞机相关
// ============================================================

/** 飞机五维属性 */
interface AirplaneStats {
  readonly speed: number;       // 速度 1-10
  readonly glide: number;       // 滑翔 1-10
  readonly stability: number;   // 稳定 1-10
  readonly trick: number;       // 特技 1-10
  readonly durability: number;  // 耐久 1-10
}

/** 折纸步骤 */
interface FoldingStep {
  readonly stepNumber: number;
  readonly instruction: string;    // 折法说明文本
  readonly spriteFrame: string;    // 对应的精灵帧名称
}

/** 飞机实体 */
interface Airplane {
  readonly id: string;
  readonly name: string;              // 中文名, 如 "银箭号"
  readonly nameEn: string;            // 英文名, 如 "Silver Arrow"
  readonly type: AirplaneType;
  readonly description: string;       // 飞机描述文本
  readonly baseStats: AirplaneStats;
  readonly slots: readonly PartSlot[];
  readonly specialAbility: string;    // 特殊能力描述
  readonly evolutionFrom?: string;    // 进化来源飞机 ID
  readonly foldingSteps: readonly FoldingStep[];
  readonly unlockCondition: string;   // 解锁条件描述
  readonly spriteKey: string;         // 精灵图 key
}

// ============================================================
// 零件相关
// ============================================================

/** 零件 */
interface Part {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly slot: PartSlot;
  readonly rarity: Rarity;
  readonly statModifiers: Partial<AirplaneStats>;
  readonly setId?: string;                    // 套装 ID (如 "storm_set")
  readonly synergies?: readonly string[];     // 协同零件 ID 列表
  readonly synergyBonus?: Partial<AirplaneStats>;  // 协同加成
  readonly spriteKey: string;
}

/** 套装定义 */
interface PartSet {
  readonly id: string;
  readonly name: string;
  readonly requiredParts: readonly string[];
  readonly bonusPerPiece: ReadonlyMap<number, Partial<AirplaneStats>>;
  readonly fullSetBonus: {
    readonly stats: Partial<AirplaneStats>;
    readonly specialEffect: string;
  };
}

// ============================================================
// 技能与增益
// ============================================================

/** 技能效果 */
interface SkillEffect {
  readonly type: 'stat_boost' | 'force_apply' | 'damage_reduce' | 'special';
  readonly target: 'self' | 'opponent' | 'environment';
  readonly value: Partial<AirplaneStats> | number;
  readonly duration?: number;      // 持续时间 (毫秒)
  readonly specialId?: string;     // 特殊效果标识
}

/** 技能 */
interface Skill {
  readonly id: string;
  readonly name: string;
  readonly type: SkillType;
  readonly description: string;
  readonly cooldown?: number;        // 主动技能冷却时间 (毫秒)
  readonly trigger?: TriggerType;    // 被动技能触发条件
  readonly effect: SkillEffect;
  readonly iconKey: string;
  readonly rarity: Rarity;
}

/** 增益 (Buff) */
interface Buff {
  readonly id: string;
  readonly name: string;
  readonly sourceSkillId: string;
  readonly duration: number;         // 持续时间 (毫秒)
  readonly startTime: number;        // 开始时间戳
  readonly statModifiers: Partial<AirplaneStats>;
  readonly specialEffect?: string;   // 特殊效果标识
  readonly stackable: boolean;       // 是否可叠加
  readonly iconKey: string;
}

// ============================================================
// 对手
// ============================================================

/** 对手性格, 影响 AI 行为 */
type OpponentPersonality = 'aggressive' | 'balanced' | 'cautious' | 'tricky';

/** 对手对话集 */
interface OpponentDialogues {
  readonly greeting: string;         // 赛前打招呼
  readonly onWin: string;            // 对手获胜时说的话
  readonly onLose: string;           // 对手落败时说的话
  readonly taunt: string;            // 比赛中嘲讽
  readonly respect: string;          // 对玩家表示尊重
}

/** 对手 */
interface Opponent {
  readonly id: string;
  readonly name: string;
  readonly title: string;            // 称号, 如 "风之子"
  readonly personality: OpponentPersonality;
  readonly airplane: Airplane;
  readonly equippedParts: readonly Part[];
  readonly skills: readonly Skill[];
  readonly dialogues: OpponentDialogues;
  readonly difficulty: number;       // 难度等级 1-10
  readonly spriteKey: string;
  readonly backstory: string;        // 背景故事
}

// ============================================================
// 天气
// ============================================================

/** 天气效果 */
interface WeatherEffects {
  readonly speedModifier: number;        // 速度倍率修正
  readonly glideModifier: number;        // 滑翔倍率修正
  readonly stabilityModifier: number;    // 稳定倍率修正
  readonly visibilityRange: number;      // 可见距离 (像素)
  readonly turbulenceIntensity: number;  // 湍流强度 0-1
}

/** 天气 */
interface Weather {
  readonly condition: WeatherCondition;
  readonly windDirection: Vector2;        // 归一化风向向量
  readonly windStrength: number;          // 风力强度 0-10
  readonly effects: WeatherEffects;
  readonly displayName: string;           // 天气中文名, 如 "强劲顺风"
  readonly description: string;           // 天气描述
}

// ============================================================
// 存档数据
// ============================================================

/** 玩家档案 */
interface PlayerProfile {
  readonly name: string;
  readonly createdAt: number;        // 创建时间戳
  readonly totalPlayTime: number;    // 总游戏时间 (毫秒)
  readonly totalRaces: number;
  readonly totalWins: number;
  readonly bestScore: number;
  readonly longestFlight: number;    // 最长飞行距离
}

/** 故事进度 */
interface StoryProgress {
  readonly chapter: number;
  readonly completedEvents: readonly string[];
  readonly npcRelationships: Readonly<Record<string, number>>;
  readonly unlockedLocations: readonly string[];
  readonly completedDialogues: readonly string[];
}

/** Meta 进度 (跨 run 永久升级) */
interface MetaProgress {
  readonly level: number;
  readonly experience: number;
  readonly permanentUpgrades: readonly string[];
  readonly achievements: readonly string[];
  readonly totalRunsCompleted: number;
  readonly bestTournamentRank: number;
}

/** 用户设置 */
interface GameSettings {
  readonly masterVolume: number;     // 0-1
  readonly bgmVolume: number;        // 0-1
  readonly sfxVolume: number;        // 0-1
  readonly language: 'zh-CN';
  readonly showTutorial: boolean;
  readonly autoSave: boolean;
  readonly accessibility: {
    readonly highContrast: boolean;
    readonly reducedMotion: boolean;
    readonly largeText: boolean;
  };
}

/** 完整存档数据 */
interface SaveData {
  readonly version: number;                           // 存档版本号, 用于迁移
  readonly playerProfile: PlayerProfile;
  readonly unlockedAirplanes: readonly string[];       // 已解锁飞机 ID 列表
  readonly inventory: readonly Part[];                 // 零件库存
  readonly equippedLoadout: {                          // 当前装备配置
    readonly airplaneId: string;
    readonly parts: Readonly<Record<PartSlot, string | null>>;
    readonly skills: readonly string[];
  };
  readonly storyProgress: StoryProgress;
  readonly metaProgress: MetaProgress;
  readonly currency: {
    readonly coins: number;
    readonly premiumTickets: number;                   // 锦标赛入场券
  };
  readonly settings: GameSettings;
  readonly activeTournamentRun?: TournamentRun;        // 进行中的锦标赛 run
  readonly lastSavedAt: number;                        // 最后保存时间戳
}

// ============================================================
// 锦标赛 Run
// ============================================================

/** 锦标赛节点 */
interface TournamentNode {
  readonly id: string;
  readonly type: TournamentNodeType;
  readonly position: Vector2;                  // 在地图上的位置
  readonly connections: readonly string[];      // 连接到的下一层节点 ID
  readonly difficulty: number;
  readonly rewards: readonly Reward[];
  readonly opponent?: Opponent;                // 比赛节点的对手
  readonly shopInventory?: readonly Part[];    // 商店节点的库存
  readonly eventData?: EventData;              // 事件节点的数据
}

/** 锦标赛路径地图 */
interface TournamentMap {
  readonly seed: number;
  readonly layers: readonly (readonly TournamentNode[])[];
  readonly totalLayers: number;
}

/** 奖励 */
interface Reward {
  readonly type: 'part' | 'coins' | 'skill' | 'airplane_unlock';
  readonly value: Part | number | Skill | string;
  readonly rarity: Rarity;
}

/** 事件数据 */
interface EventData {
  readonly id: string;
  readonly description: string;
  readonly choices: readonly {
    readonly text: string;
    readonly outcome: Reward | Partial<AirplaneStats>;
  }[];
}

/** 锦标赛 Run 状态 */
interface TournamentRun {
  readonly seed: number;
  readonly map: TournamentMap;
  readonly currentNodeId: string;
  readonly visitedNodeIds: readonly string[];
  readonly currentLayer: number;
  readonly collectedParts: readonly Part[];
  readonly activeBuffs: readonly Buff[];
  readonly runCoins: number;                    // 本次 run 内的金币
  readonly runSkills: readonly Skill[];          // 本次 run 获得的技能
  readonly raceResults: readonly RaceResult[];   // 本次 run 的比赛结果记录
  readonly startedAt: number;
  readonly status: 'in_progress' | 'victory' | 'defeat' | 'abandoned';
}

/** 比赛结果 */
interface RaceResult {
  readonly raceId: string;
  readonly score: number;
  readonly distance: number;
  readonly airTime: number;
  readonly trickScore: number;
  readonly ranking: number;
  readonly totalParticipants: number;
  readonly weather: Weather;
  readonly opponentScores: readonly { readonly opponentId: string; readonly score: number }[];
}
```

### 数据关系图

```
SaveData
├── PlayerProfile
├── unlockedAirplanes: string[] ──→ Airplane.id
├── inventory: Part[]
├── equippedLoadout
│   ├── airplaneId ──→ Airplane.id
│   ├── parts: Record<PartSlot, string> ──→ Part.id
│   └── skills: string[] ──→ Skill.id
├── StoryProgress
│   └── npcRelationships ──→ Opponent.id
├── MetaProgress
├── GameSettings
└── TournamentRun (可选, 进行中的 run)
    ├── TournamentMap
    │   └── TournamentNode[]
    │       ├── opponent ──→ Opponent
    │       │                └── airplane ──→ Airplane
    │       │                └── skills ──→ Skill[]
    │       └── shopInventory ──→ Part[]
    ├── collectedParts ──→ Part[]
    ├── activeBuffs ──→ Buff[]
    │                    └── sourceSkillId ──→ Skill.id
    └── raceResults ──→ RaceResult[]
                        └── weather ──→ Weather
```

---

## 5. 物理模拟设计

### 设计原则

本游戏采用简化气动模型，而非真实物理模拟。核心目标是**游戏性优先**——让玩家通过飞机属性的差异感受到不同的飞行体验，而非精确还原空气动力学。

### Matter.js 集成

使用 Matter.js 的刚体 (Bodies) 和力 (Forces) 系统作为物理计算基础。

```
Matter.Engine (物理引擎主循环)
├── Matter.World (物理世界)
│   ├── Airplane Body (飞机刚体)
│   │   ├── 质量: 基于飞机类型
│   │   ├── 惯性矩: 基于飞机形状
│   │   ├── 空气阻力: 基于 glide 属性
│   │   └── 角阻尼: 基于 stability 属性
│   ├── Ground Body (地面碰撞体)
│   ├── Obstacle Bodies (障碍物, 可选)
│   └── Wind Zone Bodies (风力区域, Sensor)
└── Gravity: { x: 0, y: 0.5 } (标准重力)
```

### 飞机属性映射到物理力

每个飞机属性直接影响物理模拟中的具体参数：

**速度 (Speed) → 初始发射力**

```typescript
function calculateLaunchForce(speedStat: number, launchPower: number): Vector2 {
  // speedStat: 1-10, launchPower: 0-1 (玩家操控的力度)
  const BASE_FORCE = 0.01;
  const SPEED_MULTIPLIER = 0.005;
  const forceMagnitude = BASE_FORCE + speedStat * SPEED_MULTIPLIER;
  return {
    x: Math.cos(launchAngle) * forceMagnitude * launchPower,
    y: Math.sin(launchAngle) * forceMagnitude * launchPower,
  };
}
```

**滑翔 (Glide) → 空气阻力系数**

滑翔属性越高，空气阻力越低，飞机能飞得更远。

```typescript
function calculateDragCoefficient(glideStat: number): number {
  // glideStat: 1-10
  // 返回阻力系数: 0.01 (高滑翔) ~ 0.05 (低滑翔)
  const MAX_DRAG = 0.05;
  const MIN_DRAG = 0.01;
  return MAX_DRAG - (glideStat - 1) * (MAX_DRAG - MIN_DRAG) / 9;
}
```

**稳定 (Stability) → 角速度阻尼**

稳定属性越高，飞机旋转的阻尼越大——更难旋转但也更不容易失控。

```typescript
function calculateAngularDamping(stabilityStat: number): number {
  // stabilityStat: 1-10
  // 返回角阻尼: 0.02 (低稳定) ~ 0.2 (高稳定)
  const MIN_DAMPING = 0.02;
  const MAX_DAMPING = 0.2;
  return MIN_DAMPING + (stabilityStat - 1) * (MAX_DAMPING - MIN_DAMPING) / 9;
}
```

**特技 (Trick) → 可施加的旋转力矩上限**

特技属性决定玩家能施加多大的旋转力矩来控制飞机姿态。

```typescript
function calculateMaxTorque(trickStat: number): number {
  // trickStat: 1-10
  // 返回最大力矩: 0.0002 ~ 0.002
  const MIN_TORQUE = 0.0002;
  const MAX_TORQUE = 0.002;
  return MIN_TORQUE + (trickStat - 1) * (MAX_TORQUE - MIN_TORQUE) / 9;
}
```

**耐久 (Durability) → 碰撞后速度损失系数**

耐久属性越高，碰撞后保留的速度越多。

```typescript
function calculateCollisionRetention(durabilityStat: number): number {
  // durabilityStat: 1-10
  // 返回碰撞后速度保留比: 0.3 (低耐久) ~ 0.9 (高耐久)
  const MIN_RETENTION = 0.3;
  const MAX_RETENTION = 0.9;
  return MIN_RETENTION + (durabilityStat - 1) * (MAX_RETENTION - MIN_RETENTION) / 9;
}
```

### 升力/阻力查表法

使用离散查表法（而非连续函数）简化升力和阻力的计算。根据飞机当前攻角 (Angle of Attack, AoA) 查表获取升力系数和阻力系数。

```typescript
/**
 * 升力/阻力系数查找表
 * key: 攻角 (度), value: { lift: 升力系数, drag: 阻力系数 }
 */
const AERO_LOOKUP_TABLE: ReadonlyMap<number, { lift: number; drag: number }> = new Map([
  // 攻角      升力    阻力
  [-10,   { lift: -0.4, drag: 0.04  }],   // 负攻角: 负升力
  [-5,    { lift: -0.2, drag: 0.025 }],
  [0,     { lift: 0.0,  drag: 0.02  }],   // 零攻角: 无升力, 最小阻力
  [5,     { lift: 0.4,  drag: 0.025 }],   // 小攻角: 升力增加
  [10,    { lift: 0.8,  drag: 0.04  }],   // 中攻角: 升力较大
  [12,    { lift: 1.0,  drag: 0.06  }],   // 最佳攻角: 升力最大
  [15,    { lift: 0.9,  drag: 0.10  }],   // 临界: 开始接近失速
  [20,    { lift: 0.5,  drag: 0.20  }],   // 失速: 升力骤降, 阻力骤增
  [30,    { lift: 0.2,  drag: 0.40  }],   // 深度失速
  [45,    { lift: 0.1,  drag: 0.60  }],   // 几乎垂直下坠
]);

/**
 * 根据攻角插值获取升力和阻力系数
 */
function getAeroCoefficients(angleOfAttack: number): { lift: number; drag: number } {
  // 将攻角限制在表的范围内
  const clampedAoA = Math.max(-10, Math.min(45, angleOfAttack));

  // 找到相邻的两个查表点, 进行线性插值
  const entries = [...AERO_LOOKUP_TABLE.entries()].sort((a, b) => a[0] - b[0]);

  for (let i = 0; i < entries.length - 1; i++) {
    const [angle1, coeff1] = entries[i];
    const [angle2, coeff2] = entries[i + 1];
    if (clampedAoA >= angle1 && clampedAoA <= angle2) {
      const t = (clampedAoA - angle1) / (angle2 - angle1);
      return {
        lift: coeff1.lift + t * (coeff2.lift - coeff1.lift),
        drag: coeff1.drag + t * (coeff2.drag - coeff1.drag),
      };
    }
  }

  // 边界情况
  return entries[entries.length - 1][1];
}
```

攻角区间行为总结：

| 攻角范围 | 升力趋势 | 阻力趋势 | 飞行状态 |
|----------|----------|----------|----------|
| -10° ~ 0° | 负升力 | 低 | 俯冲加速 |
| 0° ~ 10° | 升力增加 | 缓慢增加 | 正常爬升 |
| 10° ~ 15° | 升力最大 | 中等 | 最佳升力区间 |
| > 15° | 升力急剧下降 | 急剧增加 | **失速 (Stall)** |

### 风力影响

风力作为外力向量叠加到飞机刚体上。

```typescript
function calculateWindForce(
  weather: Weather,
  airplaneStability: number,
  position: Vector2,
  delta: number,
): Vector2 {
  // 基础风力
  const baseWindForce: Vector2 = {
    x: weather.windDirection.x * weather.windStrength * 0.001,
    y: weather.windDirection.y * weather.windStrength * 0.001,
  };

  // 稳定属性减少风力影响 (10% ~ 70% 的风力被抵消)
  const windResistance = 0.1 + (airplaneStability - 1) * 0.6 / 9;
  const effectiveWind: Vector2 = {
    x: baseWindForce.x * (1 - windResistance),
    y: baseWindForce.y * (1 - windResistance),
  };

  // 湍流: 基于天气湍流强度添加随机扰动
  const turbulence: Vector2 = {
    x: (Math.random() - 0.5) * weather.effects.turbulenceIntensity * 0.002,
    y: (Math.random() - 0.5) * weather.effects.turbulenceIntensity * 0.002,
  };

  return {
    x: (effectiveWind.x + turbulence.x) * delta,
    y: (effectiveWind.y + turbulence.y) * delta,
  };
}
```

侧风的额外效果：
- 当风向与飞机运动方向的夹角 > 45° 时，视为侧风
- 侧风产生横向力（推偏飞行轨迹）
- 侧风同时产生额外扭矩（迫使飞机旋转）
- 稳定属性减少侧风引起的扭矩

### 重力模型

```typescript
const GRAVITY_ACCELERATION = 0.5;  // Matter.js 单位

function applyGravity(body: Matter.Body, modifiers: GravityModifiers): void {
  let effectiveGravity = GRAVITY_ACCELERATION;

  // Buff 修正: 如 "轻盈之翼" buff 可临时减少 30% 重力
  effectiveGravity *= modifiers.gravityMultiplier;

  // 上升气流区域: 局部反重力力场
  if (modifiers.inUpdraft) {
    effectiveGravity -= modifiers.updraftStrength;
  }

  Matter.Body.applyForce(body, body.position, {
    x: 0,
    y: effectiveGravity * body.mass * 0.001,
  });
}
```

上升气流区域：
- 在赛道中设置不可见的 Sensor 区域
- 飞机进入该区域时，施加向上的力（抵消部分或全部重力）
- 上升气流的位置和强度由赛道配置决定
- 暴风天气下上升气流更强但更不稳定

### 每帧物理更新流程

```
每一帧 (requestAnimationFrame, 目标 60 FPS)
│
├── 1. 计算当前攻角 (angle of attack)
│      → 飞机朝向角 - 速度向量方向角
│
├── 2. 查表获取升力/阻力系数
│      → getAeroCoefficients(angleOfAttack)
│
├── 3. 计算并施加升力
│      → 方向: 垂直于速度向量
│      → 大小: liftCoeff × speed² × glideStat修正
│
├── 4. 计算并施加阻力
│      → 方向: 与速度向量相反
│      → 大小: dragCoeff × speed² × glideStat修正
│
├── 5. 施加风力
│      → calculateWindForce(weather, stability, position, delta)
│
├── 6. 施加重力
│      → applyGravity(body, modifiers)
│
├── 7. 处理玩家输入 (旋转控制)
│      → 施加扭矩 (受 trick 属性限制最大值)
│
├── 8. 碰撞检测与响应
│      → 碰撞后速度 × collisionRetention(durability)
│
├── 9. Matter.js Engine.update()
│      → 物理引擎推进一步
│
└── 10. 更新游戏状态
       → 记录飞行距离、滞空时间、检查比赛结束条件
```

---

## 6. 内容数据格式

所有预生成内容数据以 JSON 文件形式存储在 `src/data/` 目录下。以下是各数据文件的 schema 说明和示例。

### airplanes.json

存储所有纸飞机的基础数据。

**Schema 说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识符 |
| name | string | 中文名称 |
| nameEn | string | 英文名称 |
| type | AirplaneType | 飞机类型 |
| description | string | 描述文本 |
| baseStats | AirplaneStats | 五维基础属性 |
| slots | PartSlot[] | 可用零件槽位 |
| specialAbility | string | 特殊能力描述 |
| evolutionFrom | string? | 进化来源飞机 ID |
| foldingSteps | FoldingStep[] | 折纸步骤 |
| unlockCondition | string | 解锁条件描述 |
| spriteKey | string | 精灵图 key |

**JSON 示例**：

```json
{
  "airplanes": [
    {
      "id": "classic_dart",
      "name": "经典飞镖",
      "nameEn": "Classic Dart",
      "type": "speed",
      "description": "最基础的纸飞机，每个孩子的第一架。速度快但不擅长滑翔。",
      "baseStats": {
        "speed": 7,
        "glide": 4,
        "stability": 5,
        "trick": 3,
        "durability": 6
      },
      "slots": ["nose", "wing", "tail", "coating"],
      "specialAbility": "急速冲刺：发射后前 2 秒速度额外增加 20%",
      "foldingSteps": [
        { "stepNumber": 1, "instruction": "将纸张对折", "spriteFrame": "dart_step_1" },
        { "stepNumber": 2, "instruction": "将两角向中线折叠", "spriteFrame": "dart_step_2" },
        { "stepNumber": 3, "instruction": "再次将两边向中线折叠", "spriteFrame": "dart_step_3" },
        { "stepNumber": 4, "instruction": "对折，展开机翼", "spriteFrame": "dart_step_4" }
      ],
      "unlockCondition": "初始解锁",
      "spriteKey": "airplane_classic_dart"
    },
    {
      "id": "glider_king",
      "name": "滑翔之王",
      "nameEn": "Glider King",
      "type": "stability",
      "description": "宽大的机翼赋予它卓越的滑翔能力。在顺风中几乎可以永远飞行。",
      "baseStats": {
        "speed": 3,
        "glide": 9,
        "stability": 8,
        "trick": 2,
        "durability": 5
      },
      "slots": ["nose", "wing", "wing", "tail", "coating"],
      "specialAbility": "气流感应：自动微调姿态以获得最佳升力角度",
      "evolutionFrom": "basic_glider",
      "foldingSteps": [
        { "stepNumber": 1, "instruction": "将纸张横向对折再展开", "spriteFrame": "glider_step_1" },
        { "stepNumber": 2, "instruction": "将四角折向中线", "spriteFrame": "glider_step_2" },
        { "stepNumber": 3, "instruction": "翻面，再次向中线折叠", "spriteFrame": "glider_step_3" },
        { "stepNumber": 4, "instruction": "展开宽大机翼，调整翼尖", "spriteFrame": "glider_step_4" }
      ],
      "unlockCondition": "在学校完成「滑翔基础」课程",
      "spriteKey": "airplane_glider_king"
    },
    {
      "id": "acrobat",
      "name": "特技之星",
      "nameEn": "Acrobat Star",
      "type": "trick",
      "description": "灵活的小型纸飞机，可以做出华丽的空中翻转。速度不快但表演得分极高。",
      "baseStats": {
        "speed": 4,
        "glide": 5,
        "stability": 3,
        "trick": 9,
        "durability": 4
      },
      "slots": ["nose", "wing", "tail", "weight"],
      "specialAbility": "连续翻转：连续完成 3 个特技后，下一个特技得分翻倍",
      "foldingSteps": [
        { "stepNumber": 1, "instruction": "取正方形纸，对角折叠", "spriteFrame": "acrobat_step_1" },
        { "stepNumber": 2, "instruction": "沿中线反向折叠，形成菱形", "spriteFrame": "acrobat_step_2" },
        { "stepNumber": 3, "instruction": "折出小型三角翼", "spriteFrame": "acrobat_step_3" },
        { "stepNumber": 4, "instruction": "添加尾翼翘起部分", "spriteFrame": "acrobat_step_4" }
      ],
      "unlockCondition": "在公园成功完成 5 次特技飞行",
      "spriteKey": "airplane_acrobat"
    }
  ]
}
```

### parts.json

存储所有零件数据，包括属性修正值和套装信息。

**Schema 说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识符 |
| name | string | 中文名称 |
| description | string | 描述文本 |
| slot | PartSlot | 适用槽位 |
| rarity | Rarity | 稀有度 |
| statModifiers | Partial<AirplaneStats> | 属性修正值 |
| setId | string? | 所属套装 ID |
| synergies | string[]? | 协同零件 ID 列表 |
| synergyBonus | Partial<AirplaneStats>? | 协同加成 |
| spriteKey | string | 精灵图 key |

**JSON 示例**：

```json
{
  "parts": [
    {
      "id": "iron_nose_clip",
      "name": "铁质鼻夹",
      "description": "沉重的金属鼻夹，显著增加速度但降低滑翔能力。",
      "slot": "nose",
      "rarity": "common",
      "statModifiers": {
        "speed": 2,
        "glide": -1
      },
      "spriteKey": "part_iron_nose_clip"
    },
    {
      "id": "storm_wing_left",
      "name": "暴风之翼·左",
      "description": "暴风套装的一部分。在强风中获得额外稳定性。",
      "slot": "wing",
      "rarity": "rare",
      "statModifiers": {
        "stability": 2,
        "speed": 1
      },
      "setId": "storm_set",
      "synergies": ["storm_wing_right", "storm_tail"],
      "synergyBonus": {
        "stability": 1
      },
      "spriteKey": "part_storm_wing_left"
    },
    {
      "id": "golden_coating",
      "name": "黄金涂装",
      "description": "传说中的涂装，据说涂上它的飞机会被风神眷顾。全属性微量提升。",
      "slot": "coating",
      "rarity": "legendary",
      "statModifiers": {
        "speed": 1,
        "glide": 1,
        "stability": 1,
        "trick": 1,
        "durability": 1
      },
      "spriteKey": "part_golden_coating"
    },
    {
      "id": "lead_weight_small",
      "name": "小铅块",
      "description": "增加飞机重量，提高俯冲速度和耐久性，但牺牲滑翔距离。",
      "slot": "weight",
      "rarity": "common",
      "statModifiers": {
        "speed": 1,
        "durability": 2,
        "glide": -2
      },
      "spriteKey": "part_lead_weight_small"
    }
  ],
  "sets": [
    {
      "id": "storm_set",
      "name": "暴风套装",
      "requiredParts": ["storm_wing_left", "storm_wing_right", "storm_tail"],
      "bonusPerPiece": {
        "2": { "stability": 2 },
        "3": { "stability": 3, "speed": 2 }
      },
      "fullSetBonus": {
        "stats": { "stability": 3, "speed": 2 },
        "specialEffect": "暴风无畏：暴风天气中不受湍流影响"
      }
    }
  ]
}
```

### skills.json

存储所有技能数据，包括主动和被动技能。

**Schema 说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识符 |
| name | string | 中文名称 |
| type | SkillType | 主动/被动 |
| description | string | 技能描述 |
| cooldown | number? | 冷却时间 (毫秒, 仅主动) |
| trigger | TriggerType? | 触发条件 (仅被动) |
| effect | SkillEffect | 技能效果 |
| iconKey | string | 图标 key |
| rarity | Rarity | 稀有度 |

**JSON 示例**：

```json
{
  "skills": [
    {
      "id": "emergency_boost",
      "name": "紧急加速",
      "type": "active",
      "description": "瞬间释放一股强大的推力，大幅提升速度，但会消耗耐久。",
      "cooldown": 15000,
      "effect": {
        "type": "stat_boost",
        "target": "self",
        "value": { "speed": 3 },
        "duration": 2000
      },
      "iconKey": "skill_emergency_boost",
      "rarity": "common"
    },
    {
      "id": "headwind_rider",
      "name": "逆风飞翔",
      "type": "passive",
      "description": "逆风时自动获得稳定性提升，将逆境转化为优势。",
      "trigger": "on_headwind",
      "effect": {
        "type": "stat_boost",
        "target": "self",
        "value": { "stability": 2, "glide": 1 },
        "duration": 5000
      },
      "iconKey": "skill_headwind_rider",
      "rarity": "rare"
    },
    {
      "id": "phoenix_rise",
      "name": "凤凰涅槃",
      "type": "passive",
      "description": "当飞机即将失速坠落时，自动触发一次向上的强力推升。整场比赛仅触发一次。",
      "trigger": "on_stall",
      "effect": {
        "type": "force_apply",
        "target": "self",
        "value": -0.02,
        "duration": 1500,
        "specialId": "phoenix_rise_once"
      },
      "iconKey": "skill_phoenix_rise",
      "rarity": "legendary"
    }
  ]
}
```

### opponents.json

存储对手角色数据，包括 AI 配置和对话。

**Schema 说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识符 |
| name | string | 中文名称 |
| title | string | 称号 |
| personality | OpponentPersonality | 性格类型 (影响 AI) |
| airplaneId | string | 使用的飞机 ID |
| partIds | string[] | 装备的零件 ID 列表 |
| skillIds | string[] | 拥有的技能 ID 列表 |
| dialogues | OpponentDialogues | 对话集 |
| difficulty | number | 难度等级 1-10 |
| spriteKey | string | 精灵图 key |
| backstory | string | 背景故事 |

AI 性格影响行为：
- `aggressive`: 优先选择最大力度发射，倾向使用攻击性技能
- `balanced`: 平衡发射角度和力度，技能使用时机合理
- `cautious`: 偏好安全角度，优先使用防御性技能
- `tricky`: 偏好特技得分，频繁使用旋转操控

**JSON 示例**：

```json
{
  "opponents": [
    {
      "id": "wind_child_lin",
      "name": "小林",
      "title": "风之子",
      "personality": "aggressive",
      "airplaneId": "classic_dart",
      "partIds": ["iron_nose_clip", "speed_coating"],
      "skillIds": ["emergency_boost"],
      "dialogues": {
        "greeting": "哈哈，又来挑战我了？我的飞机可是最快的！",
        "onWin": "看到了吧？速度就是一切！",
        "onLose": "不可能……下次我一定加倍训练！",
        "taunt": "太慢了！吃我尾流吧！",
        "respect": "你的飞机操控技术真不错，下次再比过！"
      },
      "difficulty": 3,
      "spriteKey": "opponent_lin",
      "backstory": "隔壁班的小林，是个速度狂。他坚信纸飞机比赛只看谁飞得快，对花哨的特技嗤之以鼻。"
    },
    {
      "id": "steady_mei",
      "name": "小美",
      "title": "不动如山",
      "personality": "cautious",
      "airplaneId": "glider_king",
      "partIds": ["storm_wing_left", "storm_wing_right", "storm_tail"],
      "skillIds": ["headwind_rider"],
      "dialogues": {
        "greeting": "比赛最重要的是稳定发挥，你准备好了吗？",
        "onWin": "稳扎稳打，才是致胜之道。",
        "onLose": "看来我还需要更沉稳一些……",
        "taunt": "别急，比赛还长着呢。",
        "respect": "你的飞行轨迹很漂亮，我学到了很多。"
      },
      "difficulty": 5,
      "spriteKey": "opponent_mei",
      "backstory": "校折纸社的社长，追求完美的滑翔曲线。她收集了全套暴风套装，在恶劣天气中几乎无人能敌。"
    }
  ]
}
```

### dialogues.json

存储 NPC 对话数据，支持条件触发和分支选项。

**Schema 说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 对话唯一标识符 |
| npcId | string | 说话的 NPC ID |
| location | string | 触发地点 (场景名) |
| priority | number | 优先级 (高优先级覆盖低优先级) |
| conditions | TriggerCondition | 触发条件 |
| lines | DialogueLine[] | 对话内容行列表 |
| repeatable | boolean | 是否可重复触发 |

**JSON 示例**：

```json
{
  "dialogues": [
    {
      "id": "home_first_loss",
      "npcId": "mom",
      "location": "HomeScene",
      "priority": 10,
      "conditions": {
        "minRaces": 1,
        "maxWins": 0,
        "storyFlags": ["first_tournament_entered"],
        "notCompleted": ["home_first_loss"]
      },
      "lines": [
        {
          "speaker": "妈妈",
          "text": "回来了？比赛怎么样？",
          "emotion": "neutral"
        },
        {
          "speaker": "玩家",
          "text": "输了……",
          "emotion": "sad"
        },
        {
          "speaker": "妈妈",
          "text": "没关系的。你知道吗，爸爸当年参加纸飞机比赛，前三次都是最后一名呢。",
          "emotion": "smile"
        },
        {
          "speaker": "妈妈",
          "text": "重要的不是赢，是每次都能飞得比上次远一点点。",
          "emotion": "warm"
        },
        {
          "speaker": "玩家",
          "text": "嗯！我下次一定会更好的！",
          "emotion": "determined",
          "reward": { "type": "coins", "value": 50 }
        }
      ],
      "repeatable": false
    },
    {
      "id": "park_lin_encounter",
      "npcId": "wind_child_lin",
      "location": "ParkScene",
      "priority": 5,
      "conditions": {
        "minRaces": 3,
        "storyFlags": [],
        "notCompleted": ["park_lin_encounter"]
      },
      "lines": [
        {
          "speaker": "小林",
          "text": "哟，你也来公园练习？我正在试一种新的发射姿势。",
          "emotion": "excited"
        },
        {
          "speaker": "小林",
          "text": "要不要来一场友谊赛？我不会手下留情的哦！",
          "emotion": "grin",
          "choices": [
            { "text": "来吧！正好我也想试试新零件。", "next": "park_lin_friendly_race" },
            { "text": "改天吧，我今天想自己练练。", "next": "park_lin_decline" }
          ]
        }
      ],
      "repeatable": false
    }
  ]
}
```

### weather-presets.json

存储预设天气配置。

**Schema 说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 天气预设标识符 |
| condition | WeatherCondition | 天气类型 |
| windDirection | Vector2 | 风向向量 |
| windStrength | number | 风力强度 0-10 |
| effects | WeatherEffects | 天气效果修正 |
| displayName | string | 显示名称 |
| description | string | 描述文本 |
| weight | number | 随机选择权重 |

**JSON 示例**：

```json
{
  "weatherPresets": [
    {
      "id": "calm_day",
      "condition": "calm",
      "windDirection": { "x": 0, "y": 0 },
      "windStrength": 0,
      "effects": {
        "speedModifier": 1.0,
        "glideModifier": 1.0,
        "stabilityModifier": 1.0,
        "visibilityRange": 1000,
        "turbulenceIntensity": 0
      },
      "displayName": "风和日丽",
      "description": "晴朗无风的好天气，最适合新手练习。",
      "weight": 30
    },
    {
      "id": "gentle_tailwind",
      "condition": "tailwind",
      "windDirection": { "x": 1, "y": 0 },
      "windStrength": 3,
      "effects": {
        "speedModifier": 1.15,
        "glideModifier": 1.1,
        "stabilityModifier": 1.0,
        "visibilityRange": 900,
        "turbulenceIntensity": 0.05
      },
      "displayName": "微风顺吹",
      "description": "和煦的顺风，为你的飞行助一臂之力。",
      "weight": 25
    },
    {
      "id": "strong_headwind",
      "condition": "headwind",
      "windDirection": { "x": -1, "y": -0.2 },
      "windStrength": 7,
      "effects": {
        "speedModifier": 0.7,
        "glideModifier": 0.8,
        "stabilityModifier": 0.85,
        "visibilityRange": 700,
        "turbulenceIntensity": 0.2
      },
      "displayName": "强劲逆风",
      "description": "猛烈的逆风让飞行变得困难，但稳定型飞机能化逆境为优势。",
      "weight": 15
    },
    {
      "id": "gusty_crosswind",
      "condition": "crosswind",
      "windDirection": { "x": 0.3, "y": -0.95 },
      "windStrength": 5,
      "effects": {
        "speedModifier": 0.95,
        "glideModifier": 0.9,
        "stabilityModifier": 0.8,
        "visibilityRange": 750,
        "turbulenceIntensity": 0.3
      },
      "displayName": "阵阵侧风",
      "description": "变幻莫测的侧风，考验飞行员的操控技术。特技型飞机在此如鱼得水。",
      "weight": 15
    },
    {
      "id": "raging_storm",
      "condition": "storm",
      "windDirection": { "x": -0.7, "y": -0.7 },
      "windStrength": 9,
      "effects": {
        "speedModifier": 0.6,
        "glideModifier": 0.5,
        "stabilityModifier": 0.5,
        "visibilityRange": 300,
        "turbulenceIntensity": 0.8
      },
      "displayName": "狂风暴雨",
      "description": "极端恶劣天气！只有最坚固的飞机和最勇敢的飞行员才敢在此出战。",
      "weight": 5
    }
  ]
}
```

### 数据文件总览

| 文件 | 预期条目数 | 大小估算 (gzip) | 更新频率 |
|------|-----------|----------------|----------|
| airplanes.json | 30-50 架 | ~15 KB | 低 (版本更新) |
| parts.json | 100-150 个 | ~20 KB | 中 (版本更新) |
| skills.json | 50-80 个 | ~10 KB | 中 (版本更新) |
| opponents.json | 20-30 个 | ~15 KB | 低 (版本更新) |
| dialogues.json | 200-300 段 | ~30 KB | 高 (内容更新) |
| weather-presets.json | 10-15 种 | ~2 KB | 低 (几乎不变) |
| **合计** | — | **~92 KB** | — |

所有数据文件合计 gzip 后约 92 KB，远在 500 KB 的性能预算之内。

---

## 7. 状态管理方案

### 设计原则

采用简单的事件驱动架构，不引入额外的状态管理库（如 Redux、MobX）。理由如下：

1. **游戏规模适中**：核心状态集中在 SaveData 和 TournamentRun 两个结构体中，复杂度可控
2. **Phaser 生态兼容**：Phaser 内置 EventEmitter 和 Registry 已能满足需求
3. **减少依赖**：保持技术栈精简，降低包体积
4. **性能优先**：避免状态管理库带来的额外序列化/反序列化开销

### 全局游戏状态：GameState 单例

```typescript
class GameState {
  private static instance: GameState;

  private currentSaveData: SaveData;
  private currentRun: TournamentRun | null;
  private readonly emitter: Phaser.Events.EventEmitter;

  private constructor() {
    this.emitter = new Phaser.Events.EventEmitter();
    this.currentRun = null;
  }

  static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  // 状态读取 (返回不可变引用)
  getSaveData(): Readonly<SaveData> { ... }
  getCurrentRun(): Readonly<TournamentRun> | null { ... }

  // 状态更新 (创建新对象, 不可变更新)
  updateSaveData(updater: (prev: SaveData) => SaveData): void {
    this.currentSaveData = updater(this.currentSaveData);
    this.emitter.emit('saveDataChanged', this.currentSaveData);
  }

  updateRun(updater: (prev: TournamentRun) => TournamentRun): void {
    if (this.currentRun) {
      this.currentRun = updater(this.currentRun);
      this.emitter.emit('runChanged', this.currentRun);
    }
  }

  // 事件订阅
  on(event: string, callback: Function): void { ... }
  off(event: string, callback: Function): void { ... }
}
```

### 事件系统

使用 Phaser.Events.EventEmitter 作为游戏事件总线。

**核心事件列表**：

| 事件名 | 触发时机 | 携带数据 |
|--------|----------|----------|
| `saveDataChanged` | 存档数据更新 | `SaveData` |
| `runChanged` | 锦标赛 run 状态更新 | `TournamentRun` |
| `raceStarted` | 比赛开始 | `RaceConfig` |
| `raceEnded` | 比赛结束 | `RaceResult` |
| `skillActivated` | 技能激活 | `{ skill: Skill, target: string }` |
| `buffApplied` | Buff 生效 | `Buff` |
| `buffExpired` | Buff 过期 | `Buff` |
| `itemAcquired` | 获得物品 | `Part \| Skill` |
| `airplaneUnlocked` | 解锁新飞机 | `Airplane` |
| `dialogueTriggered` | 对话触发 | `Dialogue` |
| `weatherChanged` | 天气变化 | `Weather` |
| `nodeSelected` | 锦标赛节点选择 | `TournamentNode` |

### 场景间数据传递

场景切换时通过 Phaser 的 scene data 机制传递初始化数据。

```typescript
// 从 TournamentMapScene 切换到 BuildScene
this.scene.start('BuildScene', {
  tournamentRun: GameState.getInstance().getCurrentRun(),
  availableParts: GameState.getInstance().getSaveData().inventory,
  nextOpponent: selectedNode.opponent,
});

// BuildScene 中接收数据
create(data: BuildSceneData): void {
  const { tournamentRun, availableParts, nextOpponent } = data;
  // 初始化 UI ...
}
```

对于需要跨场景持久存在的数据（如音频播放状态），使用 Phaser 的 `this.registry`：

```typescript
// 设置
this.registry.set('bgmPlaying', true);

// 读取 (任意场景)
const isBgmPlaying = this.registry.get('bgmPlaying');

// 监听变化
this.registry.events.on('changedata-bgmPlaying', (parent, value) => {
  // 响应变化
});
```

### 状态生命周期

```
游戏启动
│
├── SaveManager.loadGame()
│   └→ GameState.initialize(savedData)
│
├── 城镇阶段
│   ├── 各场景通过 GameState 读写 SaveData
│   └── 场景切换时通过 scene data 传递局部数据
│
├── 锦标赛阶段
│   ├── TournamentSystem 生成 TournamentRun
│   ├── GameState.setCurrentRun(run)
│   ├── 每场比赛结果更新 TournamentRun
│   └── Run 结束 → 奖励写入 SaveData → 清除 TournamentRun
│
├── 自动存档触发点
│   ├── 场景切换时
│   ├── 比赛结束时
│   ├── 物品获取时
│   └── 回到 HomeScene 时
│
└── 游戏退出
    └── SaveManager.saveGame(GameState.getSaveData())
```

### 状态不可变性保证

所有状态更新严格遵循不可变原则：

```typescript
// 正确: 创建新对象
function addPartToInventory(saveData: SaveData, newPart: Part): SaveData {
  return {
    ...saveData,
    inventory: [...saveData.inventory, newPart],
  };
}

// 正确: 更新嵌套对象
function updateStoryProgress(saveData: SaveData, eventId: string): SaveData {
  return {
    ...saveData,
    storyProgress: {
      ...saveData.storyProgress,
      completedEvents: [...saveData.storyProgress.completedEvents, eventId],
    },
  };
}
```

---

## 8. PWA/离线架构

### 整体策略

纸翼传说作为完全离线可玩的 PWA 游戏，采用 Service Worker + IndexedDB 的组合方案。目标是首次加载后，玩家在任何网络环境下都能畅玩。

### Service Worker 缓存策略

```
┌─────────────────────────────────────────────────────────┐
│                  Service Worker                         │
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │  静态资源            │  │  游戏数据 JSON           │  │
│  │  Cache First         │  │  Cache First             │  │
│  │                     │  │  + Network Fallback       │  │
│  │  - index.html       │  │                           │  │
│  │  - *.js (bundle)    │  │  - airplanes.json         │  │
│  │  - *.css            │  │  - parts.json             │  │
│  │  - sprites/*.png    │  │  - skills.json            │  │
│  │  - audio/*.mp3      │  │  - opponents.json         │  │
│  │  - fonts/*          │  │  - dialogues.json         │  │
│  │                     │  │  - weather-presets.json    │  │
│  └─────────────────────┘  └─────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  更新检测: Background Sync                       │    │
│  │  - 每次启动时检查版本号                            │    │
│  │  - 发现新版本 → 后台下载 → 提示用户刷新            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Cache First 策略 (静态资源)**

优先从缓存读取，缓存未命中时才请求网络。适用于不经常变化的静态资源。

```typescript
// Service Worker: 静态资源缓存策略
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // 静态资源: Cache First
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const cache = await caches.open(STATIC_CACHE_NAME);
          cache.put(event.request, response.clone());
          return response;
        });
      })
    );
  }
});
```

**Cache First + Network Fallback (游戏数据)**

与静态资源策略相同，但在网络可用时，后台静默更新缓存，确保下次启动时使用最新数据。

```typescript
// Service Worker: 游戏数据缓存策略
if (isGameData(url)) {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 无论是否命中缓存, 都在后台尝试更新
      const fetchPromise = fetch(event.request).then((response) => {
        const cache = await caches.open(DATA_CACHE_NAME);
        cache.put(event.request, response.clone());
        return response;
      });

      // 优先返回缓存, 缓存未命中时等待网络
      return cached || fetchPromise;
    })
  );
}
```

**Background Sync (更新检测)**

应用启动时检查服务端的版本文件，发现新版本后通知用户。

```typescript
// 版本检查
async function checkForUpdate(): Promise<void> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    const remote = await response.json();
    const local = await getLocalVersion();

    if (remote.version !== local.version) {
      // 后台下载新版本资源
      await caches.delete(STATIC_CACHE_NAME);
      await precacheStaticAssets(remote.assets);

      // 通知主线程
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: remote.version,
            changelog: remote.changelog,
          });
        });
      });
    }
  } catch {
    // 网络不可用, 静默跳过
  }
}
```

### IndexedDB 存储结构

通过 Dexie.js 封装 IndexedDB，定义三个 store：

```
IndexedDB: "paper_wings_legend"
│
├── Store: "saves"
│   ├── key: "main_save"  →  SaveData (完整存档)
│   ├── key: "auto_save"  →  SaveData (自动存档)
│   └── key: "backup"     →  SaveData (上一次的备份)
│
├── Store: "settings"
│   └── key: "game_settings"  →  GameSettings
│
└── Store: "cache"
    ├── key: "content_airplanes"   →  Airplane[] (解析后的缓存)
    ├── key: "content_parts"       →  Part[]
    ├── key: "content_skills"      →  Skill[]
    ├── key: "content_opponents"   →  Opponent[]
    ├── key: "content_dialogues"   →  Dialogue[]
    ├── key: "content_weather"     →  WeatherPreset[]
    └── key: "daily_seed_cache"    →  { date: string, seed: number }
```

**Dexie.js 初始化配置**：

```typescript
import Dexie, { type Table } from 'dexie';

class GameDatabase extends Dexie {
  saves!: Table;
  settings!: Table;
  cache!: Table;

  constructor() {
    super('paper_wings_legend');
    this.version(1).stores({
      saves: 'key',       // 主存档/自动存档/备份（key: "main_save" | "auto_save" | "backup"）
      settings: 'key',    // 用户设置（key: "game_settings"）
      cache: 'key',       // 运行时缓存（key: "content_*" | "daily_seed_cache"）
    });
  }
}

export const db = new GameDatabase();
```

**存储容量规划**：

| Store | 预估单条数据大小 | 预估总条数 | 预估总大小 |
|-------|----------------|-----------|-----------|
| saves | ~50 KB | 3 (主存档/自动/备份) | ~150 KB |
| settings | ~1 KB | 1 | ~1 KB |
| cache | ~100 KB | 7 | ~700 KB |
| **合计** | — | — | **~851 KB** |

IndexedDB 在现代浏览器中通常允许至少 50 MB 的存储空间，当前设计远在限额之内。

### manifest.json 配置

```json
{
  "name": "纸翼传说 - Paper Wings Legend",
  "short_name": "纸翼传说",
  "description": "2D像素风roguelike纸飞机竞速游戏",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#1a1a2e",
  "theme_color": "#e94560",
  "categories": ["games"],
  "icons": [
    {
      "src": "/assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/assets/screenshots/gameplay.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "比赛飞行画面"
    }
  ],
  "related_applications": [],
  "prefer_related_applications": false
}
```

配置要点说明：
- `display: "fullscreen"`: 游戏全屏显示，隐藏浏览器 UI
- `orientation: "landscape"`: 强制横屏，适合飞行游戏的视野
- `background_color`: 与游戏加载背景色一致，避免白屏闪烁
- `icons` 包含 `maskable` 用途，适配各平台的自适应图标
- `categories: ["games"]`: 标记为游戏类应用

### 更新机制

```
玩家打开游戏
│
├── Service Worker 激活
│   └── 后台检查 /version.json
│
├── [有新版本]
│   ├── Service Worker 后台下载新资源
│   ├── 下载完成 → postMessage 通知主线程
│   ├── 主线程显示更新提示:
│   │   "发现新版本 v1.2.0! 点击刷新以更新"
│   │   [立即更新] [稍后再说]
│   │
│   ├── [立即更新]
│   │   ├── 保存当前游戏进度
│   │   ├── 激活新 Service Worker
│   │   └── 刷新页面
│   │
│   └── [稍后再说]
│       └── 继续使用旧版本, 下次启动再提示
│
└── [无新版本]
    └── 正常启动游戏
```

更新原则：
- 永远不在比赛中途强制更新
- 更新下载在后台静默进行，不影响当前游戏体验
- 存档格式需要向后兼容，通过 `SaveData.version` 字段进行迁移
- 如果新版本需要数据迁移，在更新后首次启动时自动执行

### 离线降级策略

| 功能 | 在线 | 离线 |
|------|------|------|
| 核心游戏 | 正常 | 正常 (完全可玩) |
| 存档保存/加载 | 正常 | 正常 (IndexedDB) |
| 每日挑战种子 | 从服务器获取 | 基于本地日期生成 |
| 版本更新 | 自动检查 | 跳过检查 |
| 数据同步 | 未来可能支持 | 不可用 |
| 排行榜 | 未来可能支持 | 仅本地记录 |

---

## 附录：项目文件结构参考

```
src/
├── scenes/                    # Phaser 场景
│   ├── BootScene.ts           # 最小化初始加载
│   ├── PreloadScene.ts        # 资源预加载
│   ├── MainMenuScene.ts       # 主菜单
│   ├── WorldMapScene.ts       # 城镇大地图
│   ├── HomeScene.ts           # 家 (存档/对话)
│   ├── SchoolScene.ts         # 学校 (解锁飞机)
│   ├── ShopScene.ts           # 小卖部 (购买零件)
│   ├── ParkScene.ts           # 公园 (NPC交流)
│   ├── MountainScene.ts       # 后山 (试飞场)
│   ├── TournamentMapScene.ts  # 锦标赛路径地图
│   ├── TournamentShopScene.ts # 赛间商店
│   ├── BuildScene.ts          # 赛前构建
│   ├── RaceScene.ts           # 比赛飞行
│   └── ResultScene.ts         # 比赛结算
├── entities/                  # 游戏实体类
│   ├── Airplane.ts
│   ├── Part.ts
│   ├── Skill.ts
│   ├── Buff.ts
│   ├── Opponent.ts
│   └── Weather.ts
├── systems/                   # 游戏系统 (无状态逻辑)
│   ├── PhysicsSystem.ts       # 物理模拟
│   ├── RaceSystem.ts          # 比赛逻辑
│   ├── ProgressSystem.ts      # 存档/meta进度
│   ├── SkillSystem.ts         # 技能/buff管理
│   ├── WeatherSystem.ts       # 天气生成/影响
│   ├── NarrativeSystem.ts     # 叙事/对话
│   ├── TournamentSystem.ts    # 锦标赛管理
│   └── ContentGenerator.ts    # 运行时内容生成
├── ui/                        # UI 组件
│   ├── HUD.ts                 # 飞行中信息
│   ├── AirplaneBuilder.ts     # 飞机构建界面
│   ├── Aerodex.ts             # 图鉴/收藏
│   ├── DialogBox.ts           # NPC 对话框
│   └── TournamentMap.ts       # 锦标赛地图UI
├── data/                      # 预生成 JSON 数据
│   ├── airplanes.json
│   ├── parts.json
│   ├── skills.json
│   ├── buffs.json
│   ├── opponents.json
│   ├── dialogues.json
│   └── weather-presets.json
├── types/                     # TypeScript 类型定义
│   └── index.ts
├── utils/                     # 工具函数
│   ├── math.ts
│   ├── SaveManager.ts
│   ├── ContentLoader.ts
│   ├── ConfigManager.ts
│   ├── InputManager.ts
│   ├── SeedManager.ts
│   └── GameState.ts
└── main.ts                    # 入口文件
```

---

## 附录：已确认技术决策

以下决策在项目初始化阶段（2026-04-07）讨论确认，作为后续实施基准。如有变更请更新本附录。

| 项目 | 决策 | 备注 |
|------|------|------|
| Phaser 版本 | Phaser 3 (v3.87+) | 不建抽象层，不预留 Phaser 4 升级路径 |
| 内部分辨率 | 480×270 | 配合 32px tiles，支持中文 UI；整数倍缩放至 960×540 / 1920×1080 |
| IndexedDB 库 | Dexie.js | 支持 schema 版本迁移和索引查询（Phase 2 引入） |
| 物理重力 | 可配置常量，默认 y=0.5 | 纸飞机轻物体，低重力提供更好滑翔手感 |
| 物理 API | Phaser MatterPhysics 插件 | 不直接使用 Matter.js 原生 API，与 Phaser 场景深度集成 |
| 测试策略 | Vitest 纯逻辑 + Playwright MCP 视觉验证 | 80% 覆盖率仅限 src/systems/ + src/utils/ |
| 原型美术 | 纯 Phaser Graphics API | 验证物理手感阶段零外部资源依赖 |
| PWA | 延后到 Phase 5 | 避免 Service Worker 干扰开发时 HMR |
| 场景（初始） | 5 个核心场景 | Boot, Preload, MainMenu, Race, Result |
| 发射交互 | 拖拽弹弓式 | 拖拽方向决定角度，距离决定力度 |
| 飞行控制 | 轻触屏幕上/下半区 | 上半区抬头，下半区压头，微调攻角 |
| 赛道视角 | 横向滚动 + 相机跟随 + 视差背景 | 3 层视差（远景 0.1x / 中景 0.3x / 近景 1.0x）|
