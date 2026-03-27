# TraceRecap — Technical Design

> Brainstorm output from 2026-03-27

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14+ (App Router) | API Routes for Claude/Mapbox proxy, Vercel deploy, SSR for landing page |
| Language | TypeScript | Type safety |
| UI | Tailwind CSS + shadcn/ui | Fast to build, consistent design |
| State | Zustand | Lightweight, good for editor state |
| Map | Mapbox GL JS v3 (2D) | WebGL rendering, native camera API, route services |
| Geo | @turf/turf | Distance, along, bearing, great-circle, bbox |
| Animation | bezier-easing | Custom easing curves |
| Video | @ffmpeg/ffmpeg + @ffmpeg/util | Client-side MP4 encoding |
| AI | @anthropic-ai/sdk (Claude Sonnet 4) | Route generation from natural language |
| Icons | Custom SVG cartoon icons | Plane, car, train, ferry, etc. |
| Photo animation | framer-motion | Elegant card pop-up effects |
| Deploy | Vercel | One-click, free tier |

## Map Styles (MVP: 3)

- Light (Mapbox Light)
- Dark (Mapbox Dark)
- Satellite (Mapbox Satellite Streets)

Custom styles (vintage, watercolor) deferred to later.

## Animation Engine — Hybrid Approach

Self-managed frame loop + Mapbox rendering:

```
requestAnimationFrame loop
  → calculate global progress (0-1)
  → determine current segment + segment progress
  → interpolate camera: { center, zoom, bearing }
  → map.jumpTo({ center, zoom, bearing })
  → interpolate icon position: turf.along(routeLine, distance)
  → interpolate icon rotation: turf.bearing(prev, next)
  → update React state for UI overlays (city names, photos)
```

### Camera Motion Per Segment

5 phases with bezier-easing transitions:

1. **HOVER** (0.5s) — Stay at departure, show city name
2. **ZOOM_OUT** — Pull back to see both cities
3. **FLY** — Camera follows icon, dynamic zoom
4. **ZOOM_IN** — Push into destination
5. **ARRIVE** (0.5s) — Stay at destination, show city name + photos

### Zoom Auto-Calculation

```
zoom_fly = clamp(14 - log2(distance_km / 50), 2, 10)
zoom_city = clamp(zoom_fly + 4, 10, 16)
```

### Timing Auto-Calculation

System auto-calculates based on number of stops:
- Target total duration: 15-30 seconds
- Each segment duration = (total - hover_times) / num_segments
- No manual timeline editing

## Photo Display — Dual Layer Rendering

### Preview Mode
- React + framer-motion renders photo cards as HTML overlay above map canvas
- Arrival triggers: map pauses → photo card(s) animate in → display 1-2s → animate out → resume

### Export Mode
- Same animation logic, but photo layer rendered to offscreen canvas via html2canvas
- Each frame: map canvas + photo canvas composited → single frame image
- Composited frames fed to FFmpeg.wasm

## Video Export — Frame-by-Frame Capture

```
1. Switch to export mode (pause realtime rendering)
2. For each frame (30fps × duration):
   a. map.jumpTo({ center, zoom, bearing }) for this frame
   b. Wait for map.once('idle') — tiles fully loaded
   c. Capture map canvas → frame image
   d. If photo visible: render photo layer → composite
   e. Collect frame
3. Feed all frames to FFmpeg.wasm
4. Encode MP4 (H.264)
5. Offer download
```

Supported output:
- Aspect ratios: 16:9, 9:16
- Resolution: up to 1080p
- FPS: 30

## Route Geometry Generation

| Transport | Method |
|-----------|--------|
| flight | turf.greatCircle(from, to, { npoints: 100 }) |
| car | Mapbox Directions API (driving) |
| train | Mapbox Directions API (driving, approximate) |
| bus | Mapbox Directions API (driving) |
| ferry | turf.bezierSpline (curved line over water) |
| walk | Mapbox Directions API (walking) |
| bicycle | Mapbox Directions API (cycling) |

## AI Route Generation

- Model: Claude Sonnet 4 via Next.js API Route (`/api/ai/generate-route`)
- Input: natural language trip description
- Output: structured JSON with locations + segments + transport types
- Secondary input method — manual add is primary

## Transport Icons

Static SVG cartoon-style icons:
- Rotate to face direction of travel (turf.bearing)
- Rendered as Mapbox Markers
- Set: plane, car, train, bus, ferry, walk, bicycle
- Upgradeable to Lottie animations later without architecture change

## API Routes

```
POST /api/ai/generate-route    — Claude API proxy for route generation
GET  /api/directions            — Mapbox Directions API proxy
GET  /api/geocode               — Mapbox Geocoding API proxy
```

## Environment Variables

```
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

## File Structure

```
src/
├── app/
│   ├── page.tsx                      # Landing / entry
│   ├── editor/
│   │   └── page.tsx                  # Main editor
│   └── api/
│       ├── ai/generate-route/route.ts
│       ├── directions/route.ts
│       └── geocode/route.ts
├── components/
│   ├── editor/
│   │   ├── EditorLayout.tsx
│   │   ├── LeftPanel.tsx
│   │   ├── MapCanvas.tsx
│   │   ├── TopToolbar.tsx
│   │   ├── RouteList.tsx
│   │   ├── LocationCard.tsx
│   │   ├── TransportSelector.tsx
│   │   ├── AIRouteGenerator.tsx
│   │   ├── PlaybackControls.tsx
│   │   ├── PhotoOverlay.tsx
│   │   ├── ExportDialog.tsx
│   │   └── MapStyleSelector.tsx
│   └── ui/                           # shadcn/ui
├── engine/
│   ├── AnimationEngine.ts            # Frame loop + progress
│   ├── CameraController.ts           # Camera path + interpolation
│   ├── RouteGeometry.ts              # Route line generation
│   ├── IconAnimator.ts               # Transport icon position/rotation
│   └── VideoExporter.ts              # Frame capture + FFmpeg encoding
├── stores/
│   ├── projectStore.ts               # Route data, locations, segments
│   ├── animationStore.ts             # Playback state
│   └── uiStore.ts                    # UI state (panels, dialogs)
├── lib/
│   ├── mapbox.ts                     # Mapbox config + styles
│   ├── anthropic.ts                  # Claude API helpers
│   └── constants.ts
├── types/
│   └── index.ts
├── assets/
│   └── icons/                        # SVG transport icons
└── styles/
    └── globals.css
```
