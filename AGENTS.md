# AGENTS.md — TraceRecap (for Codex)

## Project
TraceRecap: web app turning travel routes into animated short videos.
Stack: Next.js 14+ / TypeScript / Tailwind / shadcn/ui / Mapbox GL JS v3 / Zustand / FFmpeg.wasm

## Current Task
Read `TASK.md` for the current task specification.

## Rules
- ⚠️ **DO NOT MERGE ANY PR.** Create PR and stop.
- Create feature branch, commit, push, open PR. That's it.
- `npx tsc --noEmit` and `npm run build` must pass before opening PR.
- Clean TypeScript, no `any`, no unused imports.
- Conventional commits: `feat:`, `fix:`, `refactor:`

## Architecture
- `src/engine/` — Core animation engine
- `src/stores/` — Zustand state stores
- `src/components/editor/` — Editor UI
- `src/app/api/` — API routes (don't touch)
- `src/types/` — TypeScript types
