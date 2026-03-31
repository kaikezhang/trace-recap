# TASK.md — Chapter Pins with Journal Cards

⚠️ DO NOT MERGE. Create PR and stop.

## Overview

Add a "Chapter Pins" system where every stop becomes a chapter marker on the map. On arrival, the pin unfurls a compact journal card showing: cover photo, date range, short title, and optional one-line note. Previous chapters remain faintly visible on the map as the trip progresses, creating a visible narrative history.

## Current Behavior

- City labels appear during HOVER/ARRIVE phases as simple text overlays
- No persistent markers remain on the map after leaving a location
- No journal/chapter metadata per location

## Desired Behavior

### 1. Location Data Extension (`src/types/index.ts`)

Add chapter metadata to `LocationData`:
```ts
chapterTitle?: string;      // User-editable chapter title (defaults to city name)
chapterNote?: string;       // Optional one-line note/caption
chapterDate?: string;       // Display date (e.g. "Mar 15-17")
chapterEmoji?: string;      // Optional emoji stamp (e.g. "🏯" "🍜" "🎌")
```

### 2. Chapter Pin Component (`src/components/editor/ChapterPin.tsx`) — NEW

A map-anchored component that renders at each visited city coordinate:

**Active state (current arrival):**
- Circular cover photo thumbnail (48-64px) with white border
- Below it: chapter title (bold), date, optional note
- Optional emoji stamp in corner
- Smooth unfurl animation (scale 0→1 with spring easing)
- Background: frosted glass card (backdrop-blur + semi-transparent white)

**Visited state (already left):**
- Shrinks to a smaller thumbnail (32px) with reduced opacity (0.4-0.6)
- Title visible but smaller, note hidden
- Creates a "breadcrumb" of visited chapters

**Future state (not yet visited):**
- Not visible (or subtle dot marker)

### 3. Map Integration (`src/components/editor/MapCanvas.tsx` or new overlay)

- Chapter pins are anchored to city coordinates using `map.project()`
- Pins update position on camera movement
- Z-ordering: visited pins behind route, active pin above route
- Pins should NOT interfere with the existing city label system — they complement it

### 4. Animation Timeline Integration

- **ARRIVE phase**: Active chapter pin unfurls with spring animation
- **HOVER phase**: Chapter pin fully visible
- **ZOOM_OUT → next segment**: Pin transitions to "visited" state (shrink + fade)
- Track `visitedLocationIds` in animation store — grows as trip progresses

### 5. Video Export (`src/engine/VideoExporter.ts`)

- Draw chapter pins on the canvas at projected coordinates
- Active pin: full card with photo + text
- Visited pins: small thumbnails at reduced opacity
- Must match preview appearance

### 6. Chapter Editor UI

In the location editor (sidebar), add fields for:
- Chapter title (text input, defaults to city name)
- Chapter note (text input, optional)
- Chapter date (text input, optional)
- Chapter emoji picker (optional)

### 7. Settings (`src/stores/uiStore.ts`)

Add toggle:
```ts
chapterPinsEnabled: boolean; // default: true
```

Persisted to localStorage. When disabled, no chapter pins shown (current behavior).

## Visual Design

**Active Journal Card:**
```
┌─────────────────────────┐
│  [📷 photo]  Tokyo      │
│             Mar 15-17    │
│             🏯 Temples   │
│             & gardens    │
└─────────────────────────┘
```
- Max width: 200px
- Photo: 48px circle, object-fit cover
- Title: 14px bold
- Date: 12px gray
- Note: 12px, max 1 line, ellipsis overflow
- Card: rounded-lg, bg-white/80 backdrop-blur-sm, shadow-md

**Visited Pin:**
- 32px circular photo thumbnail
- 10px title below
- opacity 0.5

## Files to create/modify

- `src/types/index.ts` — add chapter metadata fields to LocationData
- `src/components/editor/ChapterPin.tsx` — NEW: chapter pin component
- `src/components/editor/MapStage.tsx` or `PhotoOverlay.tsx` — render chapter pins
- `src/engine/VideoExporter.ts` — draw chapter pins in export
- `src/stores/animationStore.ts` — track visitedLocationIds
- `src/stores/uiStore.ts` — chapterPinsEnabled toggle
- `src/components/editor/LocationCard.tsx` — add chapter metadata editor fields

## Verification

- `npx tsc --noEmit` and `npm run build` must pass
- Chapter pins appear at city coordinates during playback
- Active pin unfurls on arrival, transitions to visited on departure
- Visited pins accumulate as trip progresses
- Export shows chapter pins matching preview
- Toggle enables/disables the feature
- Chapter metadata editable in location editor

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`
