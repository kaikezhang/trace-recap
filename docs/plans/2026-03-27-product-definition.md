# TraceRecap — Product Definition

> Brainstorm output from 2026-03-27

## One-liner

A web app that lets ordinary travelers turn their travel routes into high-quality short videos in under 3 minutes.

## Core User

Ordinary travelers who want to create a beautiful recap video of their trip to share on social media (WeChat Moments, Instagram, etc.). They value simplicity and speed — not a professional editing tool.

## Core Experience Flow

1. User manually searches/clicks cities to add to their route (AI assist optional)
2. Selects transport mode for each leg (cartoon plane, car, train, etc.)
3. Optionally adds a few photos to each destination
4. Clicks play to preview the animation
5. One-click export to MP4 short video

## Animation Sequence (per route segment)

1. **Hover** — Pause at departure city, show city name
2. **Zoom out** — Camera pulls back to show both cities
3. **Fly** — Cartoon transport icon moves along the route
4. **Zoom in** — Camera pushes into destination
5. **Arrive** — Pause, city name pops up
6. **Photos** (if any) — Map pauses, photos appear as elegant cards/carousel, then dismiss
7. Continue to next segment

## Visual Standards

- Clean 2D map, minimalist and elegant
- Cartoon transport icons (plane, car, train, ferry, etc.)
- City names animate in with pop/fade effects
- Photo display must feel designed — card pop-up with smooth motion
- Overall high aesthetic bar: silky smooth animations, polished transitions
- Style reference: TravelBoast's cute icons + Mult.dev's clean map feel

## Video Specs

- Duration: 15-30 seconds (short-form, fast-paced)
- Aspect ratios: 16:9 (landscape) and 9:16 (portrait/stories)
- Export: client-side via FFmpeg.wasm, up to 1080p
- Animation timing auto-calculated by system based on number of stops

## Input Methods

- **Primary:** Manual city search/selection + transport mode picker
- **Secondary:** AI natural language input (describe trip → auto-generate route)
- Users can edit AI-generated routes manually

## Scope — What We Build (MVP)

- Web App (pure browser, works on desktop and mobile)
- Map rendering with Mapbox GL JS (2D, multiple styles)
- City search and map click to add destinations
- Transport mode selection per segment
- Route geometry (great circle for flights, Directions API for ground)
- Animation engine (camera movement + icon animation + city labels)
- Photo upload and elegant display at each destination
- Playback controls (play/pause/reset)
- Video export (FFmpeg.wasm, client-side)
- AI route generation (Claude API, optional assist)

## Scope — What We Don't Build

- No timeline editor (system auto-controls pacing)
- No custom camera keyframe editing
- No user accounts / authentication
- No payment / subscription system
- No community gallery
- No server-side video rendering
- No project save/load persistence
- No GPX/KML import (MVP)

## Platform

- Pure Web App, no native apps
- Responsive — works on both desktop and mobile browsers
- No desktop-first or mobile-first priority

## Business Model

- Free, personal project — no monetization for now
