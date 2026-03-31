# TASK.md — Breadcrumb Thumbnail Trail

⚠️ DO NOT MERGE. Create PR and stop.

## Overview

After leaving a stop, its hero photo shrinks into a tiny circular thumbnail "breadcrumb" that remains pinned to the route at the city's coordinate. As the trip progresses, the full route becomes studded with visual memories — a satisfying accumulation that transforms the final map into a dense visual summary.

## Current Behavior

- After leaving a location, nothing visual remains on the map
- The route line is the only persistent element

## Desired Behavior

### 1. Breadcrumb Data Model

Track breadcrumbs in the animation store:
```ts
interface Breadcrumb {
  locationId: string;
  coordinates: [number, number]; // [lng, lat]
  heroPhotoUrl: string;          // URL of the hero/first photo
  cityName: string;
  visitedAtSegment: number;      // segment index when this was visited
}

breadcrumbs: Breadcrumb[];        // grows as trip progresses
addBreadcrumb: (b: Breadcrumb) => void;
clearBreadcrumbs: () => void;
```

### 2. Breadcrumb Rendering (`src/components/editor/BreadcrumbTrail.tsx`) — NEW

A component that renders all accumulated breadcrumbs on the map:

**Each breadcrumb:**
- Circular thumbnail: 28-36px diameter
- White border (2px)
- Box shadow for depth
- Photo uses `object-fit: cover`
- Positioned at city coordinate via `map.project()`
- Opacity: 0.6-0.8 (slightly faded, not competing with active content)

**Accumulation animation:**
- When a new breadcrumb appears (leaving a city), it shrinks from the active photo size to breadcrumb size with a smooth spring transition
- New breadcrumbs start at full opacity and settle to 0.7

**Visual hierarchy:**
- Breadcrumbs render BELOW the route line and active overlays
- Newest breadcrumb slightly larger/more opaque than older ones (optional)

### 3. Animation Engine Integration (`src/engine/AnimationEngine.ts`)

- When transitioning from ARRIVE to next segment's HOVER, emit a breadcrumb event
- Or: in EditorLayout, detect when `showPhotoOverlay` goes from true→false and add a breadcrumb for that location

### 4. Map Position Tracking

- Breadcrumbs must update position when camera moves (they're geo-anchored)
- Use `map.project(coordinates)` to convert lng/lat to screen pixels
- Update on map `move` events

### 5. Video Export (`src/engine/VideoExporter.ts`)

- Draw breadcrumbs at projected coordinates on the canvas
- Circular clip mask for each thumbnail
- White border stroke
- Draw BEFORE route lines and active photos (behind everything)
- Only draw breadcrumbs for locations that have been "visited" (segment index ≤ current)

### 6. Settings (`src/stores/uiStore.ts`)

```ts
breadcrumbsEnabled: boolean; // default: true
```

Persisted to localStorage. Toggle in global settings area.

## Visual Design

```
Map with route:
  ○ ○ ○ ←── tiny photo circles along the route
  A ──── B ──── C ──── D (current)
  ○       ○       ○
  ^visited ^visited ^visited
```

Each ○ is a 32px circular photo thumbnail with white border, pinned to that city's coordinate.

## Files to create/modify

- `src/components/editor/BreadcrumbTrail.tsx` — NEW: breadcrumb rendering component
- `src/stores/animationStore.ts` — breadcrumb state + actions
- `src/components/editor/EditorLayout.tsx` — add breadcrumb on location exit
- `src/components/editor/MapStage.tsx` — render BreadcrumbTrail component
- `src/engine/VideoExporter.ts` — draw breadcrumbs in export
- `src/stores/uiStore.ts` — breadcrumbsEnabled toggle

## Verification

- `npx tsc --noEmit` and `npm run build` must pass
- Breadcrumbs appear as route progresses past each city
- Breadcrumbs are geo-anchored and move with camera
- Breadcrumbs accumulate (don't disappear)
- Export shows breadcrumbs matching preview
- Toggle enables/disables the feature
- Reset/replay clears breadcrumbs

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`
