# TASK — Photo-to-Album Pin Animation ("Memory Collection")

⚠️ CREATE PR AND STOP. DO NOT MERGE.

## Overview
Redesign the photo exit animation and chapter pin to create a "memory collection" effect:
photos fly into an album-style pin, the album closes with a cover photo, then
slowly transitions to a small visited map pin after leaving the city.

## Animation Flow (4 phases)

### Phase 1: Photos Displayed
- Current behavior: photos shown with PhotoOverlay, active ChapterPin visible
- **Change**: Replace current active ChapterPin card with a larger "open album" visual

### Phase 2: Photos Fly Into Album (0.5s)
- All photos shrink simultaneously and fly toward the ChapterPin position on the map
- The album pin shows photos landing inside it (visual: pages being filled)
- This replaces the current photo exit animation in PhotoOverlay
- Duration: 0.5 seconds
- Easing: ease-in (accelerating toward the pin)

### Phase 3: Album Closes
- After all photos arrive, the album "closes" with a satisfying animation
- The first photo becomes the album cover
- Visual: like a photo book snapping shut
- Duration: ~0.3s
- Result: a compact album icon showing the cover photo + city name

### Phase 4: Album → Visited Pin (slow, async)
- When the route moves away from this city (HOVER/ZOOM_OUT phase begins)
- The album slowly shrinks and fades to the small visited pin style (circular photo thumbnail, 0.5 opacity)
- Duration: 1-2 seconds (slow, doesn't block the route animation)
- This is purely visual polish, happens in the background

## Technical Implementation

### ChapterPin.tsx — Complete Redesign
Replace current active/visited states with 4 states:
```typescript
type ChapterPinState = "future" | "album-open" | "album-collecting" | "album-closed" | "visited";
```

**album-open**: Large album visual (like an open photo book). Shows city name.
- Size: ~80x60px book shape with subtle 3D perspective
- Color: white/cream with soft shadow
- City name below

**album-collecting**: Photos flying in. Show a stack effect as photos arrive.
- Same album visual but with a "filling" animation
- Each photo that arrives adds to the visual stack

**album-closed**: Closed album with cover photo.
- Size: ~48x48px
- Shows first photo as cover, rounded corners, slight book spine shadow
- City name below
- Emoji if set

**visited**: Current small circular thumbnail (existing style but keep it)
- Size: 32x32px circular photo
- Opacity: 0.5
- City name below in small text

### PhotoOverlay.tsx — New Exit Animation
When photos exit (opacity going from 1→0), instead of current fade/scale/slide:
1. Calculate the ChapterPin screen position (need to pass pin coordinates)
2. Each photo shrinks (scale: 1→0.15) and translates toward the pin position
3. All photos move simultaneously
4. Duration: 0.5s, easing: cubic-bezier(0.4, 0, 0.2, 1)
5. Photos should slightly rotate during flight for visual flair (~5-10deg)
6. On arrival, photos disappear (opacity: 0)

### EditorLayout.tsx — State Coordination
Need to coordinate between PhotoOverlay exit and ChapterPin state:
1. When photo exit begins → ChapterPin state = "album-collecting"
2. When photo exit completes (0.5s later) → ChapterPin state = "album-closed"
3. When leaving city (HOVER phase) → ChapterPin state = "visited" (slow transition)

This may require new animation store fields:
- `albumCollectingLocationId: string | null` — which pin is currently collecting
- Pass the pin's screen position to PhotoOverlay for the fly-to target

### Key Constraints
- Must work with ALL photo styles (classic, kenburns, bloom, portal)
- The bloom style already has its own exit — the fly-to-album should replace it or integrate
- Must work on both mobile and desktop
- Pin screen position comes from `map.project(coordinates)` — same as current ChapterPinsOverlay
- The animation timing must not extend the total route duration — phase 4 runs async

## Files to Modify
- `src/components/editor/ChapterPin.tsx` — complete redesign
- `src/components/editor/ChapterPinsOverlay.tsx` — new state management
- `src/components/editor/PhotoOverlay.tsx` — new exit animation targeting pin position
- `src/components/editor/EditorLayout.tsx` — coordination between overlay and pins
- `src/stores/animationStore.ts` — possibly new state fields

## Verification
- `npx tsc --noEmit` must pass
- `npm run build` must pass
- Test with demo route: Seattle → Honolulu → Tokyo → ... (has varying photo counts)
