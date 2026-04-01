# ⚠️ DO NOT MERGE ANY PR. Create the PR and stop. DO NOT MERGE.

## Current Task: Album Redesign Phase 2 — Frame Styles + Settings Reorganization

### Overview

Add 5 photo frame styles to the album system and reorganize the PhotoLayoutEditor settings panel into collapsible groups.

### Part A: Photo Frame Styles

Add a new global setting `photoFrameStyle` (already exists in uiStore from Phase 1) with 5 visual styles applied to photos inside the album grid AND during PhotoOverlay display.

**Frame styles to implement:**

1. **Polaroid** (default) — White border: top/left/right 6%, bottom 18% of photo size. Caption area in bottom using Caveat font. Subtle shadow. Slight random rotation ±2° seeded by photo index.
2. **Borderless** — No border, 4px border-radius. Subtle inner shadow vignette: `inset 0 0 8px rgba(0,0,0,0.06)`.
3. **Film Strip** — Top and bottom: dark strips with repeating square perforations. CSS `repeating-linear-gradient` on pseudo-elements.
4. **Classic Border** — Uniform white border: 5% all sides. Clean, no rotation. Subtle shadow.
5. **Rounded Card** — 12px border-radius, 4% white border, prominent soft shadow.

**Where frame styles apply:**
- `AlbumBook.tsx` — photos in the grid get framed
- `PhotoOverlay.tsx` — photos during normal display (before collection) also get framed

**Implementation approach:**
- Create `src/lib/frameStyles.ts` — config objects for each frame style (border sizes, shadows, border-radius, etc.)
- Create `src/components/editor/PhotoFrame.tsx` — wrapper component that applies frame style around a photo `<img>`
- Use `PhotoFrame` in both `AlbumBook` grid cells and `PhotoOverlay` photo rendering
- Load Google Font "Caveat" for Polaroid caption area

### Part B: Frame Style Selector in PhotoLayoutEditor

Add a "Frame Style" selector in the left panel of PhotoLayoutEditor, right after "Photo Style":
- 5 horizontal pill buttons (same pattern as Photo Style selector)
- Icons: use Square for Polaroid, Image for Borderless, Film for Film Strip, Camera for Classic Border, Layers for Rounded Card (from lucide-react)
- Read/write from `useUIStore` `photoFrameStyle` / `setPhotoFrameStyle`

### Part C: Settings Panel Reorganization

The left panel currently has many flat settings. Reorganize into collapsible groups using `<details>`/`<summary>` or a custom collapsible:

**Group 1: Layout** (default open)
- Layout template selector (grid, collage, etc.)
- Refresh random button (when applicable)

**Group 2: Style** (default open)
- Photo Style (classic, kenburns, bloom, portal)
- Frame Style (NEW — polaroid, borderless, film-strip, classic-border, rounded-card)
- Caption Style (font, size)

**Group 3: Animation** (default closed)
- In Animation
- Out Animation
- Scene Transition

Apply the same grouping to mobile layout too.

### Implementation Files

**New files:**
- `src/lib/frameStyles.ts` — frame style configs
- `src/components/editor/PhotoFrame.tsx` — frame wrapper component

**Modified files:**
- `src/components/editor/AlbumBook.tsx` — wrap grid photos with `PhotoFrame`
- `src/components/editor/PhotoOverlay.tsx` — wrap displayed photos with `PhotoFrame`
- `src/components/editor/PhotoLayoutEditor.tsx` — add Frame Style selector + reorganize into collapsible groups
- `src/app/layout.tsx` — add Google Font "Caveat" import (or use `next/font/google`)

### Rules
- ⚠️ **DO NOT MERGE.** Create a PR on `feat/album-redesign-phase2` and stop.
- Run `npx tsc --noEmit` before committing
- Commit after each logical unit
- Keep all existing functionality working
- Use existing UI patterns (pill buttons, indigo active state, etc.)
