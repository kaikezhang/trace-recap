# WYSIWYG Audit Across 5 Photo Rendering Surfaces

## Scope

This audit compares these five rendering surfaces:

1. PhotoLayoutEditor Preview, non-Free modes
2. PhotoLayoutEditor Preview, Free mode
3. Scrubber or paused preview while dragging timeline
4. Playback or live animation preview
5. Exported video rendering

Files audited:

- `src/components/editor/PhotoLayoutEditor.tsx`
- `src/components/editor/PhotoOverlay.tsx`
- `src/components/editor/FreeCanvas.tsx`
- `src/components/editor/PhotoFrame.tsx`
- `src/components/editor/MapStage.tsx`
- `src/components/editor/EditorLayout.tsx`
- `src/lib/photoLayout.ts`
- `src/lib/frameStyles.ts`
- `src/lib/viewportRatio.ts`
- `src/engine/VideoExporter.ts`
- `src/engine/AnimationEngine.ts`
- `src/app/api/encode-video/frame/route.ts`
- `src/app/api/encode-video/route.ts`

## Executive Summary

Top mismatches:

1. Free-mode editor preview crops photos with `object-cover`, while playback and export render the same free-mode photos with `object-contain`. This is the most visible WYSIWYG break for free layouts.
2. Export does not use `PhotoFrame` or `photoFrameStyle` at all. Preview and live surfaces use the global frame style from `useUIStore`; export substitutes its own canvas drawing and only special-cases `layout.template === "polaroid"`.
3. Scrubber or paused preview can lose `visiblePhotoLocationId` immediately after `handleSeek()`, which drops the location-specific `photoLayout` and origin metadata while photos remain visible.
4. Playback and scrub preview are not frame-accurate for photo enter or exit state. `AnimationEngine` emits time-varying `photoOpacity`, but `EditorLayout` only passes `0` or `1` into `PhotoOverlay`; `PhotoOverlay` then runs mount-time Framer Motion animations instead of timeline-derived states.
5. Captions diverge strongly in export: free-mode caption backgrounds are dropped, non-free caption pills and inline frame captions are not reproduced, and long-caption wrapping behavior differs across surfaces.

## Comparison Matrix

Legend:

- `Match`: same practical output path
- `Partial`: mostly aligned, but with measurable drift or style-specific divergence
- `Mismatch`: observable difference or different rendering contract

| Audit Area | Surface 1 Non-Free Editor Preview | Surface 2 Free Editor Preview | Surface 3 Scrubber / Paused | Surface 4 Live Playback | Surface 5 Export |
|---|---|---|---|---|---|
| A. Container sizing | Partial. Uses fitted preview container, then `PhotoOverlay` in `parent` mode with `95% x 88%` inset. | Partial. Same outer fitted preview, but `FreeCanvas` gets rounded inset pixels. | Partial. Same `PhotoOverlay` viewport inset path as live, but scrub state can lose location metadata. | Match with surface 3 structurally. | Partial. Uses fixed canvas resolution and same `95% x 88%` fractions, but on export target pixels. |
| B. Layout computation | Match with live for non-free layouts. Uses shared `computeAutoLayout` and `computeTemplateLayout`. | Partial. Free transforms come from reconciled fallback plus editor-only gesture state. | Mismatch. Can fall back to missing `photoLayout` after seek. | Match with surface 1 when location metadata is intact. | Partial. Shared layout math, but export orders and renders against canvas scale, not DOM measurement. |
| C. Photo frame rendering | Match with live. Uses `PhotoFrame` and `photoFrameStyle` from `useUIStore`. | Match with live free mode. Uses `PhotoFrame` with `disableDecorativeRotation`. | Match with live if location metadata is intact. | Match with surface 1 or 2, depending on mode. | Mismatch. Does not use `PhotoFrame` or `photoFrameStyle`; canvas code substitutes its own frame treatment. |
| D. Caption rendering | Match with live non-free path. | Partial. Editor uses `FreeCanvas` caption DOM, playback uses `PhotoOverlay` caption DOM. | Mismatch. Same caption code as live, but seek can drop location layout and timeline state. | Partial. Caption styling matches editor better than export, but animation state is mount-time, not timeline-time. | Mismatch. Backgrounds, inline frame captions, pill styling, and long-text behavior differ. |
| E. Photo sizing and object fit | Match with live non-free path. Mostly `object-contain`, `object-cover` only for Ken Burns or portal. | Mismatch. Uses `object-cover`. | Match with live playback path. | Match with surface 1 for non-free, mismatch with surface 2 for free. | Match with live non-free classic or Ken Burns intent, mismatch with free editor. |
| F. Z-index ordering | Match with live for non-free. | Match. Sorts by `zIndex`. | Match in renderer, but scrub can lose layout metadata. | Match. | Match. Export sorts free-mode photos by `zIndex`. |
| G. Animation state at rest | Partial. Static preview; some styles are forced to settled state. | Match for free static layout only. | Mismatch. Not frame-accurate while scrubbing or after seek. | Partial. Natural playback animates, but not from timeline-derived photo state. | Partial. Export is frame-derived, but does not reproduce `PhotoFrame` visuals. |
| H. Coordinate normalization | Partial. Shared normalized rects, but preview measurements use fitted panel pixels. | Partial. Same normalized data, but rounded inset width and height plus DOM measurement. | Mismatch. Seek path can clear the location reference used to resolve the right layout. | Match structurally with surface 1 or 2. | Partial. Uses normalized rects, but scales from export target against `canvas.clientWidth` and `canvas.clientHeight`. |

