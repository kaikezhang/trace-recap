# TASK — Fix waypoint animation timing

⚠️ DO NOT MERGE. Create PR and stop.

## Problem
When locations are marked as waypoints, their segments get merged into one animation group. This causes the entire merged section to play as a single FLY phase, making it too fast — e.g., Alishan→Chiayi→Taoyuan→Seoul→Seattle all plays in ~2 seconds.

## Current behavior
`buildAnimationGroups()` in `AnimationEngine.ts` merges consecutive segments connected by waypoints into a single group. The merged group gets one set of phases: HOVER → ZOOM_OUT → FLY → ZOOM_IN → ARRIVE. The FLY duration is based on total route length proportion, but for a merged group with many segments, the camera just lerps from start to end.

## Desired behavior
Waypoints should NOT stop the camera (no ARRIVE/HOVER), but the FLY phase should still show each segment individually:
1. Camera should follow the route through each waypoint, not just lerp from first to last
2. Each segment within a merged group should get proportional time based on its distance
3. The route line should draw progressively through each segment
4. Waypoint segments should still support timing overrides in the left panel

## Implementation approach

### Option A: Split merged groups back into individual groups but skip HOVER/ARRIVE for waypoints
Instead of merging segments, keep them as separate groups but with `hoverTime=0` and `arriveDur=0` for waypoint destinations. This means:
- Each segment gets its own FLY phase with proper camera tracking
- Route draws progressively per-segment
- No stopping at waypoints (0 hover/arrive time)
- Camera smoothly transitions between segments

### Changes needed
1. **`AnimationEngine.ts` — `buildAnimationGroups()`**: Don't merge waypoint segments. Keep each segment as its own group.
2. **`AnimationEngine.ts` — timeline building**: For groups where `toLoc.isWaypoint` or `fromLoc.isWaypoint`, set `hoverTime=0` and `arriveDur=0`. Skip HOVER and ARRIVE phases entirely for waypoint groups (just ZOOM_OUT → FLY → ZOOM_IN, or even just FLY).
3. **`AnimationEngine.ts` — city labels**: Don't show city labels for waypoint destinations (already handled since waypoints have no ARRIVE phase).
4. **Left panel timing**: Waypoint segments should still show timing controls. The timing override controls the FLY duration for that segment.

### Key constraint
- Don't break the route drawing logic — each segment's route line should still draw correctly
- Don't break photo display — waypoints have no photos anyway
- Camera should smoothly transition between waypoint segments without jarring cuts

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`

## Verification
- `npx tsc --noEmit` and `npm run build` must pass
- Demo trip: Alishan→Chiayi→Taoyuan→Seoul→Seattle should show each leg clearly
- Camera follows route through each waypoint (not just start→end lerp)
- Route line draws progressively through waypoints
- Non-waypoint stops still have normal HOVER/ARRIVE phases
- Timing overrides work for waypoint segments
