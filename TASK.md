# TASK.md — Fix layout editor preview consistency (use PhotoOverlay)

⚠️ DO NOT MERGE. Create PR and stop.

## Problem
The Layout Editor's preview (`LayoutPreview` component) renders photos differently from the actual playback (`PhotoOverlay` component). They use separate rendering logic, leading to visual mismatches — what you see in the editor ≠ what you see during playback ≠ what gets exported.

## Solution
Replace `LayoutPreview` in `PhotoLayoutEditor.tsx` with the actual `PhotoOverlay` component. This ensures the editor preview is identical to playback.

### Implementation

1. **Remove `LayoutPreview`** function component from `PhotoLayoutEditor.tsx`
2. **Import and use `PhotoOverlay`** in its place
3. Pass the same props that the actual playback uses:
   - `photos`: the ordered photos array
   - `visible`: true (always visible in editor preview)
   - `photoLayout`: the current layout being edited
   - `opacity`: 1
4. The `PhotoOverlay` component already handles:
   - Real photo aspect ratios (loads dimensions via Image.onload)
   - All layout modes (auto, grid, hero, filmstrip, scatter)
   - Container aspect ratio via ResizeObserver
   - Focal points, captions, ordering
5. Wrap `PhotoOverlay` in the preview container that already has the map snapshot background and correct viewport ratio sizing

### Key changes
- `src/components/editor/PhotoLayoutEditor.tsx`:
  - Remove `LayoutPreview` component and `usePhotoDimensions` hook (if duplicated from PhotoOverlay)
  - Import `PhotoOverlay` from `./PhotoOverlay`
  - Replace `<LayoutPreview ... />` with `<PhotoOverlay photos={orderedPhotos} visible={true} photoLayout={layout} opacity={1} />`
  - The `PreviewWithMapBackground` wrapper stays — it provides the map snapshot background and correct aspect ratio container
  - PhotoOverlay uses `absolute inset-0` positioning, so it should fill the preview container naturally

### Verify
- `npx tsc --noEmit` must pass
- `npm run build` must pass
- Layout editor preview matches exactly what you see during playback
- Changing layout style in editor updates preview correctly
- All layout modes work: auto, grid, hero, filmstrip

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`