## Surface Traces

### 1. Non-Free Editor Preview

- Entry: `PhotoLayoutEditor` renders `PhotoOverlay` with `containerMode="parent"` and `visible={true}` at `src/components/editor/PhotoLayoutEditor.tsx:1216-1226`.
- Preview container is fitted to the selected aspect ratio via `previewPixelSize` and `previewContainerStyle` at `src/components/editor/PhotoLayoutEditor.tsx:808-859`.
- Layout math uses shared `computeTemplateLayout` and `computeAutoLayout` at `src/components/editor/PhotoLayoutEditor.tsx:870-901`.
- Rendering then flows through `PhotoOverlay` non-free branches at `src/components/editor/PhotoOverlay.tsx:350-368`, `src/components/editor/PhotoOverlay.tsx:440-470`, and `src/components/editor/PhotoOverlay.tsx:867-955`.

### 2. Free Editor Preview

- Entry: `PhotoLayoutEditor` renders `FreeCanvas` inside a `95% x 88%` wrapper at `src/components/editor/PhotoLayoutEditor.tsx:1192-1211`.
- `containerSize` is rounded before it reaches `FreeCanvas` at `src/components/editor/PhotoLayoutEditor.tsx:1193-1204`.
- Free transforms are reconciled from shared fallback rects plus saved free transforms at `src/components/editor/PhotoLayoutEditor.tsx:902-913` and `src/components/editor/PhotoLayoutEditor.tsx:191-222`.
- Rendering occurs in `FreeCanvas` at `src/components/editor/FreeCanvas.tsx:389-396` and `src/components/editor/FreeCanvas.tsx:1163-1344`.

### 3. Scrubber / Paused Preview

- Entry: `PlaybackControls` slider calls `onSeek` on every drag step at `src/components/editor/PlaybackControls.tsx:179-188`.
- `EditorLayout.handleSeek()` calls `engine.seekTo(progress)` and then clears `visiblePhotoLocationId` at `src/components/editor/EditorLayout.tsx:889-928`.
- `MapStage` still renders `PhotoOverlay` in viewport mode with `photos={visiblePhotos}` at `src/components/editor/MapStage.tsx:238-258`.
- Because `photoLayout` is derived from `visiblePhotoLocation?.photoLayout` in `EditorLayout` at `src/components/editor/EditorLayout.tsx:1157-1160` and `src/components/editor/EditorLayout.tsx:1199-1202`, clearing `visiblePhotoLocationId` can decouple visible photos from the correct layout.

### 4. Playback / Live Preview

- Entry: `AnimationEngine` emits progress events; `EditorLayout` updates stores and `MapStage` renders `PhotoOverlay` at `src/components/editor/EditorLayout.tsx:521-749` and `src/components/editor/MapStage.tsx:238-258`.
- Live rendering path is the same `PhotoOverlay` component used by scrub preview.
- Timing comes from Framer Motion enter and exit animations in `PhotoOverlay`, not from timeline-resolved per-photo animation progress, at `src/components/editor/PhotoOverlay.tsx:823-877`, `src/components/editor/PhotoOverlay.tsx:967-987`, and `src/components/editor/PhotoOverlay.tsx:1034-1049`.

### 5. Export

