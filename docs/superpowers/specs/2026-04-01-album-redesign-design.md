# Album Redesign — Design Spec

## Overview

Redesign the album pin (ChapterPin) that appears during video playback when leaving a city. The current album is a simple white card with two photos and a spine. The redesign adds **material quality/texture**, **multiple album styles**, **photo frame styles**, **grid-based photo layout**, and a **smooth collection animation**.

This is a **video-only element** — no user interaction during playback. Users configure styles in the editor before export.

## Key Design Decisions (from brainstorm)

- Album style and frame style are **independent** settings (not bound to each other)
- Album style is a **global trip-level setting** (in TopToolbar Settings panel)
- Frame style lives in the **PhotoLayoutEditor** panel (alongside photoStyle, photoAnimation) — global setting like those, not per-location
- Album stays **open** after photos collect, holds 0.3s, then transitions to visited pin (no close animation)
- Photos collect **sequentially after all finish displaying** (option B — one by one, fast)
- Album width ≤ 75% of viewport, maintains a wide/short book aspect ratio (~5:3)
- All textures implemented via **CSS + inline SVG noise filters** — zero external image assets

---

## Phase 1: Album Redesign + Grid Layout + Collection Animation

### 1. Album Styles

Four album styles, user selects one in Settings (applies to entire trip).

#### Type Definition

```typescript
// src/types/index.ts
export type AlbumStyle = "vintage-leather" | "japanese-minimal" | "classic-hardcover" | "travel-scrapbook";
```

#### Visual Specifications

**A. Vintage Leather (复古皮革手账)**
- Page color: `#f5e6c8` (aged parchment yellow)
- Page texture: SVG feTurbulence noise (baseFrequency 0.65, numOctaves 4) at 6% opacity, warm overlay
- Spine: `#5c3a1e` (dark brown), 12px wide, CSS linear-gradient simulating stitching (dashed border-left on right page)
- Outer edge: 4px solid `#6b4226` (leather brown), subtle inner shadow
- Overall shadow: multi-layer — `0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1), 0 16px 32px rgba(0,0,0,0.15)`
- Border radius: 6px (books have subtle rounding)

**B. Japanese Minimal (日系文艺)**
- Page color: `#faf8f5` (warm off-white)
- Page texture: SVG feTurbulence noise (baseFrequency 0.9, numOctaves 2) at 3% opacity, very subtle
- Spine: `#d4cfc7` (light warm gray), 6px wide, clean single line
- Outer edge: 1px solid `#e8e4de`, no heavy border
- Overall shadow: soft single layer — `0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)`
- Border radius: 4px
- Extra whitespace/padding inside pages (generous margins around photo grid)

**C. Classic Hardcover (经典精装)**
- Page color: `#fffef9` (ivory/cream)
- Page texture: SVG feTurbulence noise (baseFrequency 0.8, numOctaves 3) at 4% opacity
- Spine: choice of deep color matching a palette — default `#1a1a2e` (dark navy), 10px wide, with a 1px gold (`#c9a84c`) line down the center
- Outer edge: 3px solid matching spine color, with 1px inset gold accent line via box-shadow
- Overall shadow: dramatic — `0 4px 8px rgba(0,0,0,0.12), 0 12px 24px rgba(0,0,0,0.15), 0 24px 48px rgba(0,0,0,0.1)`
- Border radius: 3px (hard/precise corners)

**D. Travel Scrapbook (旅行剪贴簿)**
- Page color: `#d4a574` (kraft/brown paper)
- Page texture: SVG feTurbulence noise (baseFrequency 0.5, numOctaves 5) at 10% opacity, rough/visible grain
- Spine: spiral binding effect — CSS repeating-linear-gradient creating evenly spaced dark circles (`#555`) down the center, 16px wide zone
- Outer edge: no solid border; instead, slightly irregular edge simulated by clip-path with subtle polygon variations or a torn-paper CSS mask
- Overall shadow: `0 3px 12px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08)`
- Border radius: 2px (raw/rough feel)

#### SVG Noise Texture Implementation

Each album style uses an inline SVG filter for paper texture. The pattern:

