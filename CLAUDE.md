# Paper Wings Legend — Agent Development Guide

## Project Overview

**Paper Wings Legend** (纸翼传说) is a 2D pixel-art roguelike paper airplane racing game running in mobile and desktop browsers.

**Tech Stack**: Phaser 3/4 + TypeScript + Vite + Matter.js + IndexedDB + PWA

**Target**: Static deployment (GitHub Pages / Netlify), fully offline-capable.

**Key docs**: [architecture](docs/architecture.md) | [game-design](docs/game-design.md) | [tech-stack](docs/tech-stack.md) | [art-design](docs/art-design.md)

## Mandatory Workflow Rules

Every Agent session MUST follow these rules. Violations will result in rejected work.

### 1. Code Review (MANDATORY)

After completing ANY code change, Agent MUST:
- Run the **code-reviewer** agent on all modified files
- Fix all CRITICAL and HIGH severity issues before proceeding

### 2. Test-Driven Development (MANDATORY)

1. Write test first (RED) — test MUST fail
2. Implement minimal code (GREEN) — test MUST pass
3. Refactor (IMPROVE) — tests MUST still pass
4. Verify coverage >= 80% (`pnpm test:coverage`)

### 3. Visual Verification via Playwright MCP (MANDATORY)

After implementing ANY visual or interactive feature, Agent MUST verify using Playwright MCP:

1. Start dev server (`pnpm dev`) in background if not running
2. `browser_navigate` → `http://localhost:5173`
3. `browser_take_screenshot` / `browser_snapshot` to verify rendering
4. `browser_click` / `browser_type` to test interactions
5. `browser_console_messages` to check for JS errors
6. If verification fails, fix and re-verify

**Must verify**: new scenes, UI changes, visual effects, navigation flows, responsive layout.

### 4. Documentation Updates (MANDATORY)

After completing work, Agent MUST update:
- **ROADMAP.md** — mark completed items, add discovered items
- **CHANGELOG.md** — add entry under `[Unreleased]`
- Related docs in `docs/` if the change affects design, architecture, or art specs

### 5. Security Check (MANDATORY)

Before any commit: no hardcoded secrets, all inputs validated, no `eval()`/`innerHTML` with untrusted data, error messages don't leak internals.

### 6. Git Commit Convention

Format: `<type>: <description>` — Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## Code Style

- **Strict TS**: `"strict": true`, all functions typed, NO `any`, prefer `readonly`
- **Immutability**: ALWAYS spread/copy, NEVER mutate (`{ ...obj, field: newVal }`)
- **Files**: one class/module per file, max 400 lines (800 absolute max), functions max 50 lines
- **Naming**: `PascalCase.ts` classes, `camelCase.ts` utils, `UPPER_SNAKE_CASE` constants, `*Scene` suffix for Phaser scenes
- **Imports**: external → internal → types

## Architecture Reference

> File structure, data models (TypeScript interfaces), scene flow, and content generation pipeline are defined in [docs/architecture.md](docs/architecture.md). Read it before implementing any feature.

Key directories: `src/scenes/`, `src/entities/`, `src/systems/`, `src/ui/`, `src/data/`

## Build & Deploy

```bash
pnpm dev              # Dev server with HMR
pnpm test             # Run all tests
pnpm test:coverage    # Tests with coverage (must be >= 80%)
pnpm build            # Production build
pnpm preview          # Preview production build
```

## Testing Strategy

```
Implementation → Unit Test → Visual Verification (Playwright MCP) → Code Review → Commit
```

- **Unit/Integration**: Vitest — game logic, systems, entities
- **E2E**: Playwright — critical user flows
- **Visual**: Playwright MCP — real-time browser verification during development
- **Coverage**: 80% minimum

## Language Policy

- Game UI: 中文 | Code identifiers: English | Comments: 中文 allowed | Docs: 中文 (CLAUDE.md in English)
- Technical terms keep English originals (roguelike, PWA, IndexedDB, etc.)
