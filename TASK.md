# TASK.md — P0: Animation Engine Rewrite

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Goal
Rewrite the animation engine to produce smooth, cinematic map animations instead of the current jerky jumpTo() approach.

## What's Wrong Now
1. `map.jumpTo()` in every frame — no smooth transitions, feels like a slideshow
2. Camera bearing locked at 0 (always north) — dead, lifeless
3. Zoom range too narrow — no dramatic zoom-out-then-fly-then-zoom-in feel
4. Only basic linear interpolation + one bezier easing — mechanical movement
5. Route not drawn progressively — just appears all at once
6. Icon has no trail/animation/size change — just slides along
7. City label is just plain text — no wow factor

## Deliverables

### 1. CameraController.ts — Complete Rewrite
- **Dynamic bearing**: Camera should rotate to follow route direction during FLY phase. Use `turf.bearing()` from current position to look-ahead point. Smooth the bearing changes to avoid jerky rotation.
- **Bigger zoom range**: 
  - HOVER: zoom 12-14 (close to city)
  - ZOOM_OUT: animate from city zoom down to fly zoom
  - FLY: fly zoom based on distance: `clamp(7 - log2(distKm / 200), 1.5, 6)` — farther = more zoomed out
  - ZOOM_IN: animate from fly zoom back to city zoom
  - ARRIVE: zoom 12-14
- **Pitch**: 
  - HOVER: 0° (flat, top-down)
  - ZOOM_OUT: ease from 0° to 60°
  - FLY: 60° (dramatic 3D perspective)
  - ZOOM_IN: ease from 60° to 0°
  - ARRIVE: 0°
- **Per-phase easing curves**: Each phase gets its own bezier-easing curve:
  - HOVER: linear (static)
  - ZOOM_OUT: ease-out (0.0, 0.0, 0.2, 1.0) — fast start, gentle settle
  - FLY: ease-in-out (0.42, 0.0, 0.58, 1.0) — smooth throughout
  - ZOOM_IN: ease-in (0.4, 0.0, 1.0, 1.0) — gentle start, confident arrival
  - ARRIVE: linear (static)

### 2. AnimationEngine.ts — Improvements
- Use the new CameraController with per-phase easing
- Apply easing BEFORE passing progress to camera/icon (currently easing is applied but could be per-phase)
- Increase timing: HOVER 1.5s, ARRIVE 1.5s (was 1.0/1.2). Total target: 20-40 seconds.
- Emit more granular events so UI can react (e.g., `routeDrawProgress` for progressive line drawing)

### 3. MapCanvas.tsx — Progressive Route Drawing
- During FLY phase, the route line should draw progressively (from start to current icon position)
- Use `turf.lineSliceAlong()` to get the portion of the route drawn so far
- Update the GeoJSON source data each frame with the sliced line
- Add a glow effect: render the route line twice — a wider blurred line underneath + the crisp line on top
- Route line width: 4px (was 3px)

### 4. IconAnimator.ts — Polish
- Smooth icon size change: slightly larger during FLY (scale 1.2), normal at HOVER/ARRIVE
- Add a subtle pulsing shadow/glow behind the icon during movement
- Fade out smoothly at ARRIVE (opacity transition over 0.3s) instead of hard disappear at 50% ZOOM_IN
- Icon should face travel direction (already does, but verify bearing is smooth)

### 5. City Label in EditorLayout.tsx — Better Animation
- Add a subtle blur-to-sharp effect on entrance
- Scale animation: start at 0.8 → 1.0 with spring
- Add a small location pin icon before the city name
- Add a subtle text shadow for readability over any map style

## Technical Constraints
- Keep using `map.jumpTo()` for frame-by-frame control (NOT flyTo/easeTo — those are async and can't be frame-synced for video export)
- The animation engine must remain synchronous per-frame for video export compatibility
- Don't break the existing VideoExporter — it calls `engine.renderFrame(time)` per frame
- Don't change the store interfaces (projectStore, animationStore types)
- Don't modify API routes

## How to Verify
1. `npx tsc --noEmit` — must compile
2. `npm run build` — must succeed
3. Manual test: add 3+ cities, play animation → should be visually smooth and cinematic

## Branch
Create branch: `feat/animation-engine-rewrite`
