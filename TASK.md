# TASK.md — Settings panel + map language + route label fix

⚠️ DO NOT MERGE. Create PR and stop.

## Problem
1. City label settings (font size, language) are buried in Export Dialog's "Advanced Settings" — should be a separate settings panel accessible from toolbar
2. When user selects Chinese language, only the floating city label overlay changes — the Mapbox base map labels stay in English. Map labels should also switch to Chinese.
3. The "Taipei → Taichung" route segment indicator is positioned outside the map area (below the map in the dark zone on mobile). It should be inside the map container.

## Requirements

### 1. Create a Settings panel (gear icon in TopToolbar)
- Add a gear/settings icon button to the TopToolbar (right side, near undo/redo)
- Clicking it opens a side panel or popover with these settings:
  - **City Label Language**: English / 中文 toggle pills (move from ExportDialog)
  - **City Label Size**: slider 12-48px (move from ExportDialog)
- These settings are already in `uiStore` (`cityLabelSize`, `cityLabelLang`) — just move the UI
- Remove these settings from ExportDialog's Advanced Settings section
- The Export Dialog should become simpler: just "Export Video" button + the WYSIWYG explanation text
- On mobile, the settings could be a small dropdown/popover from the gear icon

### 2. Apply language to Mapbox base map labels
When `cityLabelLang` changes, update Mapbox GL layers to show labels in the selected language:
- Mapbox vector tiles include `name_zh-Hant` (Traditional Chinese), `name_en`, `name` fields
- Find all label layers (settlement, place, country, state, etc.) and update their `text-field` layout property:
  - English: `["coalesce", ["get", "name_en"], ["get", "name"]]`
  - Chinese: `["coalesce", ["get", "name_zh-Hant"], ["get", "name_zh-Hans"], ["get", "name"]]`
- Use `map.getStyle().layers` to find layers with `type === "symbol"` that have `text-field` set
- Apply via `map.setLayoutProperty(layerId, "text-field", expression)`
- Do this in a `useEffect` in MapCanvas.tsx or EditorLayout.tsx that watches `cityLabelLang`

### 3. Move route segment indicator inside map
The "FromCity → ToCity" pill in `PlaybackControls.tsx` currently renders above the controls bar but outside the map container.
- Move this segment info display to be inside the MapStage component instead, positioned at the bottom of the map (above the playback controls if they're inside, or at a fixed position within the map)
- It should be inside the map container so it appears within the viewport ratio frame
- Keep the same styling (white/90 backdrop-blur pill)

### Non-goals
- Don't change the viewport ratio selector
- Don't change the export logic (it already reads cityLabelSize/cityLabelLang from settings)

## Files to modify
- `src/components/editor/TopToolbar.tsx` — add settings gear icon + panel
- `src/components/editor/ExportDialog.tsx` — remove city label settings
- `src/components/editor/MapCanvas.tsx` or `EditorLayout.tsx` — apply map language
- `src/components/editor/PlaybackControls.tsx` — remove segment info pill from here
- `src/components/editor/MapStage.tsx` — add segment info pill here (inside map)

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`

## Verification
- `npx tsc --noEmit` must pass
- `npm run build` must pass
- Settings gear icon visible in toolbar
- Changing language to 中文 makes BOTH the overlay label AND base map labels show Chinese
- "City → City" route indicator appears inside the map frame
- Export Dialog is simplified (no more Advanced Settings for labels)