```tsx
// Shared component: PaperTexture
function PaperTexture({ baseFrequency, numOctaves, opacity, blendColor }: {
  baseFrequency: number;
  numOctaves: number;
  opacity: number;
  blendColor?: string; // optional color overlay
}) {
  const filterId = useId(); // React 18 useId for unique filter IDs
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={numOctaves} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={opacity} />
      </svg>
      {blendColor && (
        <div className="absolute inset-0" style={{ backgroundColor: blendColor, mixBlendMode: 'multiply', opacity: 0.15 }} />
      )}
    </div>
  );
}
```

### 2. Album Dimensions & Layout

**Container sizing:**
- Width: `min(75vw, 420px)` — responsive but capped
- Aspect ratio: 5:3 (w:h) — wide and short, book-like
- So height = width × 0.6
- Example at 1920px viewport: ~420×252px (currently 252×180)

**Internal page layout:**
- Two pages side by side (left + right), divided by the spine
- Each page has internal padding: 8-12px depending on album style
- Photos arranged in a **responsive grid** within each page

**Photo grid rules:**
- Total photos distributed across two pages (left gets ceil(n/2), right gets floor(n/2))
- Grid per page based on photo count on that page:
  - 1 photo: single photo filling the page (with padding)
  - 2 photos: 2×1 grid (stacked vertically) or 1×2 (side by side) — pick by aspect ratio
  - 3 photos: 1 large top + 2 small bottom (masonry-ish)
  - 4+ photos: 2-column grid, rows as needed
- Photos maintain aspect ratio within their grid cell (object-fit: cover with subtle rounding)
- Gap between grid items: 4px
- Photos in the grid get the selected **frame style** applied

### 3. Photo Frame Styles (Phase 2, but type definition in Phase 1)

Five frame styles. The type is added in Phase 1 (default to `polaroid`), visual implementation in Phase 2.

```typescript
// src/types/index.ts
export type PhotoFrameStyle = "polaroid" | "borderless" | "film-strip" | "classic-border" | "rounded-card";
```

**Visual specs (for Phase 2 implementation):**

**Polaroid (default):**
- White border: top/left/right 6px, bottom 20px (scaled to photo size)
- Bottom area: caption in handwriting font (Caveat from Google Fonts)
- Subtle box-shadow: `0 1px 3px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)`
- Very slight rotation per card (±1-3° random, seeded by photo index)
- Paper texture on white border (very subtle noise)

**Borderless:**
- No border, photo fills its grid cell
- 4px border-radius
- Subtle inner shadow (vignette effect): `inset 0 0 8px rgba(0,0,0,0.06)`

**Film Strip:**
- Top and bottom: 6px dark strip (`#1a1a1a`) with repeating square perforations (4px squares, 8px apart, `rgba(255,255,255,0.3)`)
- Left/right: 2px dark border
- Implemented via CSS `repeating-linear-gradient` on `::before` and `::after` pseudo-elements

**Classic Border:**
- Uniform white border: 5px all sides
- Clean, no rotation
- Subtle shadow: `0 1px 4px rgba(0,0,0,0.1)`

**Rounded Card:**
- 12px border-radius
- 4px white border
- Prominent soft shadow: `0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)`
- Modern/clean feel

### 4. Collection Animation

**Trigger:** All photos at a location have finished displaying in PhotoOverlay.

**Sequence:**
1. Album pin appears (open state, empty pages with texture) — scales up from 0.9 with slight spring
2. After all PhotoOverlay photos finish displaying:
   - Each photo transforms from its current **screen position/size** in the overlay
   - Gets the selected frame style applied (if not already visible)
   - **Sequentially** (staggered by ~120ms per photo): scales down + moves to its target grid cell position within the album
   - Motion curve: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out), duration ~400ms per photo
   - As each photo lands in grid, a subtle "settle" — tiny bounce (scale 1.02 → 1.0) over 150ms
3. After last photo settles: hold open state for **300ms**
4. Transition to visited pin: album scales down (0.9 → 0.72), opacity fades to 0.7, morphs into the small visited circle pin

**Implementation approach:**
- PhotoOverlay needs to expose each photo's current **bounding rect** (position + size relative to viewport)
- ChapterPin (album) needs to calculate each grid cell's **target bounding rect**
- The animation interpolates between source rect → target rect using framer-motion `layout` animations or manual `transform` interpolation
- During the fly-to-grid animation, photos are rendered in a **portal layer** (above both PhotoOverlay and ChapterPin) to avoid z-index clipping issues

