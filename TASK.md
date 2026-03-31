# TASK: Fix Duplicate Photo Display — Photos Show Multiple Times Per City

⚠️ DO NOT MERGE. Create PR and stop.

## Bug Description

During playback (both preview and video export), each city's photos are displayed **multiple times** instead of once. Users see:
1. The **previous city's** photos (outgoing, supposed to be gone)
2. The **current city's** photos (correct)
3. The **next city's** photos (shouldn't be visible yet — we haven't traveled there)

This results in 2-3 overlapping sets of photos at once, making it look broken.

## Root Cause: Scene Transition System

The scene transition system (`dissolve`, `blur-dissolve`, `wipe`) was designed for **instantaneous** location switches where photos from one city cross-fade directly into the next. But TraceRecap has a **FLY phase** (traveling animation) between cities — the photos should fully disappear before travel begins and only reappear at the next destination's ARRIVE phase.

The current flow for consecutive cities A → B → C, all with photos:

1. **ARRIVE at A** → `showPhotos=true`, A's photos shown ✅
2. **HOVER at B** (departing A) → `showPhotos=true` (A fading out), `sceneTransitionProgress` defined, `incomingGroupIndex=B` → **B's photos start appearing as "incoming"** ❌ (B hasn't been visited yet!)
3. **ZOOM_OUT at B** → same as above, B's incoming photos continue showing ❌
4. **ZOOM_IN at B** → `sceneTransitionProgress` defined, B's incoming photos at higher opacity ❌
5. **FLY at B** → no sceneTransitionProgress, but...
6. **ARRIVE at B** → `showPhotos=true`, B's photos shown again with enter animation → **duplicate!**

The problem is in `AnimationEngine.renderFrame()` (around line 485-510). The scene transition fires during HOVER/ZOOM_OUT/ZOOM_IN whenever `prevHasPhotos || nextHasPhotos`, which causes **incoming photos to appear prematurely** during the departure phases, long before the camera has flown to the next city.

## The Fix

**Disable scene transitions entirely.** The cross-fade between photo sets doesn't make sense when there's a FLY phase (travel animation) separating them. Each city's photos should:
- Appear with enter animation during **ARRIVE** only
- Fade out during the next group's **HOVER/ZOOM_OUT** only
- Never show "incoming" photos from a city we haven't traveled to yet

### Specific changes needed:

#### 1. `src/engine/AnimationEngine.ts` — `renderFrame()` method

Remove or disable the scene transition metadata block (the section that sets `sceneTransitionProgress`, `outgoingGroupIndex`, `incomingGroupIndex`, `transitionBearing`). These fields should always be `undefined`.

The `showPhotos` + `photoOpacity` logic is correct and should stay:
- ARRIVE → showPhotos=true, photoOpacity=1
- Next group's HOVER → showPhotos=true, photoOpacity fades 1→0
- Next group's ZOOM_OUT → showPhotos=true, photoOpacity fades 0.3→0

#### 2. `src/components/editor/EditorLayout.tsx` — progress handler

The code that sets `incomingPhotos` based on `sceneTransitionProgress` will naturally stop firing since the engine no longer emits those fields. But verify that `setIncomingPhotos([])` is still called to clean up.

#### 3. `src/engine/VideoExporter.ts` — `drawSceneTransitionPhotos()`

This method draws incoming photos during export. Since `sceneTransitionProgress` will always be `undefined`, it will early-return and do nothing. The existing `drawPhotos()` method handles the normal ARRIVE + fade-out path correctly when `isInSceneTransition` is false.

#### 4. `src/components/editor/PhotoOverlay.tsx`

The incoming photos section (`hasIncomingPhotos && ...`) will naturally not render since `incomingPhotos` will always be empty. No changes strictly needed, but you can clean up dead code if you want.

#### 5. `src/stores/uiStore.ts`

The `sceneTransition` setting in the UI store (and any UI controls for selecting dissolve/wipe/blur) can stay for now — they just won't have any effect. Don't remove them yet.

### What NOT to change:
- The `showPhotos` / `photoOpacity` logic — this correctly handles photo enter/exit
- The `PhotoOverlay` component's enter/exit animations — these work correctly for single-city display
- Photo layout, Ken Burns, bloom, portal styles — all unrelated
- City labels, route labels, breadcrumbs — all unrelated

## Verification

1. `npx tsc --noEmit` passes
2. `npm run build` passes
3. During preview playback:
   - Each city shows its photos ONCE during ARRIVE
   - Photos fade out when departing (HOVER/ZOOM_OUT of next group)
   - No "incoming" photos from future cities appear
   - No overlapping photo sets from multiple cities
4. Video export matches preview behavior
