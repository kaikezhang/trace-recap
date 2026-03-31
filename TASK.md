# ⚠️ DO NOT MERGE ANY PR. Create PR and STOP.

# TASK: Free Mode — Interactive Photo & Caption Editing

## Summary

Add a "Free" layout mode to the PhotoLayoutEditor that lets users interactively manipulate photos and captions after selecting any layout template. When a user drags, rotates, or scales any photo/caption, the layout automatically switches to "Free" mode, preserving the current positions as the starting point.

## Context

Currently, users can pick a layout template (Grid, Scatter, Polaroid, etc.) which computes fixed positions for photos. There is no way to manually adjust individual photo positions, sizes, or rotations — nor to edit caption text, position, font, size, or color per-caption.

## Requirements

### 1. Free Mode Activation

- **Trigger**: Any drag/rotate/scale gesture on a photo OR caption in the preview area automatically switches the layout to `mode: "free"`.
- **Initial state**: When switching to Free mode, capture the current computed `PhotoRect[]` positions as the starting `freeTransforms` array.
- **Layout selector**: Add a "Free" option (with `Hand` icon from lucide-react) to the `LAYOUT_STYLES` array. It should appear as the last option.
- **Switching back**: If the user selects any other layout template, the free transforms are discarded and the layout reverts to computed positions.

### 2. Photo Manipulation (in Free Mode)

Each photo in the preview should support:
- **Drag** — move the photo anywhere within the container (update `x`, `y` in fractional coords 0-1)
- **Resize** — corner handles to scale while maintaining aspect ratio (update `width`, `height`)
- **Rotate** — rotation handle (circular handle above the photo) to rotate freely (update `rotation` in degrees)
- **Selection** — clicking a photo selects it (shows handles); clicking empty space deselects

Visual feedback:
- Selected photo shows 4 corner resize handles (small circles) + 1 rotation handle (circle connected by a line above the top-center)
- Selected photo has a dashed border outline
- Drag cursor: `grab` / `grabbing`
- Handles should be rendered in indigo-500 color to match the UI theme

### 3. Caption Editing (in Free Mode)

Each photo's caption should be independently editable:
- **Inline edit**: Double-click a caption to enter edit mode (text input). Press Enter or click outside to confirm.
- **Drag**: Captions can be dragged independently from their photo (stored as `captionOffsetX`, `captionOffsetY` relative to the photo center)
- **Per-caption styling**: When a caption is selected, show a mini toolbar (floating, above the caption) with:
  - Font family dropdown (System UI, Serif, Monospace, Cursive — same as existing)
  - Font size slider (10-32px)
  - Color picker (a small palette of preset colors: white, black, gray, indigo-500, red-500, amber-500 + a custom hex input)
- These per-caption overrides are stored in `freeTransforms[i].caption`

### 4. Type Changes

#### `PhotoLayout` (in `src/types/index.ts`)

Add new mode value and fields:
```typescript
export interface PhotoLayout {
  mode: "auto" | "manual" | "free";  // ADD "free"
  // ... existing fields ...
  freeTransforms?: FreePhotoTransform[];  // NEW — only used when mode === "free"
}

// NEW type
export interface FreePhotoTransform {
  photoId: string;
  x: number;       // 0-1 fraction of container
  y: number;       // 0-1 fraction of container
  width: number;   // 0-1 fraction of container
  height: number;  // 0-1 fraction of container
  rotation: number; // degrees
  zIndex: number;   // stacking order (higher = on top)
  caption?: {
    text?: string;            // override caption text
    offsetX: number;          // offset from photo center, fraction of container width
    offsetY: number;          // offset from photo center, fraction of container height
    fontFamily?: string;
    fontSize?: number;        // px
    color?: string;           // CSS color
    rotation?: number;        // caption rotation independent from photo, degrees
  };
}
```

### 5. Component Architecture

#### New: `FreeCanvas.tsx` (`src/components/editor/FreeCanvas.tsx`)

