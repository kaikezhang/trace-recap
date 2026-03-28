# TASK-FIX.md — Address PR #7 Review Findings

## ⚠️ DO NOT MERGE. Push fixes to the existing PR branch and stop.

## Context
PR #7 (feat/d8-mobile-swipe-polish or whatever the branch is) got 4 review findings from Codex. Fix all of them on the same branch and push.

## Review Findings to Fix

### 1. BottomSheet overlaps PlaybackControls (CRITICAL)
Both BottomSheet and PlaybackControls occupy `bottom-0`. The collapsed sheet sits ON TOP of the playback bar.
- **Fix**: Stack them properly. PlaybackControls should sit above the BottomSheet. Use flex column layout or proper absolute positioning with calculated offsets so they don't overlap.
- Files: `EditorLayout.tsx`, `BottomSheet.tsx`, `PlaybackControls.tsx`

### 2. Desktop sidebar not collapsible
`LeftPanel` is `hidden md:flex` but there's no toggle button. The task requires a collapsible sidebar on desktop.
- **Fix**: Add a toggle button that reads/writes `leftPanelOpen` from uiStore. When collapsed, sidebar should hide and map should take full width.
- Files: `LeftPanel.tsx`, `TopToolbar.tsx`, `uiStore.ts`

### 3. Touch targets below 44px minimum
Several mobile buttons are too small:
- Map-style trigger: `h-7` (28px) → needs `h-11` (44px)
- Mobile export button: `h-7` (28px) → needs `h-11` (44px)
- Bottom-sheet import button: `h-8` (32px) → needs `h-11` (44px)
- Playback icon buttons: `h-9` (36px) → needs `h-11` (44px)
- **Fix**: Increase all interactive touch targets to minimum 44px (`h-11 w-11` or `min-h-[44px] min-w-[44px]`)
- Files: `MapStyleSelector.tsx`, `TopToolbar.tsx`, `BottomSheet.tsx`, `PlaybackControls.tsx`

### 4. Missing accessibility attributes
- Mobile export button is icon-only but has no `aria-label`
- Playback icon buttons have no accessible names
- Bottom-sheet drag handle missing `aria-expanded` and label
- **Fix**: Add `aria-label` to all icon-only buttons. Add `aria-expanded={isOpen}` and `aria-label="Toggle route panel"` to bottom-sheet handle.
- Files: `TopToolbar.tsx`, `PlaybackControls.tsx`, `BottomSheet.tsx`

## Validation
After fixing, run:
1. `npx tsc --noEmit` — must pass
2. `npm run build` — must pass
3. Push to the same branch (the PR will auto-update)
