# TASK: Export Video Must Render PhotoFrame Styles

## ⚠️ CREATE PR AND STOP. DO NOT MERGE.

## Reference
Read `docs/audit-wysiwyg.md` — discrepancy #2, #5, #9.

## Problem

`VideoExporter` does not use `PhotoFrame` or read `photoFrameStyle`. It has its own canvas drawing that only special-cases `layout.template === "polaroid"`. All other frame styles (borderless, film-strip, classic-border, rounded-card) are ignored. This means:

1. Frame padding, background color, shadow, outer border radius are missing in export
2. Film strip perforations are missing
3. Polaroid inline caption typography doesn't match the DOM component
4. Decorative polaroid rotation is missing
5. Free-mode caption backgrounds and styling are lost
6. Non-free caption pill styling doesn't match

## What to Fix

### Step 1: Pass `photoFrameStyle` to VideoExporter

- `ExportDialog` must read `photoFrameStyle` from `useUIStore` and pass it in export settings
- Add `photoFrameStyle` to the export settings type in `src/types/index.ts` if needed
- `VideoExporter` constructor must accept and store it

### Step 2: Implement frame rendering in canvas

In `VideoExporter.drawPhotos()` and `drawSceneTransitionPhotos()`, for each photo:

Read the frame config from `PHOTO_FRAME_STYLE_CONFIGS[photoFrameStyle]`:
- `framePadding` — parse the CSS padding string ("6% 6% 18% 6%") into top/right/bottom/left percentages
- `frameBackground` — fill rect behind the photo with this color
- `outerBorderRadius` — clip the outer frame with rounded corners
- `mediaBorderRadius` — clip the photo media with its own radius
- `frameShadow` — render shadow (can approximate with canvas shadow APIs)

For **film-strip** style:
- Draw the dark strips at top/bottom with perforation pattern

For **polaroid** style:
- Draw the off-white frame with thick bottom padding
- Render inline caption in the bottom area using `inlineCaptionFontFamily`, `inlineCaptionFontSize`, `inlineCaptionColor`
- Apply decorative rotation via `getPhotoFrameRotation()` (but respect `disableDecorativeRotation` for free mode)

For **borderless** style:
- Minimal padding, add vignette shadow overlay

For **classic-border** and **rounded-card**:
- White frame with appropriate padding and border radius

### Step 3: Fix caption rendering in export

- **Free-mode captions**: read `bgColor`, `color`, `fontFamily`, `fontSize`, `rotation` from freeTransform caption data. Draw background rect + styled text.
- **Non-free captions**: render the same pill-style caption (rounded rect background + white text) that PhotoOverlay uses.
- **Polaroid inline captions**: let the frame handle it (Step 2), don't double-render.

### Step 4: Apply decorative rotation

- For non-free mode with polaroid frame: apply `getPhotoFrameRotation(photoFrameStyle, photoIndex)` rotation
- For free mode: skip decorative rotation (user controls rotation directly)

## Testing

After fixes:
1. Set frame style to Polaroid → export video → frames should have white border with thick bottom
2. Set frame style to Film Strip → export → should see dark strips with perforations
3. Set frame style to Borderless → export → minimal frame, vignette visible
4. Free mode with custom caption colors → export → caption backgrounds preserved
5. Non-free mode with captions → export → pill-style caption background visible

## Constraints

- Import `PHOTO_FRAME_STYLE_CONFIGS` and `getPhotoFrameRotation` from `@/lib/frameStyles`
- Do NOT change PhotoOverlay, FreeCanvas, or PhotoFrame components
- Build must pass: `npx next build`
- Create a PR to main when done
