# TASK.md — Mobile-First Responsive UI Redesign

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Goal
Redesign the editor UI to work great on mobile phones in portrait mode while keeping desktop usable.

## Current Layout (Desktop Only)
- TopToolbar: fixed 48px height bar at top
- Left sidebar: fixed 320px wide panel with search, import, route list
- Map: fills remaining space to the right
- Playback controls: floating at bottom-center of map
- Problem: On mobile, 320px sidebar leaves almost no space for the map

## New Layout — Mobile First

### Mobile (< 768px / md breakpoint):
```
┌─────────────────────┐
│  TopToolbar (compact)│  ← logo + export + map style (condensed)
├─────────────────────┤
│                     │
│                     │
│     MAP (full)      │  ← map takes full width and most of the height
│                     │
│                     │
├─────────────────────┤
│  Playback Controls  │  ← full width bar at bottom of map area
├─────────────────────┤
│  Bottom Sheet       │  ← draggable bottom sheet with route list
│  (collapsible)      │     collapsed: shows "N stops · Import" bar
│  ┌─ drag handle ──┐ │     expanded: shows search + route list + import
│  │ Search cities   │ │
│  │ Route list...   │ │
│  │ Import button   │ │
│  └─────────────────┘ │
└─────────────────────┘
```

### Desktop (>= 768px):
Keep current layout but make sidebar collapsible (toggle button).

## Implementation

### 1. EditorLayout.tsx — Responsive structure
- Mobile: flex-col layout (toolbar → map → controls → bottom sheet)
- Desktop: keep current flex-row (toolbar on top, sidebar + map side by side)
- Use Tailwind responsive classes: `md:flex-row`, `md:w-80`, etc.

### 2. LeftPanel.tsx → RoutePanel.tsx (rename for clarity)
- On mobile: render as a bottom sheet (absolute positioned at bottom, draggable)
  - Collapsed state: 56px bar showing "N stops" count + Import button
  - Expanded state: slides up to ~60% of screen height, shows search + route list
  - Tap the collapsed bar or drag handle to expand/collapse
- On desktop: render as the existing left sidebar (w-80, border-r)
- Use a state variable or Zustand store for panel open/closed state

### 3. TopToolbar.tsx — Compact on mobile
- Mobile: smaller height (h-10), smaller font, icon-only buttons (no text labels)
- Desktop: keep current

### 4. PlaybackControls.tsx — Full width on mobile
- Mobile: w-full bar (not floating centered), larger touch targets (44px min)
- Desktop: keep floating centered style
- Slider should be wider on mobile for easier thumb control

### 5. MapCanvas — Full screen on mobile
- Mobile: the map should take all available height between toolbar and playback controls
- No fixed height — use flex-1

### 6. CitySearch.tsx — Inside bottom sheet on mobile
- The search input should be at the top of the expanded bottom sheet
- On desktop: stays in sidebar as-is

## Bottom Sheet Component
Create a simple bottom sheet without external dependencies:
- A div with `position: fixed; bottom: 0; left: 0; right: 0;`
- Has a drag handle bar at top (small gray bar, 40px wide, centered)
- Two states: collapsed (showing peek bar) and expanded (showing content)
- Click/tap on collapsed bar toggles expanded
- Content area has overflow-y: auto for scrolling
- Backdrop overlay when expanded (optional, tap to close)
- Smooth transition with CSS transform translateY

## Technical Notes
- Use Tailwind `md:` prefix for desktop overrides
- Use `useMediaQuery` or just CSS to handle responsive behavior
- Don't break the existing animation engine or store logic
- Keep the Export dialog as a modal (works on both mobile and desktop)

## Branch
Create branch: `feat/mobile-responsive-ui`
