# Audit: Photo Rotation in FreeCanvas

## Scope

Reviewed:

- `src/components/editor/FreeCanvas.tsx`
- `src/components/editor/PhotoFrame.tsx`
- `src/lib/frameStyles.ts`
- `src/components/editor/PhotoOverlay.tsx`

This document focuses on why rotation feels wrong in Free mode, whether snap is contributing, whether display rotation matches stored rotation, and whether resize remains predictable when rotation is applied.

## Root Cause Analysis

### 1. Primary bug: rotation mixes coordinate spaces

The main UX break is in `beginRotate` and the `rotate-photo` pointer move path in `FreeCanvas.tsx`.

- `beginRotate` computes the photo center in canvas-local pixels:
  - `centerX = (transform.x + transform.width / 2) * containerSize.w`
  - `centerY = (transform.y + transform.height / 2) * containerSize.h`
  - `src/components/editor/FreeCanvas.tsx:666-668`
- It then compares that local center against `clientX/clientY`, which are viewport coordinates:
  - `src/components/editor/FreeCanvas.tsx:668`
- The move handler repeats the same mistake:
  - `src/components/editor/FreeCanvas.tsx:867-872`

That means rotation is calculated around a phantom center unless the canvas happens to sit at viewport origin `(0, 0)`. In the actual editor, the canvas is offset by surrounding UI, so mouse movement is being measured against the wrong pivot. This directly explains "random" and "unpredictable" rotation.

Why this feels bad in practice:

- Small mouse arcs around the visible photo center do not map to small angle changes.
- Direction can feel inconsistent because the computed angle is relative to an off-screen pivot.
- The farther the canvas is from the viewport origin, the worse the error gets.

This is the highest-impact issue by a wide margin.

### 2. Free mode has two rotation systems stacked on top of each other

Free mode rotates the outer photo wrapper with `transform.rotation`:

- `src/components/editor/FreeCanvas.tsx:1161-1166`

But `PhotoFrame` also applies its own decorative rotation for polaroid style:

- `src/components/editor/PhotoFrame.tsx:68-76`
- `src/lib/frameStyles.ts:98-105`

`getPhotoFrameRotation()` adds a seeded extra tilt of about `-2deg` to `+2deg` for polaroid frames. So the angle the user sees is:

- `manual free-mode rotation`
- plus `decorative polaroid micro-rotation`

Consequences:

- Snapping to `0`, `90`, `-90`, or `180` does not look visually exact.
- The rotation handle and selection box align to the outer wrapper, not the visibly tilted inner frame.
- Two photos with the same stored `transform.rotation` can look slightly different.

For non-free template layouts, decorative tilt is defensible as styling. In Free mode, it conflicts with direct manipulation.

### 3. The decorative polaroid tilt is not seeded consistently between editor and overlay

The editor uses a stable per-photo index:

- `stablePhotoIndex` is created from the original `photos` order in `FreeCanvas.tsx:384-388`
- `PhotoFrame` receives `photoIndex={stablePhotoIndex.get(photo.id) ?? 0}` in `FreeCanvas.tsx:1170-1173`

`PhotoOverlay` does not use that same seed. It passes the current render loop index:

- `PhotoOverlay.tsx:757-759`
- `PhotoOverlay.tsx:894`
- `PhotoOverlay.tsx:1049-1051`

In free mode, overlay ordering comes from `freeTransforms` sorted by `zIndex`:

- `PhotoOverlay.tsx:416-424`
- `PhotoOverlay.tsx:443-456`

So the same photo can get a different decorative rotation in editor vs playback/export, especially after reordering or any z-index changes. Stored rotation is therefore not the same as displayed rotation across surfaces.

This is a real display mismatch, separate from the gesture bug.

### 4. The actual angle mapping is mostly correct once the center is fixed

The `+90` offset is not the core problem.

- `beginRotate` starts from `atan2(...) + 90`
- `src/components/editor/FreeCanvas.tsx:668`
- the move handler uses the same convention
- `src/components/editor/FreeCanvas.tsx:867-870`

That maps:

- top of the photo to `0deg`
- right side to `90deg`
- bottom to `180deg`
- left side to `-90deg`

Given screen coordinates, that makes clockwise mouse movement produce clockwise photo rotation, which is the intuitive mapping for this handle placement.

`normalizeRotation()` is also not the primary bug:

- `src/components/editor/FreeCanvas.tsx:159-163`

It may cause the numeric value to jump from `180` to `-179` or similar around the wrap point, but the visual orientation is equivalent. That is a minor state-representation issue, not the reason rotation feels random.

### 5. Snap contributes friction, but it is secondary to the broken center math

Snap targets and threshold:

