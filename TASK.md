# TASK.md — PR #2 Fixes + Import Feature

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Context
PR #2 (feat/animation-engine-rewrite) was reviewed by Codex and got REQUEST_CHANGES. We need to fix the issues AND add an import feature.

## Part 1: Fix PR #2 Issues (on a new branch based on current main, which has PR #2 merged)

### Issue 1: Progressive route drawing not working
The static route lines in MapCanvas remain visible during animation. The animated overlay route just adds on top.
**Fix**: During playback, hide the static segment route layers. Show them again when playback stops/resets. Use `map.setLayoutProperty(layerId, 'visibility', 'none')` to hide, `'visible'` to show.

### Issue 2: Phase transition camera jump  
ZOOM_OUT → FLY transition causes camera to snap back to route start.
**Fix**: In CameraController, during ZOOM_OUT the camera should interpolate from `fromCenter` toward the route midpoint. At progress=1.0 of ZOOM_OUT, the camera center should be exactly where FLY phase starts at progress=0.0. Ensure continuity.

### Issue 3: Bearing snaps to north at end of FLY
When `turf.bearing(point, point)` is called with the same point (at route end), it returns 0.
**Fix**: Cache the last valid bearing during FLY phase. When the look-ahead point is the same as current (at route end), use the cached bearing instead of recalculating.

### Issue 4: Animated route not cleared between segments
Previous segment's animated route stays visible during next segment's HOVER/ZOOM_OUT.
**Fix**: In AnimationEngine, emit `routeDrawProgress` with value 0 (or a reset signal) during HOVER and ZOOM_OUT phases of each NEW segment. MapCanvas should clear the animated route data when progress is 0.

## Part 2: Import Feature

Add the ability to import a trip from a JSON file. The JSON format:
```json
{
  "name": "Trip Name",
  "locations": [
    { "name": "City", "coordinates": [lng, lat] }
  ],
  "segments": [
    { "fromIndex": 0, "toIndex": 1, "transportMode": "flight" }
  ]
}
```

### Implementation:
1. **projectStore.ts** — Add `importRoute(data)` action that:
   - Clears existing route
   - Adds all locations from the JSON
   - Sets transport modes from the JSON
   - Triggers geometry generation for each segment

2. **LeftPanel.tsx** — Add an "Import" button (with Upload icon) below CitySearch
   - Opens a file picker for .json files
   - Reads the file, parses JSON, calls `importRoute()`

3. **Test fixture** — A fixture file exists at `fixtures/taiwan-trip.json` for testing

## Branch
Create branch: `feat/fixes-and-import`

## How to Verify
1. `npx tsc --noEmit` — must compile
2. `npm run build` — must succeed
3. Import `fixtures/taiwan-trip.json`, play animation → route draws progressively, no jumps, no bearing snap, routes clear between segments
