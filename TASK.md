# TASK — Export Album Book Animation

⚠️ DO NOT MERGE ANY PR. Create the PR and stop.

## Problem

The preview playback shows a beautiful "fly-to-album" animation where photos shrink and fly into an AlbumBook component (a physical book with spine, pages, and photo grid). The exported video has NO album rendering at all — photos just disappear after the ARRIVE phase.

## Goal

Implement album book rendering in the VideoExporter's canvas pipeline so exported videos match the preview.

## What the Preview Does (React/framer-motion — reference only)

1. **ARRIVE phase**: Photos display in layout (grid/free/template)
2. **Fly-to-album**: Photos shrink and fly toward the chapter pin position (framer-motion animation)
3. **Album book appears**: A book-like component with spine, two pages, paper texture, and photo grid
4. **Album collecting**: Photos populate the album grid with staggered fade-in
5. **Album → visited pin**: The album shrinks down to a small visited chapter pin (circle avatar + title)

Reference files:
- `src/components/editor/AlbumBook.tsx` — Album book component (264 lines)
- `src/components/editor/ChapterPin.tsx` — Chapter pin states (future/album-open/album-collecting/visited)
- `src/components/editor/PhotoOverlay.tsx` — fly-to-album exit animation
- `src/components/editor/ChapterPinsOverlay.tsx` — album state machine
- `src/lib/albumStyles.ts` — Album style configs (vintage-leather, japanese-minimal, classic-hardcover, travel-scrapbook)

## What to Implement in VideoExporter

Add these methods to `src/engine/VideoExporter.ts`:

### 1. `drawAlbumBook(ctx, ...)`
Draw the album book on canvas:
- Two pages (left/right) with page color from album style config
- Spine between pages (with style-specific rendering: stitched, spiral, gold accent)
- Border and shadow matching the style
- Photo grid inside pages using `computeAlbumPageGrid()` and `splitPhotosAcrossPages()` from `src/lib/albumStyles.ts`
- Photos rendered with cover mode and focal point

### 2. Album animation phases in the export timeline

After photos display during ARRIVE, add these transition frames:

**Phase A — Photo fly-to-album (0.4s)**
- Photos shrink from their display positions toward a convergence point (center-bottom area where the chapter pin will be)
- Progressive opacity reduction and scale-down
- Slight blur increase

**Phase B — Album open (0.3s)**  
- Album book fades in at the convergence point
- Scale from 0.94 → 1.0
- Photos populate the grid with staggered fade-in (0.12s delay per photo)

**Phase C — Album hold (0.5s)**
- Album fully visible with all photos displayed
- Slight -3deg rotation (matching the preview's tilt)

**Phase D — Album → visited (0.4s)**
- Album scales down (scale from 1.0 → 0.72)
- Opacity from 1.0 → 0.7
- Transitions into the existing visited chapter pin rendering

### 3. Timeline integration

The album animation should happen BETWEEN:
- The end of the ARRIVE phase photo display 
- The start of the next FLY phase (HOVER → ZOOM_OUT)

This means the total ARRIVE phase duration may need to be extended, OR the album animation should overlap with the existing photo exit timing.

Look at `AnimationEngine.ts` to understand phase timing. The `PHASE_DURATIONS.PHOTO_DISPLAY` is 1.5s. The album animation (~1.6s total) should fit within or slightly extend this window.

### 4. Read album style from UI store

```ts
const albumStyle = useUIStore.getState().albumStyle;
const config = getAlbumStyleConfig(albumStyle);
```

### 5. Use existing infrastructure

- `this.photoImages` map already has preloaded images
- `computeAlbumPageGrid()` and `splitPhotosAcrossPages()` from albumStyles.ts for layout
- `getAlbumStyleConfig()` for style properties
- The existing `drawVisitedChapterPin()` already handles the final visited state

## Constraints

- Canvas 2D only (no DOM, no framer-motion)
- Must work with all 4 album styles
- Must work with all photo layouts (auto, manual/template, free)
- Photo frame styles should be respected in the album grid if practical
- Don't break existing export functionality
- Keep the code clean and well-structured

## Testing

- `npx tsc --noEmit` must pass
- Build should succeed
- The album should appear in exported videos between photo display and the next city transition

## Deliverable

Feature branch `feat/export-album-animation`, PR to main. CREATE PR AND STOP. DO NOT MERGE.
