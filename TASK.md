# TASK.md — Geo-Anchored Photo Bloom

⚠️ DO NOT MERGE. Create PR and stop.

## Overview

Add a "Photo Bloom" photo style where photos physically emerge from the city's map coordinate, like postcards unfolding from the pin. Instead of appearing as a floating overlay disconnected from geography, photos bloom outward from their location on the map, and collapse back when leaving.

This is the #1 ranked feature from the product brainstorm — the most direct fix for the photo-map disconnect.

## Current Behavior

- Photos render in a fixed overlay positioned relative to the viewport (screen-space)
- Photos have no spatial relationship to their city's actual map position
- The overlay feels disconnected from the map — it's "on top of" rather than "from"

## Desired Behavior

New `PhotoStyle`: `"bloom"` — photos fan out from the city's projected screen position:

1. **On ARRIVE**: The city pin position is projected to screen coords via `map.project()`. Photos emerge from that point, fanning outward in a radial bloom pattern (like a flower opening or postcards unfolding).
2. **During ARRIVE**: Photos settle into their final layout positions but maintain thin tether lines (or subtle connector shadows) back to the origin point, anchoring them visually to the location.
3. **On exit**: Photos collapse back toward the city pin coordinate, shrinking and converging, as if being folded back into the map.
4. **Camera movement**: During ARRIVE phase, if the camera drifts slightly, the bloom origin tracks the projected city position so photos stay anchored.

## Implementation

### 1. Types (`src/types/index.ts`)

Extend `PhotoStyle`:
```ts
export type PhotoStyle = "classic" | "kenburns" | "bloom";
```

### 2. Photo Bloom Animation (`src/lib/photoAnimation.ts`)

Add bloom-specific functions:
- `getBloomTransform(progress: number, index: number, total: number, originX: number, originY: number, targetRect: {x,y,w,h})` — returns transform from origin point to final layout position
  - progress 0: all photos stacked at origin (scale ~0.2, position = origin)
  - progress 0→0.7: photos spread outward to their layout positions with spring-like easing
  - progress 0.7→1.0: photos settle with a subtle overshoot/bounce

Add bloom exit:
- `getBloomExitTransform(progress: number, index: number, total: number, originX: number, originY: number, currentRect: {x,y,w,h})` — reverse of enter (collapse back to origin)

### 3. Bloom Origin Tracking

**In preview** (`PhotoOverlay.tsx`):
- Accept `bloomOrigin: {x: number, y: number} | null` prop — the screen-space position of the current city
- This comes from `map.project(cityLngLat)` computed in `MapCanvas.tsx` or `EditorLayout.tsx`
- During bloom animation, use this as the source point for photo emergence
- Update on each animation frame if camera moves (the projected point shifts)

**In `EditorLayout.tsx` / `MapStage.tsx`**:
- When `photoStyle === "bloom"`, compute the city's projected screen position from the map ref
- Pass it down to `PhotoOverlay` as `bloomOrigin`
- Use `useAnimationStore` to get the current target location's coordinates
- Recompute on map `move` events during ARRIVE

### 4. PhotoOverlay Changes (`src/components/editor/PhotoOverlay.tsx`)

When `photoStyle === "bloom"`:
- **Enter phase**: Each photo starts at `bloomOrigin` (stacked, tiny) and animates to its computed layout position using `getBloomTransform()` with staggered delays
- **Settled phase**: Photos at final positions. Optionally render thin SVG tether lines from each photo's center back to `bloomOrigin` (2px, semi-transparent, the segment's accent color or white)
- **Exit phase**: Photos animate back toward `bloomOrigin` using `getBloomExitTransform()`, shrinking and converging

Animation timing:
- Enter bloom: ~1.2s total, each photo staggered by ~0.1s
- Tether lines: fade in after photos settle, fade out before exit starts
- Exit collapse: ~0.8s total

### 5. VideoExporter Changes (`src/engine/VideoExporter.ts`)

For bloom style during export:
- Compute `bloomOrigin` by projecting the city's LngLat with `this.map.project()`
- During enter: interpolate each photo from origin to layout position
- During settled: draw photos at layout positions + optional tether lines (canvas `lineTo`)
- During exit: interpolate photos back to origin
- Use same math functions as preview (`getBloomTransform` / `getBloomExitTransform`)

### 6. UI — Photo Style Picker

In `PhotoLayoutEditor.tsx`, add "Bloom" option to the photo style selector alongside "Classic" and "Ken Burns":
- Icon: a radial/burst icon (🌸 or a custom flower/bloom SVG)
- Label: "Bloom"
- Tooltip: "Photos emerge from the city location"

### 7. Tether Lines (Optional but recommended)

Thin connector lines from each photo back to the bloom origin:
- **Preview**: Use an SVG overlay or CSS pseudo-elements
- **Export**: Use canvas `ctx.beginPath()` + `ctx.lineTo()` + `ctx.stroke()`
- Style: 1-2px wide, semi-transparent white or the segment's mood color, with a slight curve (quadratic bezier)
- Fade: 0 opacity during enter animation, fade to ~0.3 after settled, fade to 0 during exit

## Visual Design

- Photos should feel like they're physically connected to the map, not floating
- The bloom should have organic spring-like motion (overshoot on spread, smooth collapse on exit)
- Stagger gives a "popcorn" reveal — photos don't all appear at once
- Tether lines are subtle but important for maintaining the geo-anchor feeling
- The overall effect should be: "these memories live HERE on the map"

## Files to create/modify

- `src/types/index.ts` — extend `PhotoStyle` 
- `src/lib/photoAnimation.ts` — add bloom transform functions
- `src/components/editor/PhotoOverlay.tsx` — bloom enter/exit/tether rendering
- `src/components/editor/EditorLayout.tsx` — compute & pass bloom origin
- `src/components/editor/MapStage.tsx` — pass bloom origin through
- `src/engine/VideoExporter.ts` — bloom compositing in export
- `src/components/editor/PhotoLayoutEditor.tsx` — add bloom to style picker

## Verification

- `npx tsc --noEmit` and `npm run build` must pass
- Bloom style selectable in UI alongside Classic and Ken Burns
- Photos visually emerge from city location (not from screen center)
- Photos collapse back to city on exit
- Export matches preview behavior
- Classic and Ken Burns styles unaffected (no regression)
- Tether lines visible when photos are settled

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`
