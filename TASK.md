# TASK.md — Video Export: Photo Overlay Compositing

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Problem
During preview, when the animation reaches the ARRIVE phase at a location with photos, `PhotoOverlay` (a React DOM component) displays the photos with a nice layout. But during video export, photos are not rendered because DOM overlays aren't captured by `canvas.toBlob()`.

## Context
PR #18 (merged) already solved this for route drawing, vehicle icons, and city labels by compositing onto an offscreen canvas. We need to extend the same approach for photos.

The `progress` event from `AnimationEngine` already includes:
- `showPhotos: boolean` — true during ARRIVE phase if location has photos
- `phase: "ARRIVE"` — when photos should show
- `segmentIndex` — to look up the destination location's photos

`EditorLayout` uses this to set `visiblePhotos` and `showPhotoOverlay` in the animation store.

## Solution

### 1. Pre-load Photo Images
In `VideoExporter.export()`, before the frame capture loop:
- Collect all unique photo URLs from all locations that have photos
- Pre-load them as `HTMLImageElement` (similar to icon preloading)
- Store in a `Map<string, HTMLImageElement>` keyed by URL
- Also track each image's natural aspect ratio (width/height)

### 2. Draw Photos on Canvas
Add a `drawPhotos()` method to `VideoExporter` that composites photos onto the offscreen canvas during ARRIVE phases.

**When to draw:** Check `captured.progress.showPhotos === true`. Look up the photos from the destination location.

**Finding the photos:** The engine emits `progress.segmentIndex`. Use `this.engine.getSegments()[segmentIndex]` to get the segment, then find the `toLoc` from locations to get `toLoc.photos`.

**Layout logic** (simplified version of `PhotoOverlay`):
- Center photos in the canvas
- Photos get a white border/frame effect (like polaroid)
- Slight rotation for visual interest (-2° first, +2° last)
- Max photo display area: ~80% canvas width, ~70% canvas height
- Single row if ≤3 photos, two rows if more
- Each photo scales to fit within its allocated space while maintaining aspect ratio
- Draw a white rounded-rect background behind each photo (shadow effect via darker rect offset)
- Draw the photo image clipped inside

**Simplified layout rules:**
- 1 photo: center, max 60% width, 65% height
- 2 photos: side by side, each max 40% width, 60% height
- 3 photos: side by side, each max 28% width, 55% height  
- 4+ photos: split into 2 rows, similar sizing

**Style:**
- White frame: 6px padding (scaled for HiDPI)
- Rounded corners: 12px radius
- Shadow: offset dark rect behind (2px down, 2px right, semi-transparent)
- Caption text below photo if exists (14px font, dark gray)

### 3. Pass Locations to VideoExporter
VideoExporter needs access to `locations` to look up photos by segment's `toId`. Either:
- Add `locations` as a constructor parameter, OR
- Add `getLocations()` to `AnimationEngine`

Choose whichever is cleaner. `AnimationEngine` already has `getSegments()`, so adding `getLocations()` is consistent.

### 4. Integration in Export Loop
In the frame capture loop, after drawing vehicle icon and city label:
```
offCtx.drawImage(canvas, 0, 0);        // copy map frame
this.drawVehicleIcon(offCtx, ...);       // vehicle icon
this.drawCityLabelFromCapture(offCtx, ...); // city label
this.drawPhotos(offCtx, captured, ...);  // NEW: photos
offscreen.toBlob(...);                   // capture
```

### 5. Photo Pre-loading with Dimensions
Photos need natural dimensions for layout. When pre-loading:
```ts
interface PreloadedPhoto {
  img: HTMLImageElement;
  aspect: number; // naturalWidth / naturalHeight
}
```

## Files to Modify
- `src/engine/VideoExporter.ts` — Add photo preloading, layout, and drawing
- `src/engine/AnimationEngine.ts` — Add `getLocations()` method (if needed)

## Files NOT to Modify
- `src/components/editor/PhotoOverlay.tsx` — Reference only, don't change
- `src/components/editor/ExportDialog.tsx` — No changes
- `src/components/editor/EditorLayout.tsx` — No changes

## Branch
Create branch: `feat/export-photos`

## Verification
- `npx tsc --noEmit` must pass
- `npm run build` must pass