- Export is client-side composition in `VideoExporter`; the API routes only create the temp dir, accept frame uploads, and run FFmpeg at `src/app/api/encode-video/start/route.ts:6-18`, `src/app/api/encode-video/frame/route.ts:5-61`, and `src/app/api/encode-video/route.ts:10-157`.
- Export canvas size is chosen by `getExportViewportSize()` and scaled against `canvas.clientWidth` and `canvas.clientHeight` at `src/lib/viewportRatio.ts:55-76` and `src/engine/VideoExporter.ts:2424-2454`.
- Outgoing photo rendering is in `drawPhotos()` at `src/engine/VideoExporter.ts:1379-2036`.
- Incoming transition rendering is in `drawSceneTransitionPhotos()` at `src/engine/VideoExporter.ts:2043-2386`.

## Specific Discrepancies

### 1. Free-mode object fit diverges: editor crops, playback and export contain

Affected surfaces:

- Surface 2 vs surfaces 3, 4, 5

Code locations:

- Free editor preview uses `object-cover`: `src/components/editor/FreeCanvas.tsx:1208-1215`
- Playback and scrub preview use `object-contain`: `src/components/editor/PhotoOverlay.tsx:945-952` and `src/components/editor/PhotoOverlay.tsx:1103-1110`
- Export classic rendering also uses contain math for non-Ken-Burns: `src/engine/VideoExporter.ts:1946-1958` and `src/engine/VideoExporter.ts:2324-2327`

What differs:

- In free editor preview, the image fills the frame and crops.
- In free playback and export, the same free transform shows the whole image inside the frame.

Why:

- Surface 2 uses `FreeCanvas`.
- Surfaces 3 and 4 reuse `PhotoOverlay`, which does not switch free mode to `object-cover`.
- Surface 5 reproduces the `PhotoOverlay` classic contain behavior in canvas math.

Root cause:

- Different code paths

Impact:

- High. Users positioning focal points or composing crop-sensitive free layouts will see a different photo crop once they leave the editor.

### 2. Export ignores `photoFrameStyle` and does not use `PhotoFrame`

Affected surfaces:

- Surface 5 vs surfaces 1, 2, 3, 4

Code locations:

- Preview and live surfaces read `photoFrameStyle` from UI store:
  - `src/components/editor/PhotoLayoutEditor.tsx:692`
  - `src/components/editor/PhotoOverlay.tsx:322`
  - `src/components/editor/FreeCanvas.tsx:369`
- Shared frame component:
  - `src/components/editor/PhotoFrame.tsx:57-151`
  - `src/lib/frameStyles.ts:25-116`
- Export dialog does not pass `photoFrameStyle` to `VideoExporter`:
  - `src/components/editor/ExportDialog.tsx:98-109`
- Export renderer never reads `photoFrameStyle` or `PhotoFrame`:
  - `src/engine/VideoExporter.ts:1379-2036`
  - `src/engine/VideoExporter.ts:2043-2386`

What differs:

- Preview and live surfaces render polaroid, borderless, film-strip, classic-border, and rounded-card via `PhotoFrame`.
- Export substitutes:
  - a special polaroid path only when `layout.template === "polaroid"` at `src/engine/VideoExporter.ts:1836-1927` and `src/engine/VideoExporter.ts:2263-2312`
  - a generic rounded-rect image path for everything else at `src/engine/VideoExporter.ts:1928-2007` and `src/engine/VideoExporter.ts:2313-2357`

Why:

- `photoFrameStyle` lives only in `useUIStore`, not `PhotoLayout`.
- Export settings include `photoAnimation` and `photoStyle`, but not `photoFrameStyle` at `src/types/index.ts:86-96` and `src/components/editor/ExportDialog.tsx:98-109`.
- Export therefore cannot reproduce `PhotoFrame` config: frame padding, background, shadow, outer radius, media radius, film perforations, vignette, inline caption styling, or decorative rotation.

Root cause:

- Different props

Impact:

- High. Any non-default frame style is visually inconsistent in export.

### 3. Scrubber seek can detach `visiblePhotos` from the correct `photoLayout`

Affected surfaces:

- Surface 3

Code locations:

- `handleSeek()` clears location reference after `engine.seekTo(progress)`:
  - `src/components/editor/EditorLayout.tsx:893-928`
- Progress handler sets location-specific visible photos and layout source:
  - `src/components/editor/EditorLayout.tsx:701-718`
- `MapStage` receives `photoLayout` from `visiblePhotoLocation?.photoLayout`:
  - `src/components/editor/EditorLayout.tsx:1157-1160`
  - `src/components/editor/EditorLayout.tsx:1199-1202`

What differs:

