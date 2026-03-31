# TASK: Fix Codex Review Issues on PR #74 (Trip Stats Spine)

⚠️ DO NOT MERGE. Push fixes to `feat/trip-stats` branch only.

## Issues to Fix (from Codex review)

### 1. Export distance never animates during FLY
- `drawTripStats()` reads `progress.routeDrawFraction` from `"progress"` events
- But `routeDrawFraction` is only emitted on `"routeDrawProgress"` events
- **Fix**: In VideoExporter, also capture `routeDrawFraction` from `routeDrawProgress` events and pass it to `drawTripStats()`

### 2. `computeTripStats()` advances cities and transport too early
- City count increases on `ZOOM_IN` but should increase on `ARRIVE`
- Transport mode icon appears on `HOVER`/`ZOOM_OUT` before that mode is used
- **Fix**: City count should only increment on `ARRIVE`. Transport mode should only appear when that segment's `FLY` phase starts.

### 3. Transport modes not in first-use order
- Hardcoded `MODE_ORDER` sorts by a fixed list instead of first-use order
- **Fix**: Track insertion order — modes should appear in the order they are first encountered during the trip

### 4. Export bar layout doesn't match preview
- Preview uses separate sections, separators, per-mode motion elements
- Export collapses everything into a single `fillText()` string
- **Fix**: Export should render each section/icon individually with proper spacing, matching the preview layout. Add fade/slide-in timing to match framer-motion animations.

## Constraints
- `npx tsc --noEmit` must pass
- `npm run build` must pass
- Push to `feat/trip-stats` branch
- DO NOT create a new PR or merge anything
