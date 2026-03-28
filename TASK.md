# TASK.md — Debug & Fix Route Line Visibility Bug

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Bug
During animation playback, route lines for past and current segments are NOT visible. ALL segment layers seem to stay hidden. The visibility useEffect in MapCanvas.tsx is supposed to show past/current segments and hide future ones, but it's not working.

## Your Task
1. Start the dev server: `npm run dev` (it will pick an available port)
2. Open the editor page in Chrome using the Playwright MCP or Chrome DevTools
3. Import the fixture `fixtures/taiwan-trip.json` 
4. Check the browser console for `[visibility]` debug logs
5. Use Chrome DevTools to inspect the Mapbox GL layers:
   - Run in console: `document.querySelector('.mapboxgl-canvas').__mapboxMap` or find the map instance
   - Check `map.getStyle().layers` to see all layers and their visibility
   - Check if segment layer IDs match what the code expects
6. Find the root cause of why layers stay hidden
7. Fix it
8. Verify: import trip → idle state shows ALL lines → play → only past+current visible → future hidden

## Key Files
- `src/components/editor/MapCanvas.tsx` — segment layer creation + visibility management
- `src/components/editor/routeSegmentSources.ts` — helper to set segment GeoJSON data
- `src/components/editor/EditorLayout.tsx` — handles routeDrawProgress events
- `src/stores/animationStore.ts` — playbackState, currentSegmentIndex

## Known Issues
- Segment layers are created with `layout: { visibility: "none" }` by default
- The visibility useEffect should set them to "visible" in idle state
- But something prevents this from working — possibly layer IDs don't match, or the effect runs before layers are created, or map.isStyleLoaded() check fails

## Branch
Create branch: `fix/route-visibility-debug`
