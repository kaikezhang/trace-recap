# CLAUDE.md — TraceRecap Project

## Project Overview
TraceRecap: web app that turns travel routes into beautiful animated short videos.
Next.js 14+ / TypeScript / Tailwind CSS / shadcn/ui / Mapbox GL JS v3 / Zustand / FFmpeg.wasm

## Architecture
- `src/engine/` — Animation engine (AnimationEngine, CameraController, IconAnimator, RouteGeometry, VideoExporter)
- `src/stores/` — Zustand stores (projectStore, animationStore, uiStore)
- `src/components/editor/` — Editor UI components
- `src/app/api/` — API routes (geocode, directions, AI route generation)
- `src/types/` — TypeScript types

## Current Task
Read `TASK.md` for the current task specification.

## Rules
- ⚠️ **DO NOT MERGE ANY PR.** Create the PR and stop.晚晚 will handle merging.
- ⚠️ **DO NOT MERGE.** This is repeated because it's critical.
- Create a feature branch, commit your work, push, and open a PR. That's it.
- Write clean TypeScript with proper types. No `any`.
- All existing files that aren't being modified should remain untouched.
- Keep imports clean — no unused imports.
- Test your changes compile: `npx tsc --noEmit` before committing.
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`

## Code Style
- Functional React components with hooks
- Zustand for state management
- Tailwind CSS for styling
- shadcn/ui components where available
- ESM imports, no require()

## Branch Naming
- `feat/description` for features
- `fix/description` for bug fixes
- `refactor/description` for refactors
