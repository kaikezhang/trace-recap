# TraceRecap

Turn your travel routes into beautiful animated short videos — in under 3 minutes, right in your browser.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Mapbox](https://img.shields.io/badge/Mapbox%20GL-v3-blue?logo=mapbox)
![License](https://img.shields.io/badge/License-MIT-green)

## What is TraceRecap?

TraceRecap is a web app that lets ordinary travelers create polished recap videos of their trips. Plot your route on a clean 2D map, watch cartoon transport icons fly and drive along your path, attach photos to each stop, and export a 15–180 second MP4 — all client-side, no account required.

**Target audience:** Casual travelers who want to share trip recaps on Instagram, TikTok, WeChat Moments, etc. — not professional video editors.

## ✨ Features

- **Route builder** — Search cities or click the map to add destinations; drag to reorder
- **7 transport modes** — Flight, car, train, bus, ferry, walk, bicycle — each with cute directional icons
- **Waypoints** — Mark intermediate stops that the camera flies through without pausing
- **Photo cards** — Attach photos to each destination; they appear as elegant cards on arrival with smooth staggered exit animations
- **Photo layout editor** — Grid, hero, masonry, filmstrip, scatter templates + manual proportions & ordering
- **3 map styles** — Light, Dark, Satellite
- **Playback preview** — Play/pause/scrub the full animation in-browser before exporting
- **Segment timing control** — Auto-calculated pacing with optional per-segment duration overrides
- **City labels** — English & Chinese, configurable font size, animated pop-in
- **Video export** — Server-side FFmpeg encoding, 16:9 (landscape) or 9:16 (portrait), up to 1080p @ 30fps
- **Route import/export** — Save & load routes as JSON files
- **Mobile responsive** — Bottom sheet UI on small screens, full left panel on desktop

## 🎬 How the Animation Works

Each route segment goes through 5 phases:

1. **Hover** — Pause at departure city, show city name label
2. **Zoom Out** — Camera pulls back to frame both cities
3. **Fly** — Cartoon transport icon moves along the route geometry
4. **Zoom In** — Camera pushes into the destination
5. **Arrive** — Pause at destination, city name pops up, photo cards appear (if any)

Camera zoom levels, flight paths, and timing are all auto-calculated based on distance between stops. Flights use great-circle arcs; ground transport uses Mapbox Directions API for real road/rail geometry.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, TypeScript) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Map | [Mapbox GL JS v3](https://docs.mapbox.com/mapbox-gl-js/) (2D WebGL) |
| Geo | [@turf/turf](https://turfjs.org) (distance, along, bearing, great-circle, bbox) |
| Animation | Custom `requestAnimationFrame` loop + [bezier-easing](https://github.com/gre/bezier-easing) |
| Motion | [Framer Motion](https://www.framer.com/motion/) (photo card animations) |
| Video Export | Server-side FFmpeg via API route (frame capture → H.264 MP4) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) (location reordering) |
| Deploy | [Vercel](https://vercel.com) |

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Landing page
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
│   │   ├── LeftPanel.tsx               # Desktop sidebar (city search, route list, import/export)
│   │   ├── BottomSheet.tsx             # Mobile route editor
│   │   ├── TopToolbar.tsx              # Map style, city label controls
│   │   ├── RouteList.tsx               # Sortable location list with transport selectors
│   │   ├── LocationCard.tsx            # Single location in the list
│   │   ├── CitySearch.tsx              # Mapbox geocoding search input
│   │   ├── TransportSelector.tsx       # Transport mode picker dropdown
│   │   ├── PlaybackControls.tsx        # Play/pause/reset + progress bar
│   │   ├── PhotoOverlay.tsx            # Photo card display during animation
│   │   ├── PhotoManager.tsx            # Photo upload & management per location
│   │   ├── PhotoLayoutEditor.tsx       # Grid/hero/masonry/filmstrip/scatter template editor
│   │   ├── ExportDialog.tsx            # Export settings (aspect ratio, resolution)
│   │   ├── MapStyleSelector.tsx        # Light/Dark/Satellite toggle
│   │   └── routeSegmentSources.ts      # Mapbox source/layer management for route lines
│   └── ui/                             # shadcn/ui primitives
├── engine/
│   ├── AnimationEngine.ts              # Core frame loop, timing, phase management
│   ├── CameraController.ts             # Camera path interpolation + zoom calculation
│   ├── IconAnimator.ts                 # Transport icon position, rotation, direction
│   ├── RouteGeometry.ts                # Route line generation (great-circle / Directions API)
│   └── VideoExporter.ts               # Frame-by-frame capture + server FFmpeg pipeline
├── stores/
│   ├── projectStore.ts                 # Route data: locations, segments, photos, import/export
│   ├── animationStore.ts               # Playback state, current time, visible photos
│   └── uiStore.ts                      # UI state: panels, dialogs, label settings
├── lib/
│   ├── constants.ts                    # Phase durations, zoom ranges, transport configs
│   ├── mapbox.ts                       # Mapbox token + default map options
│   ├── photoLayout.ts                  # Photo layout algorithms (auto + template)
│   └── utils.ts                        # Utility helpers
├── types/
│   └── index.ts                        # All TypeScript types
└── assets/
    └── icons/                          # SVG transport icons (7 modes × 4 directions)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Mapbox](https://mapbox.com) access token
- FFmpeg installed on the server (for video export)

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

## License

MIT
