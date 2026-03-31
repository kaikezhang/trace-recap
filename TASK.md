# TASK.md — Trip Stats Spine

⚠️ DO NOT MERGE. Create PR and stop.

## Overview

Add a "Trip Stats" overlay that grows with the trip, showing accumulated statistics as the route progresses. Stats appear as a slim information bar along the bottom edge of the map, revealing distance traveled, countries/cities visited, photo count, and transport modes used. This gives TraceRecap a "recap" identity — not just animation, but a data-rich trip summary.

## Current Behavior

- No statistics or data overlays during playback
- Route distance is calculated but not displayed

## Desired Behavior

### 1. Stats Data Model (`src/lib/tripStats.ts`) — NEW

Compute stats from project data:
```ts
interface TripStats {
  totalDistanceKm: number;       // sum of all segment distances
  citiesVisited: number;         // count of non-waypoint locations visited so far
  totalCities: number;           // total non-waypoint locations
  photosShown: number;           // photos in visited locations
  totalPhotos: number;           // all photos
  transportModes: Map<string, number>; // mode → distance in km
  currentSegmentIndex: number;
  elapsedPercent: number;        // 0-1 trip progress
}
```

Function: `computeTripStats(locations, segments, currentSegmentIndex)` → `TripStats`

### 2. Stats Bar Component (`src/components/editor/TripStatsBar.tsx`) — NEW

A slim bar at the bottom of the map viewport:

**Layout (horizontal, left to right):**
```
📍 3/7 cities  |  📸 12 photos  |  🛣️ 847 km  |  ✈️🚄🚗
```

**Design:**
- Height: 32-40px
- Background: bg-black/50 backdrop-blur-sm
- Text: white, 12-13px, tabular-nums for numbers
- Icons: emoji or Lucide icons
- Separator: thin vertical divider (white/20%)
- Rounded top corners
- Positioned at bottom center of map viewport

**Animation:**
- Stats counter-animate as they increase (numbers tick up)
- New transport mode icons slide in when first used
- Bar fades in when playback starts, fades out when stopped

**Progressive reveal:**
- Cities count: updates as each city is visited
- Photo count: updates as each city's photos are shown
- Distance: ticks up continuously during FLY phases
- Transport modes: icon appears when that mode is first used

### 3. Animation Integration

- Stats update on every `progress` event from AnimationEngine
- Distance accumulates proportionally during FLY phase based on segment progress
- Cities count increases on ARRIVE at non-waypoint locations
- Photo count increases when photos are shown

### 4. Video Export (`src/engine/VideoExporter.ts`)

Draw the stats bar on the canvas:
- Same layout as preview
- Positioned at bottom center
- Semi-transparent background with rounded corners
- White text with proper font sizing (scaled to canvas)
- Transport mode icons as text/emoji

### 5. Settings (`src/stores/uiStore.ts`)

```ts
tripStatsEnabled: boolean; // default: true
```

Persisted to localStorage.

## Stats Computation Details

**Distance:**
- Use `turf.length(segment.geometry)` for each segment
- During FLY phase, interpolate: `segmentDistance * flyProgress`
- Sum all completed segments + partial current segment

**Transport modes:**
- Read from `segment.transportMode` for completed segments
- Show as small icons in order of first use
- Available modes: walk, car, bus, train, flight, bicycle, ferry, motorcycle

**Cities:**
- Count non-waypoint locations where segment index ≤ current
- Format: "3/7 cities" or just "3 cities"

## Files to create/modify

- `src/lib/tripStats.ts` — NEW: stats computation
- `src/components/editor/TripStatsBar.tsx` — NEW: stats bar component
- `src/components/editor/MapStage.tsx` — render TripStatsBar
- `src/engine/VideoExporter.ts` — draw stats in export
- `src/stores/uiStore.ts` — tripStatsEnabled toggle

## Verification

- `npx tsc --noEmit` and `npm run build` must pass
- Stats bar appears during playback at bottom of viewport
- Numbers update progressively as trip progresses
- Distance ticks up during travel
- Transport mode icons appear when first used
- Export shows stats bar matching preview
- Toggle enables/disables the feature

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`
