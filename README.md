# TraceRecap

Turn your travel routes into beautiful short videos in under 3 minutes.

TraceRecap is a web app that lets you plot your trip on a clean 2D map, watch cartoon transport icons fly and drive along your route, and export a polished 15-30 second video ready for sharing.

## Features

- **Add destinations** — Search or click on the map to build your route
- **Pick transport modes** — Cartoon plane, car, train, ferry, and more
- **Attach photos** — Add photos to each stop, displayed as elegant cards on arrival
- **AI assist** — Describe your trip in natural language and let Claude generate the route
- **One-click export** — Download MP4 in landscape (16:9) or portrait (9:16)

## Tech Stack

- **Framework:** Next.js 14+ / TypeScript / Tailwind CSS / shadcn/ui
- **Map:** Mapbox GL JS v3 (2D)
- **State:** Zustand
- **Animation:** Custom frame loop + Mapbox camera API + Turf.js
- **Video export:** FFmpeg.wasm (client-side)
- **AI:** Claude Sonnet 4 via Anthropic API
- **Deploy:** Vercel

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN and ANTHROPIC_API_KEY
npm run dev
```

## Docs

- [Product Definition](docs/plans/2026-03-27-product-definition.md)
- [Technical Design](docs/plans/2026-03-27-tech-design.md)

## License

MIT
