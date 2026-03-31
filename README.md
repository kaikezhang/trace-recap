# TraceRecap

Turn your travel routes into beautiful animated short videos — in under 3 minutes, right in your browser.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Mapbox](https://img.shields.io/badge/Mapbox%20GL-v3-blue?logo=mapbox)
![License](https://img.shields.io/badge/License-MIT-green)

## What is TraceRecap?

TraceRecap is a web app that lets ordinary travelers create polished recap videos of their trips. Plot your route on a clean 2D map, watch animated transport icons fly and drive along your path, attach photos to each stop, and export a 15–180 second MP4 — all client-side, no account required.

**Target audience:** Casual travelers who want to share trip recaps on Instagram, TikTok, WeChat Moments, etc. — not professional video editors.

## ✨ Features

### Route Builder
- **City search** — Mapbox geocoding with fuzzy search
- **Click-to-add** — Click anywhere on the map to add a destination
- **Drag to reorder** — Powered by @dnd-kit
- **Waypoints** — Mark intermediate stops the camera flies through without pausing
- **Route import/export** — Save & load routes as JSON files
- **Multi-project** — Save multiple projects in IndexedDB, switch between them

### Transport & Animation
- **7 transport modes** — Flight, car, train, bus, ferry, walk, bicycle
- **Animated Lottie icons** — 3 art styles (solid, outline, soft) × 3+ vehicle variants per mode
- **Directional icons** — Icons rotate to match travel direction
- **5-phase animation** — Hover → Zoom Out → Fly → Zoom In → Arrive
- **Great-circle arcs** for flights; real road/rail geometry via Mapbox Directions API for ground transport
- **Cinematic scene transitions** — Cut, dissolve, blur-dissolve, directional wipe between segments
- **Mood route color grading** — Auto-extract dominant color from photos to tint route lines

### Photo System
- **Photo cards** — Attach photos to each destination; they appear as elegant cards on arrival
- **4 photo styles** — Classic, Ken Burns (slow zoom+pan), Memory Portal (depth effect), Geo-Anchored Bloom
- **6 enter/exit animations** — Scale, fade, slide, flip, scatter, typewriter
- **11 layout templates** — Grid, hero, masonry, filmstrip, scatter, polaroid, overlap, full, diagonal, rows, magazine
- **Photo layout editor** — Per-location template selection with custom proportions, gap, border radius
- **Photo compression** — Auto-resize to 1920px + JPEG 80% quality on upload

### Map Overlays
- **Chapter Pins** — Each stop becomes a chapter marker with journal card (cover photo, title, date, emoji)
- **Breadcrumb Trail** — Visited cities leave circular photo thumbnails pinned to the map
- **Trip Stats Bar** — Live distance, cities visited, photo count, transport modes used
- **City labels** — English & Chinese, configurable font size, animated pop-in

### Map Styles (15 styles in 3 categories)
- **Classic** — Light, Dark, Streets, Outdoors, Satellite, Satellite (Raw)
- **Navigation** — Nav Day, Nav Night
- **Creative** — Standard, Std Satellite, Monochrome, Vintage, Blueprint, Pastel, Midnight

### Playback & Export
- **Playback preview** — Play/pause/scrub the full animation in-browser
- **Segment timing control** — Auto-calculated pacing with per-segment duration overrides
- **Video export** — Server-side FFmpeg encoding or client-side MediaRecorder/WebCodecs fallback
- **6 aspect ratios** — Free, 16:9, 9:16, 4:3, 3:4, 1:1
- **Up to 1080p @ 30fps**

### Mobile & UX
- **Mobile responsive** — Bottom sheet UI on small screens, full left panel on desktop
- **Mobile settings drawer** — Slide-up drawer replaces dropdown on mobile
- **Onboarding hints** — Contextual guidance for first-time users
- **Undo/redo** — History store for project edits
- **Settings persistence** — All UI preferences saved to localStorage

## 🎬 How the Animation Works

Each route segment goes through 5 phases:

1. **Hover** — Pause at departure city, show city name label
2. **Zoom Out** — Camera pulls back to frame both cities
3. **Fly** — Animated transport icon moves along the route geometry
4. **Zoom In** — Camera pushes into the destination
5. **Arrive** — Pause at destination, city name pops up, photo cards appear (if any)

Camera zoom levels, flight paths, and timing are all auto-calculated based on distance between stops. Waypoints skip the Hover/Arrive phases for seamless fly-through segments.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, TypeScript) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Map | [Mapbox GL JS v3](https://docs.mapbox.com/mapbox-gl-js/) (2D WebGL) |
| Geo | [@turf/turf](https://turfjs.org) (distance, along, bearing, great-circle, bbox) |
| Animation | Custom `requestAnimationFrame` loop + [bezier-easing](https://github.com/gre/bezier-easing) |
| Motion | [Framer Motion](https://www.framer.com/motion/) (photo card & overlay animations) |
| Transport Icons | [Lottie](https://github.com/airbnb/lottie-web) (animated vector icons, 60+ variants) |
| Video Export | Server-side FFmpeg, client-side MediaRecorder fallback, WebCodecs pipeline |
| Muxing | [mp4-muxer](https://github.com/niccokunzmann/mp4-muxer) (WebCodecs → MP4) |
| Storage | [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via [idb](https://github.com/niccokunzmann/idb) (multi-project persistence) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) (location reordering) |
| Archive | [JSZip](https://stuk.github.io/jszip/) (route + photo bundle export) |
| Deploy | [Vercel](https://vercel.com) |

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Landing page
│   ├── layout.tsx                      # Root layout
│   ├── editor/page.tsx                 # Main editor
│   └── api/
│       ├── directions/route.ts         # Mapbox Directions proxy
│       ├── geocode/route.ts            # Mapbox Geocoding proxy
│       └── encode-video/              # Server-side FFmpeg encoding
│           ├── start/route.ts
│           ├── frame/route.ts
│           └── route.ts
├── components/
│   ├── editor/
│   │   ├── EditorLayout.tsx            # Main editor layout + animation orchestration
│   │   ├── MapCanvas.tsx               # Mapbox map initialization + markers + route lines
│   │   ├── MapStage.tsx                # Map viewport container + overlay composition
│   │   ├── MapContext.tsx              # Mapbox instance context provider
│   │   ├── MapEmptyState.tsx           # Empty state prompt when no locations added
│   │   ├── LeftPanel.tsx               # Desktop sidebar (city search, route list, settings)
│   │   ├── BottomSheet.tsx             # Mobile route editor (swipe-up sheet)
│   │   ├── TopToolbar.tsx              # Map style, city label, overlay controls
│   │   ├── RouteList.tsx               # Sortable location list with transport selectors
│   │   ├── LocationCard.tsx            # Single location card with chapter metadata editor
│   │   ├── CitySearch.tsx              # Mapbox geocoding search input
│   │   ├── TransportSelector.tsx       # Transport mode & icon variant picker
│   │   ├── PlaybackControls.tsx        # Play/pause/reset + progress scrubber
│   │   ├── PhotoOverlay.tsx            # Photo card display during animation
│   │   ├── PortalPhotoLayer.tsx        # Memory Portal depth-effect photo renderer
│   │   ├── PhotoManager.tsx            # Photo upload & management per location
│   │   ├── PhotoLayoutEditor.tsx       # Template + proportions editor per location
│   │   ├── ChapterPin.tsx              # Single chapter pin + journal card
│   │   ├── ChapterPinsOverlay.tsx      # All chapter pins composition layer
│   │   ├── BreadcrumbTrail.tsx         # Visited-city photo breadcrumb thumbnails
│   │   ├── TripStatsBar.tsx            # Live trip statistics overlay bar
│   │   ├── ExportDialog.tsx            # Export settings (aspect ratio, resolution)
│   │   ├── MapStyleSelector.tsx        # 15-style categorized picker
│   │   ├── ProjectListDialog.tsx       # Multi-project switcher dialog
│   │   ├── OnboardingHint.tsx          # First-time contextual hints
│   │   └── routeSegmentSources.ts      # Mapbox source/layer management for route lines
│   └── ui/                             # shadcn/ui primitives
├── engine/
│   ├── AnimationEngine.ts              # Core frame loop, timing, phase management
│   ├── CameraController.ts             # Camera path interpolation + zoom calculation
│   ├── IconAnimator.ts                 # Transport icon position, rotation, direction
│   ├── RouteGeometry.ts                # Route line generation (great-circle / Directions API)
│   ├── VideoExporter.ts               # Frame-by-frame capture + server FFmpeg pipeline
│   ├── WebCodecsExporter.ts           # Client-side WebCodecs H.264 encoding
│   └── MediaRecorderExporter.ts       # Client-side MediaRecorder fallback (iOS)
├── stores/
│   ├── projectStore.ts                 # Route data: locations, segments, photos, import/export
│   ├── animationStore.ts               # Playback state, current time, breadcrumbs, visited locations
│   ├── uiStore.ts                      # UI state: panels, dialogs, label settings, overlay toggles
│   ├── historyStore.ts                 # Undo/redo history tracking
│   └── selectors.ts                    # Derived state selectors
├── lib/
│   ├── constants.ts                    # Phase durations, zoom ranges, transport & map style configs
│   ├── mapbox.ts                       # Mapbox token + default map options
│   ├── photoLayout.ts                  # Photo layout algorithms (11 templates)
│   ├── photoAnimation.ts              # Photo enter/exit animation definitions
│   ├── portalLayout.ts                # Memory Portal depth-layered layout
│   ├── sceneTransition.ts             # Cross-segment transition effects
│   ├── colorExtract.ts                # Dominant color extraction from photos
│   ├── tripStats.ts                   # Trip statistics computation
│   ├── transportIcons.ts              # Lottie icon variant registry
│   ├── demoProject.ts                 # Built-in demo trip data
│   ├── storage.ts                     # IndexedDB project persistence
│   ├── viewportRatio.ts               # Aspect ratio viewport calculations
│   └── utils.ts                        # Utility helpers
├── types/
│   └── index.ts                        # All TypeScript types
└── assets/
    └── icons/                          # SVG transport icons (7 modes)

public/
├── icons/                              # PNG directional transport icons (7 × 5 directions)
├── lottie/                             # Animated Lottie JSON files (60+ variants)
└── demo-photos/                        # Sample trip photos for demo project
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Mapbox](https://mapbox.com) access token
- FFmpeg installed on the server (for server-side video export; client-side fallback works without it)

### Setup

```bash
git clone https://github.com/kaikezhang/trace-recap.git
cd trace-recap
npm install

# Create .env.local with your Mapbox token
echo "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here" > .env.local

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Create Video** to open the editor.

### Route JSON Format

You can import/export routes as JSON. Example structure:

```json
{
  "name": "Taiwan Trip",
  "locations": [
    {
      "name": "Taipei",
      "nameZh": "台北",
      "coordinates": [121.5654, 25.0330],
      "isWaypoint": false,
      "chapterEmoji": "🏯",
      "chapterDate": "Mar 11-14",
      "photos": [
        { "url": "https://example.com/taipei.jpg", "caption": "Taipei 101" }
      ]
    },
    {
      "name": "Taichung",
      "nameZh": "台中",
      "coordinates": [120.6736, 24.1477],
      "isWaypoint": false
    }
  ],
  "segments": [
    { "fromIndex": 0, "toIndex": 1, "transportMode": "train" }
  ]
}
```

## 📄 Docs

- [Product Definition](docs/plans/2026-03-27-product-definition.md)
- [Technical Design](docs/plans/2026-03-27-tech-design.md)
- [Photo Layout Design](docs/design-photo-layout.md)
- [Segment Timing Design](docs/design-segment-timing.md)
- [iOS Product Spec](docs/ios-product-spec.md)

## License

MIT