### 5. State Management

**New state in uiStore:**

```typescript
// Add to PersistedUISettings and UIState:
albumStyle: AlbumStyle;        // default: "vintage-leather"
photoFrameStyle: PhotoFrameStyle; // default: "polaroid"

// Add setters:
setAlbumStyle: (style: AlbumStyle) => void;
setPhotoFrameStyle: (style: PhotoFrameStyle) => void;
```

Both are persisted to localStorage via the existing `persistSettings` mechanism.

**New type exports in `src/types/index.ts`:**
```typescript
export type AlbumStyle = "vintage-leather" | "japanese-minimal" | "classic-hardcover" | "travel-scrapbook";
export type PhotoFrameStyle = "polaroid" | "borderless" | "film-strip" | "classic-border" | "rounded-card";
```

### 6. Settings UI

**Album Style** — in TopToolbar Settings panel (global, trip-level):
- New section after "Mood Colors", before the `<hr>`
- Label: "Album Style"
- 4 buttons in a 2×2 grid, each showing:
  - A small color swatch representing the style (page color + spine color)
  - Style name below
- Selected state: indigo ring (matching existing pattern)

**Frame Style** — in PhotoLayoutEditor panel (per-location, alongside existing settings):
- New section grouped with photoStyle and photoAnimation
- The existing settings panel has many items; reorganize into collapsible groups:
  - **Layout** — layout template, gap, border-radius, proportions
  - **Animation** — enter animation, exit animation, scene transition
  - **Style** — photo style (classic/kenburns/bloom/portal), frame style (NEW), caption settings
- Frame style selector: 5 horizontal pill buttons (matching existing pattern)

### 7. ChapterPinState Changes

Current states: `future | album-open | album-collecting | album-closed | visited`

Updated states:
- Remove `album-closed` (no close animation per requirement)
- `album-collecting` now means "photos are flying into grid" (not the old sheet-fly animation)
- Add timing: after last photo lands → 300ms hold → transition to visited

New flow: `future → album-open → album-collecting → visited`

### 8. File Changes Summary

**New files:**
- `src/components/editor/AlbumBook.tsx` — the album visual component (replaces OpenAlbum/ClosedAlbum in ChapterPin.tsx)
- `src/lib/albumStyles.ts` — album style configs (colors, textures, dimensions)
- `src/components/editor/PaperTexture.tsx` — shared SVG noise texture component

**Modified files:**
- `src/types/index.ts` — add AlbumStyle, PhotoFrameStyle types
- `src/stores/uiStore.ts` — add albumStyle, photoFrameStyle state + persistence
- `src/components/editor/ChapterPin.tsx` — use new AlbumBook, remove ClosedAlbum, update state flow
- `src/components/editor/ChapterPinsOverlay.tsx` — pass album style, handle collection animation timing
- `src/components/editor/PhotoOverlay.tsx` — expose photo bounding rects for fly-to-grid animation
- `src/components/editor/TopToolbar.tsx` — add Album Style selector in Settings panel
- `src/components/editor/PhotoLayoutEditor.tsx` — add Frame Style selector, reorganize into groups (Phase 2)
- `src/stores/animationStore.ts` — update timing logic for new collection sequence

---

## Phase 2: Frame Styles + Settings Reorganization

- Implement all 5 frame style visuals (applied to photos inside album grid + during collection animation)
- Add frame style selector to PhotoLayoutEditor
- Reorganize PhotoLayoutEditor settings into collapsible groups (Layout / Animation / Style)
- Google Font loading for Caveat (handwriting font for Polaroid captions)
- Frame style affects how photos appear in PhotoOverlay too (during normal display, before collection)

---

## Phase Breakdown

| Phase | Scope | Estimated Complexity |
|-------|-------|---------------------|
| Phase 1 | Album styles (4 skins) + grid layout + collection animation + album style setting + type defs | Large (~800-1200 lines) |
| Phase 2 | Frame styles (5 visuals) + frame style setting + PhotoLayoutEditor reorg | Medium (~400-600 lines) |

---

## Out of Scope

- Sound effects
- User interaction with album during playback (click, drag, etc.)
- Album close animation (removed per requirement)
- Per-location album style override (global only for now)