- During timeline dragging, `visiblePhotos` can remain populated while `visiblePhotoLocationId` is force-cleared.
- That means scrub preview may render the right photos with `photoLayout` as `undefined`.

Observable result:

- Auto layout can appear instead of saved manual or free layout.
- Portal and bloom origin metadata can disappear because `photoLocationId` and `originCoordinates` are derived from the cleared location reference.

Why:

- `engine.seekTo()` synchronously emits progress, which can set the correct location.
- `handleSeek()` then clears `visiblePhotoLocationId` immediately afterward, overriding the just-computed state.

Root cause:

- Different props

Impact:

- High. This directly affects the scrubber surface the task asked to audit.

### 4. Playback and scrub preview are not frame-accurate for enter and exit state

Affected surfaces:

- Surfaces 3 and 4 vs surface 5

Code locations:

- Engine emits time-varying photo opacity during HOVER and ZOOM_OUT:
  - `src/engine/AnimationEngine.ts:458-480`
- `EditorLayout` ignores `e.photoOpacity` and only writes `0` or `1`:
  - `src/components/editor/EditorLayout.tsx:562-583`
  - all `setPhotoOverlayOpacity()` call sites: `src/components/editor/EditorLayout.tsx:256`, `src/components/editor/EditorLayout.tsx:564`, `src/components/editor/EditorLayout.tsx:570`, `src/components/editor/EditorLayout.tsx:582`
- `PhotoOverlay` exit behavior is driven by `opacity` prop:
  - `src/components/editor/PhotoOverlay.tsx:343`
  - `src/components/editor/PhotoOverlay.tsx:718-720`
  - `src/components/editor/PhotoOverlay.tsx:855-865`
- `PhotoOverlay` enter animations are mount-time Framer Motion animations:
  - `src/components/editor/PhotoOverlay.tsx:823-877`
  - `src/components/editor/PhotoOverlay.tsx:967-987`
- Export computes per-frame enter and exit progress:
  - `src/engine/VideoExporter.ts:1700-1819`

What differs:

- Playback and scrub preview do not interpolate photo exit based on timeline opacity.
- Scrubbing into the middle of an ARRIVE animation does not show the timeline-correct partial enter state; it shows the state produced by the current React mount and Framer Motion lifecycle.
- Export does compute frame-accurate enter and exit transforms.

Why:

- Engine exposes timeline state.
- Preview path does not wire that state into `PhotoOverlay` except as binary show/hide.
- Export path derives animation state from frame index and captured timeline time.

Root cause:

- Timing and animation residuals

Impact:

- High for scrubber parity, medium to high for live preview parity versus export.

### 5. Editor preview for bloom style is not WYSIWYG

Affected surfaces:

- Surface 1 vs surfaces 4 and 5

Code locations:

- Editor preview passes no `bloomOrigin`:
  - `src/components/editor/PhotoLayoutEditor.tsx:1216-1226`
- Bloom layout only activates when `bloomOrigin` exists:
  - `src/components/editor/PhotoOverlay.tsx:473-488`
  - `src/components/editor/PhotoOverlay.tsx:723-815`
- Live playback supplies `bloomOrigin` from `EditorLayout` and `MapStage`:
  - `src/components/editor/EditorLayout.tsx:423-447`
  - `src/components/editor/MapStage.tsx:243-244`
- Export computes a bloom origin from map projection:
  - `src/engine/VideoExporter.ts:1640-1668`
  - `src/engine/VideoExporter.ts:1725-1803`

What differs:

- In editor preview, bloom style falls back to the normal rect layout because the geo-anchored origin is missing.
- In live playback and export, bloom style uses the radial fan layout and tether lines.

Why:

- Bloom requires a screen-space origin.
- The editor preview path does not provide one.

Root cause:

- Different props

Impact:

- High for bloom style, none for other styles.

### 6. Caption visuals diverge heavily in export

Affected surfaces:

- Surface 5 vs surfaces 1, 2, 3, 4

Code locations:

- Free-mode captions preserve `bgColor`, `color`, `fontFamily`, `fontSize`, and `rotation` in preview and live:
  - `src/components/editor/FreeCanvas.tsx:1322-1339`
  - `src/components/editor/PhotoOverlay.tsx:44-61`
  - `src/components/editor/PhotoOverlay.tsx:791-811`
  - `src/components/editor/PhotoOverlay.tsx:956-987`
  - `src/components/editor/PhotoOverlay.tsx:1114-1131`
