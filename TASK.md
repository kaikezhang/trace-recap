# TASK.md — Waypoint (Fly-through) Feature

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Feature
Allow locations to be marked as "waypoints" (fly-through points) vs "destinations" (full stops). Waypoints are transit/transfer points where the camera should fly through continuously without stopping.

Example: Philadelphia → Seattle(waypoint) → Honolulu — the animation should fly continuously from PHL through SEA to HNL as one smooth motion, not two separate segments.

## Data Model Changes

### types/index.ts
Add `isWaypoint` to Location:
```typescript
interface Location {
  id: string;
  name: string;
  coordinates: [number, number];
  photos: Photo[];
  isWaypoint: boolean;  // NEW — default false
}
```

### stores/projectStore.ts
- Update `addLocation` to include `isWaypoint: false` by default
- Add `toggleWaypoint(locationId: string)` action
- Update `importRoute` to support optional `isWaypoint` field in import JSON
- First and last locations can NEVER be waypoints (they're always destinations)

## Animation Engine Changes

### AnimationEngine.ts — Segment Merging
The engine needs to merge consecutive segments that are connected by waypoints into "animation groups":

```
Locations: PHL → SEA(waypoint) → HNL
Segments:  [PHL→SEA, SEA→HNL]
Animation groups: [{segments: [PHL→SEA, SEA→HNL], fromLoc: PHL, toLoc: HNL}]

Locations: HK → TPE → Jiufen → Taichung(waypoint) → Tainan
Segments:  [HK→TPE, TPE→Jiufen, Jiufen→Taichung, Taichung→Tainan]
Animation groups: [
  {segments: [HK→TPE], fromLoc: HK, toLoc: TPE},
  {segments: [TPE→Jiufen], fromLoc: TPE, toLoc: Jiufen},
  {segments: [Jiufen→Taichung, Taichung→Tainan], fromLoc: Jiufen, toLoc: Tainan},
]
```

For each animation group:
- Merge all segment geometries into ONE continuous LineString (concatenate coordinates)
- Use the first location's coordinates as fromCenter
- Use the last location's coordinates as toCenter
- HOVER/ARRIVE only at the group's from/to locations (skip waypoints)
- FLY phase covers the entire merged route continuously
- Camera zoom is based on the bbox of ALL locations in the group

### CameraController.ts
- Accept animation groups instead of raw segments
- flyZoom computed from the bounding box of all locations in the group
- arriveZoom uses look-ahead to the NEXT group (not next segment)

### Timeline computation
- Each animation group gets ONE set of phases: HOVER → ZOOM_OUT → FLY → ZOOM_IN → ARRIVE
- HOVER/ARRIVE durations based on the group's from/to destinations (same look-ahead logic)
- FLY duration proportional to the merged route's total length

## UI Changes

### LocationCard.tsx
Add a small toggle button on each location card:
- Icon: 🏠 for destination, ✈️ for waypoint
- Click to toggle
- First and last locations: no toggle (always destination)
- When toggled to waypoint: slightly dim the card, show "fly-through" label
- When toggled to destination: normal appearance

### City Labels during animation
- Destination: show full city label with pin icon (existing behavior)
- Waypoint: do NOT show city label

## Import JSON Format
Support optional `isWaypoint` on locations:
```json
{
  "locations": [
    { "name": "Philadelphia", "coordinates": [-75.16, 39.95] },
    { "name": "Seattle", "coordinates": [-122.33, 47.60], "isWaypoint": true },
    { "name": "Honolulu", "coordinates": [-157.85, 21.30] }
  ],
  "segments": [...]
}
```

## Branch
Create branch: `feat/waypoint-flythrough`

## Verification
1. `npx tsc --noEmit` passes
2. `npm run build` passes
3. Import a trip with waypoints → waypoint locations show toggle
4. Play animation → waypoints are flown through without stopping
5. Toggle a destination to waypoint → animation changes accordingly
