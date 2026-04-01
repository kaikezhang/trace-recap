# TASK: Fix All Photo Rotation Issues

## ⚠️ CREATE PR AND STOP. DO NOT MERGE.

## Reference
Read `docs/audit-rotation.md` for full analysis.

## Fixes Required (all 4)

### Fix 1: Rotation coordinate-space bug (Priority 1)

File: `src/components/editor/FreeCanvas.tsx`

**Problem**: `beginRotate` computes photo center in canvas-local pixels but compares against `event.clientX/clientY` (viewport coords). Rotation pivots around a phantom point.

**Fix**:
- In `beginRotate`: get `canvasRef.current.getBoundingClientRect()`, convert photo center to client-space by adding `rect.left` and `rect.top`
- Store client-space center in the gesture state
- The move handler already uses `event.clientX/clientY`, so once the center is in the same space, it works

### Fix 2: Disable decorative frame rotation in Free mode (Priority 2)

Files: `src/components/editor/PhotoFrame.tsx`, `src/components/editor/FreeCanvas.tsx`, `src/components/editor/PhotoOverlay.tsx`

**Problem**: `PhotoFrame` adds a random ±2° polaroid tilt via `getPhotoFrameRotation()`. In Free mode, this stacks with user's manual rotation, making snap-to-0° look crooked.

**Fix**:
- Add a prop `disableDecorativeRotation?: boolean` to `PhotoFrame`
- When true, skip the `getPhotoFrameRotation` transform
- Pass `disableDecorativeRotation={true}` in `FreeCanvas` 
- Pass `disableDecorativeRotation={displayIsFreeMode}` in `PhotoOverlay` (both bloom and normal paths)

### Fix 3: Stabilize decorative tilt seeding (Priority 3)

Files: `src/components/editor/PhotoOverlay.tsx`, `src/lib/frameStyles.ts`

**Problem**: Editor uses `stablePhotoIndex` (photos array order) but PhotoOverlay uses render-loop index (zIndex-sorted). Same photo gets different tilt in editor vs playback.

**Fix**:
- Change `getPhotoFrameRotation` to accept a `photoId: string` instead of `photoIndex: number`, and derive the seed from the id
- OR: in PhotoOverlay, create a stable index map from photos array (same pattern as FreeCanvas's `stablePhotoIndex`) and use that for `photoIndex`
- Choose whichever approach is simpler. The id-based approach is more robust.

### Fix 4: Soften snap behavior (Priority 4)

File: `src/components/editor/FreeCanvas.tsx`

**Fix**:
- Reduce `ROTATION_SNAP_THRESHOLD` from `5` to `3`
- Invert shift-key: make rotation free by default, Shift ENABLES snap (more intuitive for precision work)
- That means: remove the `if (!event.shiftKey)` guard and change to `if (event.shiftKey)` for snap

## Testing

After all fixes:
1. Open Free mode editor
2. Rotate a photo — should rotate smoothly around its visible center
3. With Shift held, rotation should snap to 0/90/180/-90
4. Without Shift, rotation should be completely free
5. Polaroid frame in Free mode should NOT add extra tilt
6. Switch to Grid/Collage layout — polaroid tilt should still work there
7. Play animation — photo angles should match what the editor showed

## Constraints
- Do NOT change any non-rotation logic
- Build must pass: `npx next build`
- Create a PR to main when done