- Export free-mode captions draw text only:
  - `src/engine/VideoExporter.ts:2011-2029`
  - `src/engine/VideoExporter.ts:2361-2379`
- Non-free preview and live footer captions use pill backgrounds:
  - `src/components/editor/PhotoOverlay.tsx:764-780`
  - `src/components/editor/PhotoOverlay.tsx:900-916`
  - `src/components/editor/PhotoOverlay.tsx:1058-1074`
- `PhotoFrame` inline captions for polaroid are frame-style-specific:
  - `src/components/editor/PhotoFrame.tsx:131-145`
  - `src/lib/frameStyles.ts:26-40`
- Export non-free captions render plain dark text:
  - `src/engine/VideoExporter.ts:1916-1926`
  - `src/engine/VideoExporter.ts:1995-2005`
  - `src/engine/VideoExporter.ts:2306-2311`
  - `src/engine/VideoExporter.ts:2350-2355`

What differs:

- Free caption background is lost in export.
- Non-free caption pill background is lost in export.
- Polaroid inline caption typography is lost in export.
- Export uses single `fillText()` calls instead of the DOM layout used by editor and live surfaces.

Root cause:

- Different code paths

Impact:

- High when captions are enabled, especially free mode or polaroid frame style.

### 7. Long-caption line breaking differs across editor, playback, and export

Affected surfaces:

- Surface 2 vs surfaces 3, 4, 5
- Also surface 1 or 4 vs surface 5 for non-free captions

Code locations:

- Free editor caption wrapper is width-limited:
  - `src/components/editor/FreeCanvas.tsx:1263-1339`
- Free playback captions are forced to a single line:
  - `src/components/editor/PhotoOverlay.tsx:794-810`
  - `src/components/editor/PhotoOverlay.tsx:975-985`
  - `src/components/editor/PhotoOverlay.tsx:1117-1130`
- Polaroid inline caption uses `line-clamp-2`:
  - `src/components/editor/PhotoFrame.tsx:144`
- Export captions use `fillText()` with max width, not DOM wrapping:
  - `src/engine/VideoExporter.ts:1921-1925`
  - `src/engine/VideoExporter.ts:2000-2004`
  - `src/engine/VideoExporter.ts:2028`
  - `src/engine/VideoExporter.ts:2311`
  - `src/engine/VideoExporter.ts:2355`
  - `src/engine/VideoExporter.ts:2378`

What differs:

- Surface 2 can wrap free captions because of `max-w-[40%]`.
- Surfaces 3 and 4 keep free captions on one line.
- Export uses single canvas text draws, which neither match DOM wrapping nor `line-clamp-2`.

Root cause:

- Different code paths

Impact:

- Medium. Most visible on longer captions and narrow layouts.

### 8. Free-mode container sizing has small rounding drift

Affected surfaces:

- Surface 2 vs surfaces 3, 4, 5

Code locations:

- Editor computes `freeCanvasInsetW` and `freeCanvasInsetH` with `Math.round()`:
  - `src/components/editor/PhotoLayoutEditor.tsx:1192-1204`
- `FreeCanvas` then re-measures DOM size and rounds again:
  - `src/components/editor/FreeCanvas.tsx:1108-1125`
- `PhotoOverlay` uses direct `ResizeObserver` floats for container size:
  - `src/components/editor/PhotoOverlay.tsx:370-405`
- Export uses exact fractions of target canvas:
  - `src/engine/VideoExporter.ts:1433-1448`
  - `src/engine/VideoExporter.ts:2136-2151`

What differs:

- Surface 2 converts the 95 percent and 88 percent inset into rounded integers before FreeCanvas receives them.
- Surface 3 and 4 use the DOM-measured overlay size directly.
- Surface 5 uses exact export-target pixel fractions.

Root cause:

- Different container math

Impact:

- Low. This is mostly a 1 px to few px drift issue.

### 9. Export ordering matches free z-index, but frame-specific rotation does not

Affected surfaces:

- Surface 5 vs surfaces 1, 3, 4 for non-free framed layouts

Code locations:

- Preview and live free ordering sort by `zIndex`:
  - `src/components/editor/FreeCanvas.tsx:389-396`
  - `src/components/editor/PhotoOverlay.tsx:416-433`
  - `src/components/editor/PhotoOverlay.tsx:547-565`
- Export free ordering also sorts by `zIndex`:
  - `src/engine/VideoExporter.ts:62-83`
- `PhotoFrame` can add decorative rotation for polaroid:
  - `src/components/editor/PhotoFrame.tsx:69-80`
  - `src/lib/frameStyles.ts:108-116`
