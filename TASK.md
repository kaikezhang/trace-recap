# TASK.md — Fix: Current segment route line not visible during animation

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Bug Description
During animation playback, the CURRENT segment's route line is invisible. Only past (completed) segments show their static route lines. The animated progressive route overlay that should draw the current segment in real-time is not rendering.

## Expected Behavior
When the animation plays:
- Past segments: static route lines visible (colored by transport mode)  
- Current segment: a line progressively drawn from start to the icon's current position
- Future segments: hidden

## Root Cause Analysis
The progressive route drawing uses an animated overlay approach:
1. `AnimationEngine` emits `routeDrawProgress` events with `routeDrawFraction` (0-1)
2. `EditorLayout.tsx` handles these events, uses `turf.lineSliceAlong()` to slice the route geometry, and updates an animated GeoJSON source (`anim-route-src`)
3. `MapCanvas.tsx` renders this source with layers `anim-route-layer` and `anim-route-glow-layer`

The problem is likely one or more of these issues:
- The animated route layers (`anim-route-layer`, `anim-route-glow-layer`) may be BELOW static segment layers in the Mapbox layer stack, making them invisible
- The animated route source may not be getting the sliced geometry data correctly
- The `routeDrawProgress` events may not be firing or the fraction may always be 0
- There's a `segment-complete` CustomEvent mechanism that may be interfering

## What to Do

### Step 1: Investigate
Run `npm run dev`, open http://localhost:3000/editor, import `fixtures/taiwan-trip.json`, click play, and check browser console for:
- `[routeDraw]` log messages (already added) — are they appearing? What are the fraction values?
- Any errors related to mapbox sources/layers

### Step 2: Fix the animated route rendering
The approach should be SIMPLE. Abandon the separate animated overlay GeoJSON source approach — it's fragile and has z-order issues.

**Better approach: Use the STATIC segment layers themselves for progressive drawing.**

For each segment, during the FLY phase:
- Instead of hiding the static layer and drawing a separate animated layer, keep the static layer visible but modify its GeoJSON source data to only show the portion of the route drawn so far
- Use `turf.lineSliceAlong()` to compute the visible portion
- Update the segment's own GeoJSON source with the sliced geometry each frame

This eliminates z-order issues because the line is rendered in its own layer at the correct position in the stack.

### Implementation:

**EditorLayout.tsx changes:**
- In the `routeDrawProgress` handler, instead of updating `anim-route-src`, update the STATIC segment source directly:
  ```
  const srcId = `segment-src-${seg.id}`;
  const src = map.getSource(srcId) as mapboxgl.GeoJSONSource;
  if fraction <= 0: set empty FeatureCollection
  if fraction >= 1: set full geometry
  else: set turf.lineSliceAlong(geometry, 0, fraction * totalLength)
  ```
- Remove all `anim-route-src` / `anim-route-layer` / `anim-route-glow-layer` logic from this file

**MapCanvas.tsx changes:**
- Remove the animated route source/layer setup (`ANIM_ROUTE_SOURCE`, `ANIM_ROUTE_LAYER`, `ANIM_ROUTE_GLOW_LAYER`)
- Remove the `moveLayer` calls for animated layers
- In the playback visibility effect:
  - Past segments (index < currentSegmentIndex): static layer visible with FULL geometry
  - Current segment (index === currentSegmentIndex): static layer visible (geometry updated by EditorLayout)
  - Future segments (index > currentSegmentIndex): static layer HIDDEN
- When playback stops (idle): restore all segments to their full geometry and show all layers

**AnimationEngine.ts** — no changes needed, `routeDrawProgress` events are fine

**Store the original full geometries** somewhere so you can restore them after playback. You can store them in a ref in MapCanvas or EditorLayout.

### Step 3: Verify
- Import taiwan-trip.json
- Play animation
- Current segment should show a line progressively drawing from start to icon position
- Past segments should show their full route line
- Future segments should be hidden
- When animation ends or is reset, all route lines should show in full

## Branch
Create branch: `fix/current-segment-route-line`