- `ROTATION_SNAP_TARGETS = [0, 90, -90, 180]`
- `ROTATION_SNAP_THRESHOLD = 5`
- `src/components/editor/FreeCanvas.tsx:61-62`
- `src/components/editor/FreeCanvas.tsx:182-186`
- `src/components/editor/FreeCanvas.tsx:873-877`

Current behavior:

- Snap is always on unless Shift is held.
- Snap is evaluated continuously on every pointer move.
- There is no hysteresis or latch; it just hard-snaps whenever the current angle enters the threshold.

Assessment:

- A `5deg` threshold is somewhat aggressive for fine rotation.
- Continuous snap can feel like it is fighting the user near cardinal angles.
- The effect is amplified by the hidden polaroid micro-rotation, because the photo may still look off even after snapping.

This is a real UX problem, but not the primary root cause of the reported randomness.

### 6. Resize math is mostly coherent, but visible-frame mismatch makes it feel less trustworthy

`beginResize` and the resize move path correctly work in screen space and explicitly account for rotation:

- anchor setup: `FreeCanvas.tsx:684-708`
- coordinate transform for pointer movement: `FreeCanvas.tsx:894-919`

Compared with rotation, resize is much healthier mathematically because it does account for viewport-vs-container offsets.

I do not see a comparable coordinate-space bug in resize. The main resize-related UX issue is indirect:

- if polaroid decorative tilt is active, the visible frame is not aligned with the selection box or resize handles
- so the user is resizing one box while looking at another tilted box

Minor note:

- the anchor is derived from the exact pointer-down point, not the geometric corner itself (`FreeCanvas.tsx:700-708`)
- that can introduce a small offset depending on where inside the handle circle the user grabbed
- but that is a small effect, not the main complaint

## Recommended Fixes

### Priority 1: fix rotation to use a client-space center

Make `beginRotate` and the `rotate-photo` move handler use the photo center in the same coordinate space as the pointer.

Concrete change:

- get the canvas bounding rect from `canvasRef.current.getBoundingClientRect()`
- convert the photo center to client-space by adding `rect.left` and `rect.top`
- store that client-space center in the active gesture

Result:

- mouse movement is measured around the actual visible photo center
- clockwise drag maps cleanly to clockwise rotation
- angle changes become proportional and predictable

This is the fix with the biggest UX impact.

### Priority 2: disable decorative frame rotation in Free mode

Do not let `PhotoFrame` add its own random tilt when the user is directly manipulating rotation.

Concrete options:

- add a prop such as `decorativeRotationEnabled` to `PhotoFrame` and turn it off in `FreeCanvas`
- also turn it off in `PhotoOverlay` when `layout.mode === "free"`

Result:

- the visible angle matches the editable/stored angle
- snap targets become visually meaningful
- selection ring, rotate handle, and resize handles align with the photo the user sees

This is the second-biggest UX improvement.

### Priority 3: make decorative tilt stable by photo identity, not render index

If decorative polaroid tilt is kept anywhere, seed it from a stable identity instead of current render order.

Concrete options:

- seed from `photo.id`
- or explicitly store the decorative tilt on the photo/layout data
- do not seed from loop index in `PhotoOverlay`

Result:

- editor, preview, and export all show the same decorative tilt
- z-index changes do not silently alter the appearance of a photo

This matters for correctness and trust, especially after reordering.

### Priority 4: soften or invert snap behavior

After the center-space bug is fixed, revisit snap behavior.

Concrete options:

- reduce the threshold from `5deg` to `2deg` or `3deg`
- add hysteresis so snap engages once and releases cleanly
- consider making rotation free by default, with Shift enabling snap instead of disabling it

Result:

- less fighting near cardinal angles
- easier fine adjustment
- clearer mental model for precision editing

This is worthwhile, but it should come after fixing the core math and the double-rotation problem.

## Priority Ranking

1. **Fix the coordinate-space bug in rotation.**
   This is the main cause of the reported "random/unpredictable" behavior.

2. **Remove decorative polaroid tilt from Free mode.**
   This makes what the user sees match what they are editing.

3. **Stabilize decorative tilt seeding across editor and overlay.**
   This fixes editor/playback/export mismatch and prevents z-index changes from changing appearance.

4. **Retune snap behavior.**
   Improves feel, but it is not the primary bug.

## Bottom Line

The rotation gesture does not primarily feel wrong because of `+90`, `normalizeRotation()`, or even snap. The biggest problem is simpler: rotation is using a center in canvas-local space with a pointer in viewport space. After that, Free mode is made harder to trust because `PhotoFrame` adds a second hidden rotation layer, and that layer is not even seeded consistently between the editor and `PhotoOverlay`.
