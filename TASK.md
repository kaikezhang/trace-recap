# ⚠️ DO NOT MERGE ANY PR. Create the PR and stop.

## Current Task: Album Redesign Phase 1

**Read the full implementation plan:** `docs/superpowers/plans/2026-04-01-album-redesign-phase1.md`

**Read the design spec:** `docs/superpowers/specs/2026-04-01-album-redesign-design.md`

### Summary

Replace the current flat white album pin with a textured, multi-style album book featuring:

1. **4 album style skins** — Vintage Leather, Japanese Minimal, Classic Hardcover, Travel Scrapbook
2. **SVG noise paper textures** (zero external image assets, all CSS + inline SVG)
3. **Grid-based photo layout** within album pages (left/right pages, responsive grid)
4. **Simplified state flow** — remove `album-closed` state, go directly from collecting → 300ms hold → visited
5. **Album Style selector** in TopToolbar Settings panel
6. **New types**: `AlbumStyle`, `PhotoFrameStyle` (frame style visuals are Phase 2, just add the type now)

### Implementation Order

Follow the plan step by step:
1. Type definitions + album style configs (`src/types/index.ts`, `src/lib/albumStyles.ts`)
2. PaperTexture component (`src/components/editor/PaperTexture.tsx`)
3. State management — uiStore + animationStore updates
4. AlbumBook component (`src/components/editor/AlbumBook.tsx`)
5. Update ChapterPin + ChapterPinsOverlay (integrate AlbumBook, remove album-closed)
6. Settings UI — Album Style in TopToolbar
7. Update animation engine timing (skip closed, direct to visited)
8. Final integration + create PR

### Key Rules
- ⚠️ **DO NOT MERGE.** Create the PR and stop.
- Run `npx tsc --noEmit` after each task to verify compilation
- Create feature branch `feat/album-redesign-phase1`
- Commit after each task with descriptive messages
- Keep all existing functionality working — this is additive