- Export uses only rect rotation or fallback tilt:
  - `src/engine/VideoExporter.ts:1775-1785`
  - `src/engine/VideoExporter.ts:2241-2249`

What differs:

- Layer order itself matches in free mode.
- But export drops frame-style decorative rotation because it does not run `PhotoFrame`.

Root cause:

- Different code paths

Impact:

- Medium for polaroid frame style, low otherwise.

## Impact Assessment

### Highest user-visible mismatches

1. Free-mode crop mismatch (`object-cover` in editor, `object-contain` in playback and export)
2. Export ignoring `photoFrameStyle` and `PhotoFrame`
3. Scrubber seek clearing `visiblePhotoLocationId`, which can detach the right layout from visible photos
4. Preview not using timeline-derived `photoOpacity` or frame-accurate enter-state progression
5. Export caption rendering not matching either free-mode captions or non-free frame captions

### Style-specific but severe mismatches

1. Bloom style in editor preview lacks geo-anchored bloom layout
2. Polaroid and other frame styles do not export as rendered in preview or live playback
3. Long captions can wrap differently or compress differently across all surfaces

### Lower-severity mismatches

1. 95 percent and 88 percent inset rounding drift between FreeCanvas, PhotoOverlay, and export
2. Decorative frame rotation parity is lost mainly in export, but z-order itself is consistent

## Root Cause Classification

### A. Different code paths

- Free editor preview uses `FreeCanvas`, not `PhotoOverlay`
- Export uses custom canvas drawing, not `PhotoFrame`
- Free captions are DOM-rendered in editor and live, but canvas-rendered in export
- Bloom preview in editor falls back to normal layout because the bloom path is not supplied with origin data

Primary discrepancies in this class:

- Free-mode crop mismatch
- Export frame-style mismatch
- Export caption mismatch
- Long-caption wrapping mismatch

### B. Different container math

- Free editor preview rounds inset width and height before rendering
- Playback uses measured DOM size from `PhotoOverlay`
- Export uses fixed target resolution and target-canvas fractions

Primary discrepancies in this class:

- Low-level 1 px to few px drift in free preview sizing

### C. Different props

- Scrubber path can clear `visiblePhotoLocationId`, which removes `photoLayout`, `photoLocationId`, and origin metadata
- Editor preview does not pass `bloomOrigin`
- Export settings do not carry `photoFrameStyle`

Primary discrepancies in this class:

- Scrubber wrong-layout risk
- Bloom preview mismatch
- Export frame-style mismatch

### D. Timing and animation residuals

- `AnimationEngine` exposes gradual `photoOpacity`, but preview path uses binary opacity
- `PhotoOverlay` enter animations are mount-based rather than timeline-based
- Export computes animation state per frame

Primary discrepancies in this class:

- Scrubber and live preview not matching export during enter or exit motion

## Matches Worth Noting

These areas are substantially aligned:

- Non-free layout rect computation uses the same shared utilities in editor preview, playback, and export:
  - `computeAutoLayout()`: `src/lib/photoLayout.ts:336-371`
  - `computeTemplateLayout()`: `src/lib/photoLayout.ts:743-782`
- Free-mode z-index ordering is consistent across editor, playback, and export:
  - `src/components/editor/FreeCanvas.tsx:389-396`
  - `src/components/editor/PhotoOverlay.tsx:416-433`
  - `src/engine/VideoExporter.ts:62-83`
- Focal point is preserved in all main renderers, even where fit mode differs:
  - `src/components/editor/FreeCanvas.tsx:1213-1215`
  - `src/components/editor/PhotoOverlay.tsx:786-788`
  - `src/components/editor/PhotoOverlay.tsx:949-951`
  - `src/engine/VideoExporter.ts:1214-1242`
  - `src/engine/VideoExporter.ts:1763`
  - `src/engine/VideoExporter.ts:2232`

## Conclusion

The main WYSIWYG breaks are not in shared layout-rect generation. They are concentrated in:

- free-mode render implementation (`FreeCanvas` versus `PhotoOverlay`)
- export frame and caption rendering (`VideoExporter` versus `PhotoFrame` and DOM captions)
- scrub or playback state wiring (`handleSeek()`, binary overlay opacity, mount-time animation)

The strongest parity today is:

- non-free static layout math across editor preview, playback, and export
- free-mode z-order sorting

The weakest parity today is:

- free-mode photo fit
- frame-style fidelity in export
- frame-accurate scrub and exit-state rendering
