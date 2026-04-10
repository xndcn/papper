# 变更日志 (Changelog)

本文档遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式。

## [Unreleased]

### 新增
- 项目文档体系：README.md、CLAUDE.md、技术选型、游戏设计、系统架构、美术设计文档
- 开发路线图 (ROADMAP.md)
- 变更日志 (CHANGELOG.md)
- 项目初始化技术决策确认（修正文档矛盾，统一实施基准）：
  - 确认 Phaser 3 (v3.87+) 作为游戏框架（不建 Phaser 4 升级抽象层）
  - 确认内部分辨率 480×270（修正 architecture.md / tech-stack.md 中的 320×180 错误）
  - 确认 Dexie.js 作为 IndexedDB 封装库（修正 architecture.md 中的 localForage 引用）
  - 确认 Matter.js 重力默认值 y=0.5（修正 tech-stack.md 中的 y=1 错误）
  - 确认 ESLint v9 flat config + Prettier 代码质量工具链
  - 确认分层测试策略：Vitest 测纯逻辑（systems/ + utils/）+ Playwright MCP 视觉验证
  - 细化 5 步实施路线：脚手架 → 场景框架 → 物理发射 → 飞行计分 → 测试文档
- 项目初始化 Step 1 工程脚手架：
  - 新增 pnpm + Phaser 3 + Vite + TypeScript 工程配置与 lockfile
  - 新增 strict `tsconfig.json`、`vite.config.ts`、`vitest.config.ts`
  - 新增 ESLint v9 flat config、Prettier 与基础 `.gitignore`
  - 新增 `index.html`、`src/main.ts` 与 480×270 空白 Phaser 画布初始化
  - 新增 `src/utils/gameSettings.ts` 及其 Vitest 单元测试，覆盖率 100%
  - 完成 `pnpm lint`、`pnpm test:coverage`、`pnpm build` 与浏览器截图验证
