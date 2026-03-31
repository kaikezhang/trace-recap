# TASK — Free Mode Multi-Select & Caption Toolbar Improvements

⚠️ DO NOT MERGE. Create a PR targeting `main` and stop.

## Context
Free Mode (FreeCanvas) lets users drag photos and captions freely. Currently only single-select is supported. We need multi-select + batch operations + caption toolbar overflow fix.

## Requirements

### 1. Multi-Select in FreeCanvas
- **Shift+Click** or **Ctrl/Cmd+Click** on photos/captions to add/remove from selection
- **Drag-select (marquee/lasso)**: click empty area + drag → draw selection rectangle → all photos/captions inside get selected
- Visual indicator: all selected items get selection ring (not just one)
- **Multi-drag**: dragging any selected item moves ALL selected items together (preserving relative positions)
- Pressing Escape or clicking empty area clears multi-selection

### 2. Caption Batch Style Apply
- When multiple captions are selected, the caption toolbar should appear and apply styles to ALL selected captions simultaneously
- Font family, font size, text color, background color — all should batch-apply
- Toolbar should show current values from the first selected caption (or "mixed" indicator if values differ)

### 3. Caption Toolbar Overflow Fix
The caption style toolbar (`FreeCanvas.tsx`, the floating div with font/color/fill controls) can overflow the container when caption is near edges. Fix:
- Detect when toolbar would overflow the container bounds (top/bottom/left/right)
- Reposition toolbar to stay within bounds (flip above↔below caption, or shift horizontally)
- The toolbar positioning logic is in `getCaptionToolbarPosition()` — update it to clamp within container
- Currently toolbar uses `transform: translateX(-50%)` which doesn't account for left/right edges

## Key Files
- `src/components/editor/FreeCanvas.tsx` — main file, all changes go here
- Selection state: `selection` state (currently `{ kind: "photo" | "caption", photoId: string } | null`)
  - Change to support array: `{ kind: "photo" | "caption", photoIds: string[] } | null` or similar
- Drag logic: `beginPhotoDrag`, `beginCaptionDrag`, pointer move handler
- Toolbar: `getCaptionToolbarPosition()` function + the toolbar JSX near bottom of file

## Constraints
- Keep all coordinates as 0-1 ratio values (relative to container)
- Don't break single-select behavior — it should still work naturally
- Don't change PhotoOverlay.tsx or any other file unless absolutely necessary
- Keep existing keyboard shortcuts working (Enter to commit caption edit, Escape to deselect)
- TypeScript strict mode, no `any` types
- Run `npx tsc --noEmit` to verify no type errors before committing

## Testing
- `npx tsc --noEmit` must pass
- `npm run build` must pass
