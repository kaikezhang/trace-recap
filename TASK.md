# TASK.md — Audit & Fix Route Visibility During Animation

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Current Behavior (WRONG)
When animation plays:
- ALL route lines are visible from the start (including future segments that haven't been traveled yet)
- The current segment's line gets HIDDEN then progressively redrawn as it's traveled
- This looks like the line disappears then reappears

## Expected Behavior (CORRECT)
When animation plays:
- **Past segments** (already completed): full route line visible
- **Current segment**: line progressively drawn from 0% to 100% as the icon travels
- **Future segments**: HIDDEN (not visible at all until their turn)
- When animation stops/resets: ALL lines visible

## What to Audit & Fix

### 1. Read and understand the current code flow:
- `src/components/editor/MapCanvas.tsx` — has a `useEffect` that manages layer visibility based on `playbackState` and `currentSegmentIndex`
- `src/components/editor/routeSegmentSources.ts` — has `updateSegmentProgress()` that updates a segment's GeoJSON source with sliced geometry
- `src/components/editor/EditorLayout.tsx` — handles `routeDrawProgress` events from the engine and calls the update functions
- `src/stores/animationStore.ts` — has `currentSegmentIndex` state

### 2. The visibility logic in MapCanvas.tsx should work like this:

When `playbackState === "playing"` or `"paused"`:
```
for each segment at index i:
  if i < currentSegmentIndex:
    // Past: show full line
    set layer visibility = "visible"
    restore full geometry to source (in case it was sliced)
  
  if i === currentSegmentIndex:
    // Current: show layer, geometry is being updated by routeDrawProgress
    set layer visibility = "visible"
  
  if i > currentSegmentIndex:
    // Future: hide
    set layer visibility = "none"
```

When `playbackState === "idle"`:
```
for each segment:
  set layer visibility = "visible"
  restore full geometry to source
```

### 3. Key issue to check:
- Is `currentSegmentIndex` being updated correctly in the store? (It should be set in EditorLayout's `progress` event handler)
- Is the visibility `useEffect` in MapCanvas reacting to `currentSegmentIndex` changes?
- When currentSegmentIndex changes from N to N+1, segment N needs its full geometry restored
- The `routeSegmentSources.ts` `updateSegmentProgress()` modifies the segment source data — when a segment completes, its source needs to be reset to the FULL geometry

### 4. Critical: Store and restore original geometries
When the animation modifies a segment's GeoJSON source (slicing it for progressive draw), the ORIGINAL full geometry must be stored somewhere so it can be restored when:
- The segment is "completed" (currentSegmentIndex moves past it)
- The animation stops/resets

Check if `routeSegmentSources.ts` or MapCanvas stores the original geometries. If not, add a mechanism for this.

## Branch
Create branch: `fix/route-visibility-v2`
