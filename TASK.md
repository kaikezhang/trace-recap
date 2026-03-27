# TASK.md — Camera & Route Overhaul (Round 2)

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Problems to Fix

### 1. Bearing rotation is disorienting — LOCK NORTH
Currently the camera bearing rotates to follow route direction during FLY. This is confusing and ugly.
**Fix**: Set bearing = 0 at ALL times. North always up. Remove ALL dynamic bearing logic from CameraController. Remove bearing smoothing. The IconAnimator can still rotate the icon to face travel direction, but the MAP must stay north-up.

### 2. Every destination gets city-level zoom — need smart "look-ahead" zoom
Currently every segment does: zoom in to city → zoom out → fly → zoom in to city → repeat. This is monotonous and wrong. For transit stops (short layovers where the next destination is nearby), we shouldn't zoom in fully.

**Fix: Look-ahead zoom strategy**
For each destination, calculate the "arrive zoom" based on the NEXT segment's distance:
- If it's the LAST destination → zoom to city level (12-13)
- If next segment distance < 100km → zoom to level that fits both current + next city (using turf.bbox of current + next destination)
- If next segment distance >= 100km → moderate zoom (9-10), don't go to city level
- If next segment distance >= 1000km → barely zoom in (6-7), just pause briefly

This creates a natural flow where transit hubs get a quick pause and the camera only zooms in deeply at the final destination or when the next leg is short (exploring nearby).

The HOVER phase duration should also scale:
- Last destination: 2.0s (final arrival)
- Next segment < 100km: 1.5s (short pause, about to explore nearby)
- Next segment >= 100km: 1.0s (transit, just passing through)
- Next segment >= 1000km: 0.8s (barely stopping)

### 3. Route lines disappear during animation
Bus/train/car route lines vanish during playback (only static lines show after). The current code hides static layers during play but the animated progressive route only shows for the CURRENT segment.

**Fix**: Keep ALL previously-completed segments' route lines visible during animation. Implementation:
- When animation starts, do NOT hide the static segment layers. Instead, use the static layers for COMPLETED segments and only use the animated progressive layer for the CURRENT segment.
- After each segment completes (ARRIVE phase), make its static route layer visible (if it was hidden).
- The animated progressive line draws the CURRENT segment from start to the icon's current position.
- Result: viewer sees all past route lines + the current one being drawn.

### 4. Left panel scroll broken
When many locations are added, the route list doesn't scroll.
**Fix**: In LeftPanel.tsx, ensure the ScrollArea wrapping RouteList has proper flex constraints. The parent div should be `flex flex-col h-full overflow-hidden` and the ScrollArea should take remaining space with `flex-1 min-h-0`.

### 5. Pitch changes are too aggressive
60° pitch during fly looks weird on a 2D flat map (no 3D terrain).
**Fix**: Remove ALL pitch changes. Keep pitch = 0 at all times. The map is 2D, tilting adds nothing and distorts the view.

## Implementation Details

### CameraController.ts — Major Rewrite
```
constructor(locations, segments):
  For each segment, precompute:
  - fromCenter, toCenter, midpoint
  - flyZoom: zoom level to fit both endpoints in view (from bbox)
  - arriveZoom: smart look-ahead zoom based on NEXT segment distance
  - routeLine, routeLength

getCameraState(segmentIndex, phase, progress):
  bearing = 0  // ALWAYS
  pitch = 0    // ALWAYS
  
  HOVER:
    center = fromCenter (or toCenter for arrive hover)
    zoom = previous segment's arriveZoom (or first segment's arriveZoom)
  
  ZOOM_OUT:
    center = lerp(fromCenter → midpoint, progress)
    zoom = lerp(arriveZoom → flyZoom, progress)
  
  FLY:
    center = along route at progress
    zoom = flyZoom (constant during fly)
  
  ZOOM_IN:
    center = lerp(routeEnd → toCenter, progress)
    zoom = lerp(flyZoom → arriveZoom, progress)
  
  ARRIVE:
    center = toCenter
    zoom = arriveZoom
```

### AnimationEngine.ts — Timing Updates
- HOVER duration scales based on look-ahead (see above)
- Remove routeDrawProgress complexity — simplify to just tracking current segment index
- Emit: segmentIndex, phase, phaseProgress (same as now, just cleaner)

### MapCanvas.tsx — Route Visibility Logic
- On play: hide static layers for segments NOT YET completed
- As each segment's FLY phase starts, begin drawing animated progressive route
- When segment completes (enters ARRIVE), show its static layer permanently
- On reset/stop: show all static layers

### LeftPanel.tsx — Scroll Fix
Fix the flex layout so ScrollArea works properly with many items.

## Branch
Create branch: `feat/camera-overhaul-v2`

## How to Verify
1. `npx tsc --noEmit` — must compile
2. `npm run build` — must succeed  
3. Import taiwan-trip.json (8 cities):
   - Map should stay north-up at all times (bearing=0)
   - No pitch tilt
   - Hong Kong → Taipei (flight, long distance): quick pause at Taipei, moderate zoom
   - Taipei → Jiufen (bus, short): deeper zoom at Jiufen since next is also short
   - Through to Alishan → Taoyuan (car, short): deep zoom at final stop
   - All completed route lines stay visible throughout
   - Left panel scrolls when many locations
