# SPEC — TraceRecap UX/UI Hardening v2

## Goal

Elevate TraceRecap's core editor UX/UI to industry-excellent level, matching or exceeding TravelBoast, Polarsteps, and AnimateMyTravel in perceived quality and usability. Focus on the **editor experience** (not landing page, which was already polished in polish-v1).

**Success bar:** A first-time user can build and export a route video in under 3 minutes without reading any docs.

## What's Already Done (polish-v1, 2026-04-04)

- Landing page hero redesign
- Brand system (colors, typography, CSS custom properties)
- Left panel visual enhancement + empty states
- Export dialog + playback controls polish
- Micro-interactions, transitions, loading states
- Mobile responsive final pass
- SEO metadata + social preview assets
- Performance audit

## Gap Analysis: What Remains

### Priority 1: Journey Timeline Redesign (RouteList)
**Current:** Flat card list, 12 stops render as a dense vertical stack with no visual route flow.
**Target:** Visual timeline — vertical connector line, transport-segment styling between stops, mini route summary at top, collapsible sections for waypoints.

### Priority 2: Cinematic Playback Bar
**Current:** Basic play/pause + scrubber.
**Target:** Segment tick marks on scrubber, current segment highlighted, segment name on hover, mini thumbnail preview on hover.

### Priority 3: Inline Quick Access Toolbar
**Current:** Map style and key animation settings buried in Settings dropdown.
**Target:** Add a **Quick Style Bar** below TopToolbar — map style thumbnail strip (horizontal scroll), animation speed slider, aspect ratio chips. Always visible, one-tap to change.

### Priority 4: Keyboard Shortcuts
**Current:** None.
**Target:** Space=play/pause, Delete/Backspace=remove selected location, Cmd/Ctrl+Z=undo, Cmd/Ctrl+Shift+Z=redo, Escape=deselect, 1-9=jump to stop.

### Priority 5: Enhanced Location Cards
**Current:** Basic card with number, city name, emoji, photo thumbnails, expand/remove buttons.
**Target:** Cards show a small route-segment preview (the line connecting to next stop), transport mode color accent, drag handle more visible, swipe actions on mobile.

### Priority 6: Toast + Undo Feedback
**Current:** Undo/redo buttons exist but no feedback when triggered.
**Target:** Subtle toast notification on undo/redo ("Undid: Removed Tokyo"), auto-dismiss 2s.

### Priority 7: Mini Route Overview (Sidebar Header)
**Current:** Stats cards (Stops, Distance) at top of LeftPanel.
**Target:** Replace one stat card with a **mini static SVG route preview** showing the approximate route shape with colored transport-segment lines. Helps users orient without looking at the map.

## Technical Approach

### File Ownership
| Component | File(s) | Notes |
|-----------|---------|-------|
| Journey Timeline | `RouteList.tsx`, `LocationCard.tsx` | New timeline layout, keep existing DnD |
| Cinematic Playback | `PlaybackControls.tsx`, `animationStore.ts` | Add segment data to scrubber |
| Quick Style Bar | `TopToolbar.tsx`, new `QuickStyleBar.tsx` | Inline style controls |
| Keyboard Shortcuts | `EditorLayout.tsx` | `useEffect` keyboard listener |
| Toast System | New `Toast.tsx` + `uiStore.ts` | Zustand-driven toast state |
| Mini Route Preview | `LeftPanel.tsx`, new `MiniRoutePreview.tsx` | SVG path from location coords |
| Context Menus | `LocationCard.tsx`, `MapCanvas.tsx` | `onContextMenu` handlers |

### Design Principles
- All changes use existing brand tokens (`brand.colors`, `brand.fonts`, `brand.shadows`)
- Tailwind CSS 4 + shadcn/ui (existing pattern)
- Mobile-first breakpoints — changes must work on 375px width
- No breaking changes to existing Zustand store interfaces
- Backward compatible: new store fields have defaults

## Constraints
- No changes to the animation engine or video export pipeline
- No changes to the data model (types/index.ts)
- Must pass `npm run build` and `npm run lint`
- All interactive elements must have ARIA labels
- Playwright tests for new interactions (if existing test infra available)

## Acceptance Criteria

1. **Journey Timeline:** Route list shows vertical timeline with colored connector lines between stops. Waypoints are visually indented and dimmed. Drag-to-reorder still works.
2. **Playback Bar:** Scrubber shows colored tick marks at each segment boundary. Hovering over a tick shows segment name tooltip.
3. **Quick Style Bar:** Map style thumbnails (8 of 15 styles) visible in a horizontal scroll strip below toolbar. One tap changes style.
4. **Keyboard Shortcuts:** Space bar toggles play/pause when editor is focused. Delete key removes selected location.
5. **Mini Route Preview:** Sidebar header shows a ~80px tall SVG route preview with colored lines.
6. **Toast:** Undo/redo triggers a brief toast notification.
7. **Build:** `npm run build` passes with no errors.
8. **Mobile:** All new UI elements work on 375px width.
