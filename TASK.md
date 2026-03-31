# TASK: Hide Chapter Pin Numbers During Playback

⚠️ DO NOT MERGE. Create PR and stop.

## Bug Description

During preview playback, the numbered chapter pins (purple circles with "1", "2", "3" etc.) remain visible on the map. In the exported video, these numbered pins are correctly hidden — only the photo-based chapter pins (small circular thumbnails) appear after a city is visited.

**Expected behavior**: During playback (playing or paused states), the numbered chapter pins should be hidden, matching the export behavior. They should only show when playback is **stopped/idle** (for editing purposes).

## Current Behavior
- **Stopped**: Numbered pins visible ✅ (correct — useful for editing)
- **Playing**: Numbered pins visible ❌ (should be hidden)
- **Paused**: Numbered pins visible ❌ (should be hidden)
- **Export**: Numbered pins hidden ✅ (correct)

## Where to Fix

Look at `src/components/editor/ChapterPinsOverlay.tsx` — this renders the numbered chapter pins on the map. It needs to check the playback state from `animationStore` and hide when playing or paused.

The playback state is available from `useAnimationStore`:
```ts
const playbackState = useAnimationStore((s) => s.playbackState);
// playbackState: "idle" | "playing" | "paused"
```

When `playbackState !== "idle"`, the numbered chapter pins should not render (return null or hide with opacity/display:none).

## Files to Modify
- `src/components/editor/ChapterPinsOverlay.tsx` — Add playback state check to hide pins during playback

## Verification
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] During preview: numbered pins hidden while playing
- [ ] During preview: numbered pins hidden while paused
- [ ] When stopped: numbered pins visible (for editing)
- [ ] Photo-based breadcrumb pins (small photo circles) still appear during playback (these are separate)
