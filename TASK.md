# TASK: Fix Caption Editor Issues (PR #80 Review Feedback)

⚠️ DO NOT MERGE. Create PR and stop.

## Context
PR #80 added photo caption editing with font/size controls. Codex reviewed and found 4 issues.
You are on branch `fix/caption-editor-fixes` which already has the caption editor code merged with latest main.

## Issues to Fix

### 1. Export path caption overlap
In `VideoExporter.ts`, `drawPhotos()` and `drawSceneTransitionPhotos()` don't reserve space for captions.
Large font sizes cause caption text to overlap with photo content.
**Fix**: Calculate caption height and subtract it from the available photo area.

### 2. Preview vs Export scaling mismatch
Preview (`PhotoOverlay.tsx`) uses `containerSize.w / 1000` as scale factor.
Export (`VideoExporter.ts`) uses `scaleX` based on full canvas width.
These produce different font sizes — not WYSIWYG.
**Fix**: Use the same scaling formula in both paths. The reference width should be 1000px in both.

### 3. Uncontrolled caption input
`PhotoManager.tsx` uses `defaultValue` for the caption input — doesn't update on undo/redo or project reload.
**Fix**: Use controlled `value` prop with onChange handler.

### 4. Import normalization missing
`captionFontFamily` and `captionFontSize` from loaded projects aren't validated.
**Fix**: In `projectStore.ts` import/load path, clamp `captionFontSize` to [8, 72] and whitelist `captionFontFamily` to known fonts. Unknown values → defaults.

## Files to Change
- `src/engine/VideoExporter.ts`
- `src/components/editor/PhotoOverlay.tsx`
- `src/components/editor/PhotoManager.tsx`
- `src/stores/projectStore.ts`

## Verification
- `npx tsc --noEmit` must pass
- `npm run build` must pass