A new component that renders the interactive free-mode canvas inside the PhotoLayoutEditor preview area. This handles:
- Rendering photos at their `freeTransforms` positions
- Selection state (which photo/caption is selected)
- Drag, resize, rotate gesture handling via pointer events (NOT a drag library — use raw `onPointerDown/Move/Up` for precision)
- Rendering selection handles (corners + rotation)
- Caption rendering with inline edit
- Caption mini-toolbar when a caption is selected

Props:
```typescript
interface FreeCanvasProps {
  photos: Photo[];
  transforms: FreePhotoTransform[];
  containerSize: { w: number; h: number };
  mapSnapshot: string | null;
  borderRadius: number;
  onTransformsChange: (transforms: FreePhotoTransform[]) => void;
}
```

#### Modified: `PhotoLayoutEditor.tsx`

- Add "Free" to `LAYOUT_STYLES` array
- When `layout.mode === "free"`, render `<FreeCanvas>` instead of `<PhotoOverlay>` in the preview area
- When switching to Free mode from a computed layout, initialize `freeTransforms` from the currently computed `rects` array
- Wire up `onTransformsChange` to call `updateLayout({ freeTransforms: ... })`

#### Modified: `PhotoOverlay.tsx`

- When `photoLayout.mode === "free"` and `photoLayout.freeTransforms` exists, use those transforms directly instead of computing layout via `computeAutoLayout` / `computeTemplateLayout`.
- Map `freeTransforms` to the `rects` array format (they already match `PhotoRect` structure).
- Render captions using per-caption overrides from `freeTransforms[i].caption` if present.
- Respect `zIndex` ordering when rendering.

### 6. Interaction Details

**Drag (Photo)**:
- `onPointerDown` on photo → record start position, set `isDragging`
- `onPointerMove` → compute delta in fraction-of-container coords, update `x`/`y`
- `onPointerUp` → finalize, commit to store
- Constrain: photos can go partially off-screen but center must stay within container

**Resize (Photo)**:
- Corner handles only (not edge handles — keeps it simple)
- Drag a corner → scale width/height proportionally (maintain original aspect ratio)
- Minimum size: 5% of container in either dimension
- The opposite corner stays fixed (anchor point)

**Rotate (Photo)**:
- A circular handle connected by a thin line from the top-center of the photo
- Drag the handle → compute angle from photo center to pointer position
- Snap to 0°, 90°, 180°, 270° when within 5° (hold Shift to disable snap)

**Z-Index**:
- Clicking a photo brings it to the front (max zIndex + 1)
- Future: could add "Send to back" in context menu, but not for v1

**Caption drag**:
- Caption is positioned below the photo by default (offsetX=0, offsetY = height/2 + padding)
- Dragging a caption updates `captionOffsetX`/`captionOffsetY` relative to photo center
- Captions move with their photo when the photo is dragged

### 7. Persistence

- Free transforms are stored in `PhotoLayout.freeTransforms` alongside existing layout fields
- They are persisted to IndexedDB via the existing projectStore save mechanism
- When exporting video, `PhotoOverlay` reads `freeTransforms` and renders accordingly

### 8. Scope Exclusions (NOT in this PR)

- No undo/redo for free mode transforms (existing Zustand history doesn't cover this yet)
- No multi-select (select multiple photos at once)
- No alignment guides / snap-to-grid
- No right-click context menu
- No keyboard shortcuts for manipulation
- No animation preview in free mode (playback uses PhotoOverlay which will read freeTransforms)

### 9. Testing

- `npx tsc --noEmit` must pass
- `npm run build` must pass
- Manual test: select a layout → drag a photo → verify it switches to Free mode → verify positions persist after closing and reopening the editor

## File Checklist

- [ ] `src/types/index.ts` — Add `"free"` to mode union, add `FreePhotoTransform` interface
- [ ] `src/components/editor/FreeCanvas.tsx` — NEW: interactive free-mode canvas
- [ ] `src/components/editor/PhotoLayoutEditor.tsx` — Add Free to layout styles, render FreeCanvas when mode=free
- [ ] `src/components/editor/PhotoOverlay.tsx` — Read freeTransforms when mode=free for playback
- [ ] `src/lib/photoLayout.ts` — Export helper to convert computed rects → FreePhotoTransform[]

## Branch

`feat/free-mode`
