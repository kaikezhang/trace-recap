# TASK: Deep Audit — WYSIWYG Consistency Across 5 Rendering Surfaces

## ⚠️ DO NOT MAKE CODE CHANGES. AUDIT AND DOCUMENT ONLY.

## Context

Users see photos rendered in 5 different places. These should look IDENTICAL (WYSIWYG), but there are observable differences. We need to find every source of inconsistency.

## The 5 Rendering Surfaces

1. **PhotoLayoutEditor Preview** (non-Free modes: Grid/Collage/etc)
   - Component: `PhotoOverlay` inside `PhotoLayoutEditor`
   - Props: `containerMode="parent"`, `visible={true}`, `opacity={previewOpacity}`
   - Container: fitted to preview panel with aspect ratio

2. **Free Mode Editor Preview**
   - Component: `FreeCanvas` inside `PhotoLayoutEditor`
   - Container: 95% × 88% inset of preview panel
   - Transforms: `effectiveFreeTransforms` (reconciled from layout + fallback)

3. **Scrubber/Paused Preview** (drag progress bar while paused)
   - Component: `PhotoOverlay` inside `MapStage`/`EditorLayout`
   - Props: `containerMode="viewport"`, driven by animation timeline
   - Container: viewport-sized with aspect ratio constraint

4. **Playing Animation**
   - Same `PhotoOverlay` as #3 but with live animation (enter/exit/kenburns/bloom/portal)
   - Transitions between locations with scene transitions

5. **Video Export**
   - Component: Server-side frame capture or client-side canvas
   - File: `src/engine/VideoExporter.ts` or `/api/encode-video/frame/route.ts`
   - Fixed resolution, may have different pixel density

## What to Audit

For EACH of these areas, trace the complete rendering path and document:

### A. Container Sizing
- What determines the container dimensions?
- How is aspect ratio applied?
- What is the photo area inset (the 95%×88% area)?
- Are there rounding differences between surfaces?

### B. Layout Computation
- How are photo rects computed? (computeAutoLayout / computeTemplateLayout / freeTransforms)
- Are the same inputs (photos, layout, containerAspect, gap, width) used everywhere?
- Is `containerAspect` computed the same way in all surfaces?

### C. Photo Frame Rendering
- Which surfaces use PhotoFrame? Which don't?
- Is `photoFrameStyle` read from the same source?
- Is `borderRadius` applied consistently?
- Is decorative rotation (polaroid tilt) handled the same way?
- Does `disableDecorativeRotation` apply correctly in Free mode across all surfaces?

### D. Caption Rendering
- Is caption positioning (offsetX/offsetY) normalized the same way?
- Is caption font scaling (captionScale = containerW / 1000) consistent?
- Are free-mode caption styles (color, bgColor, fontFamily) preserved across all surfaces?

### E. Photo Sizing & Object Fit
- Is `object-cover` vs `object-contain` used consistently?
- Is `object-position` (from focalPoint) applied everywhere?
- Are photos cropped the same way?

### F. Z-Index Ordering
- Is z-index sorting consistent between FreeCanvas and PhotoOverlay?
- Does the order match in export?

### G. Animation State at Rest
- When animation is "at rest" (photo fully visible, no transition), does it look exactly like the editor?
- Are there residual transforms from enter animation (rotation, scale, offset)?
- Does `rotate: rotation` in PhotoOverlay match `transform: rotate(${rotation}deg)` in FreeCanvas?

### H. Coordinate Normalization
- Are all positions stored as 0-1 fractions?
- Are they converted to pixels the same way?
- Is the reference container size the same?

## Deliverable

Write findings to `docs/audit-wysiwyg.md` with:

1. **Comparison matrix**: 5 surfaces × each audit area (A-H), noting match/mismatch
2. **Specific discrepancies found**: exact code locations, what differs, and why
3. **Impact assessment**: which mismatches are most user-visible
4. **Root cause classification**: (a) different code paths, (b) different container math, (c) different props, (d) timing/animation residuals
5. **Do NOT propose fixes** — just document the problems precisely

Focus on OBSERVABLE differences, not theoretical ones. If two code paths produce identical output, note that they match even if the code is different.
