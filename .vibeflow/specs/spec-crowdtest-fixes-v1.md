# CrowdTest Fixes v1 — P0 + P1 Issues

## Context
5-persona CrowdTest identified 9 P0/P1 issues across Desktop, Mobile (iPhone), Laptop, and Tablet (iPad).

## Wave 0 — P0 Critical Fixes (晚晚 direct, quick wins)
### task-01: Demo auto-play when entering via Watch Demo (#137)
- When URL has `?demo=true` or route is `/editor?demo=true`, auto-start playback after 1s delay
- Add brief visual cue (3-2-1 countdown or immediate start with fade-in)
- File: `src/components/editor/EditorLayout.tsx` (useEffect on mount)

### task-02: Export resolution labels dynamic (#138)  
- Compute actual output dimensions from current aspect ratio
- Replace hardcoded "1920×1080" with dynamic "{width}×{height}" based on selected ratio
- File: `src/components/export/ExportDialog.tsx`

## Wave 1 — P0 Features + P1 Fixes (Codex parallel)
### task-03: Share/Copy Link button (#136)
- Add Share button in editor header toolbar
- On click: copy current URL to clipboard + show success toast
- If Web Share API available (mobile), use native share sheet
- Files: `src/components/editor/TopToolbar.tsx`, `src/stores/uiStore.ts`

### task-04: Fix undo catastrophic reset (#135)
- Current undo reverts to initial empty state instead of last action
- Implement granular undo: each field edit, stop add/remove, and stop reorder should be separate undo steps
- Show toast on undo: "Undid: [action description]"
- Files: `src/stores/projectStore.ts` (undo/redo stack), `src/components/editor/EditorLayout.tsx`

### task-05: Fix playback hint overlay pointer-events (#139)
- The "Click to play" hint should not block map interaction
- Make hint auto-dismiss after 3s or on first click
- Ensure map zoom/pan controls remain clickable during playback
- Files: `src/components/editor/PlaybackOverlay.tsx` or similar

### task-06: Mobile touch targets ≥ 44px (#140)
- Audit all interactive elements at 390px viewport
- Enforce min 44×44px hit areas: Menu, Reset, Pause, Export Close, bottom sheet controls
- Use CSS `min-height: 44px; min-width: 44px;` with appropriate padding
- Files: `src/components/editor/*.tsx`, `src/app/globals.css`

## Wave 2 — P1 UX Improvements (Codex parallel)
### task-07: Edit stop discoverability (#141)
- Add visible "Edit" icon/button on each stop card
- Or: make stop title visibly editable (inline input) when card is expanded
- Add first-time onboarding tooltip: "Tap a stop to edit it"
- Files: `src/components/editor/StopCard.tsx` or `JourneyTimeline.tsx`

### task-08: Export dialog — add aspect ratio + music info (#142)
- Show current aspect ratio in export dialog (read-only or changeable)
- Show music status (on/off, track name if applicable)
- If not changeable in dialog, add clear note: "Set in editor toolbar"
- Files: `src/components/export/ExportDialog.tsx`

### task-09: Immersive playback mode — collapse sidebar (#143)
- Add "Cinema mode" / fullscreen-like button that hides sidebar during playback
- Tablet breakpoint: auto-collapse sidebar when playback starts
- Show small expand button to restore sidebar
- Files: `src/components/editor/EditorLayout.tsx`, `src/stores/uiStore.ts`

## Budget
- **Model**: 💎 Production
- **Agents**: Codex primary, CC for task-04 (undo is architecturally complex)
- **Estimated**: 9 tasks, 3 waves, ~60-90 min
