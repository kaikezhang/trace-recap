# UI Redesign Phase 2 — Absorbing Kimi's Design Excellence

## What Kimi Did Better (Must Adopt)

### 1. CityCard — Expand/Collapse Pattern ⭐⭐⭐
Kimi's card has a clean collapsed state (drag handle + number + name + 3 photo thumbnails + chevron + delete) and a detailed expanded state (waypoint toggle, photo management). This is MUCH better than our current "everything visible always" approach.

**Adopt**: 
- Default collapsed: show drag handle, number badge, English name + Chinese name on same line, up to 3 photo thumbnails (8x8 rounded squares), chevron toggle, delete button
- Click to expand: show waypoint toggle (custom switch, not emoji button), photo upload area with grid, name editing
- Use `AnimatePresence` + `motion.div` for smooth expand/collapse with `height: auto`
- Delete button: ghost style, hover turns red with red background `hover:text-red-500 hover:bg-red-50`

### 2. PlaybackControls — Large Circular Play Button ⭐⭐⭐
Kimi's play button is a 48px indigo circle with shadow (`shadow-lg shadow-indigo-500/25`), hover scale effect. Way more prominent than our current ghost button.

**Adopt**:
- Play/Pause: `w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95`
- Reset stays as ghost icon button
- Controls bar: `bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50`
- Add segment info label above controls when playing: `"Taipei → Taichung"` in a small pill

### 3. ExportDialog — Two-Step with Progress Ring ⭐⭐⭐
Kimi's export dialog is gorgeous:
- Aspect ratio as two big clickable cards (Monitor icon / Smartphone icon) with selected highlight border
- "Quick Export (720p)" as primary CTA, full width, `h-12`
- Advanced settings hidden behind a collapsible section
- Export progress as SVG circular ring with percentage in center
- Completion state: big green checkmark circle + file size + download button

**Adopt all of this.**

### 4. SearchBox — Focus Ring + Result Cards ⭐⭐
- Focus state: `border-indigo-500 ring-2 ring-indigo-500/10 bg-white` (currently we don't have this)
- Result items have a MapPin icon in indigo-50 circle + city name + Chinese name + country
- Empty search state: centered MapPin icon + "No cities found"

**Adopt**: Enhanced focus ring, richer search result items with icon, better empty state

### 5. Map Empty State — Larger, More Premium ⭐⭐
Kimi uses a `w-20 h-20 rounded-2xl bg-white shadow-xl` container for the icon — much more premium than a plain icon. Buttons are properly styled primary/outline pair.

**Adopt**: Larger icon container with shadow, better button styling

### 6. TransportSelector — Distance Divider Lines ⭐
Kimi shows distance with horizontal line dividers: `─── 2,100 km ───`
Nice subtle touch.

**Adopt**: Add horizontal divider lines around the distance text

### 7. Map Loading Skeleton ⭐
Kimi shows a pulse gradient animation while the map loads instead of blank white.

**Adopt**: `animate-pulse bg-gradient-to-br from-gray-100 to-gray-200`

## What To Keep From Our Current Design
- Our actual animation engine and Mapbox integration (Kimi's is mock)
- Our drag-and-drop with dnd-kit (Kimi's is mock)
- Our photo upload with data URLs (Kimi still uses URL input)
- Our localStorage persistence
- Our undo/redo system
- Our onboarding hints system
- Our existing TopToolbar More menu (Phase 1 already done)
