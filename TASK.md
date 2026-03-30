# TASK.md — Label positioning: relative + configurable

⚠️ DO NOT MERGE. Create PR and stop.

## Problem
City label (`top-6` = fixed 24px) and route segment label (`bottom-20` = fixed 80px) use absolute pixel positioning. This means:
- In free mode (tall container), the route label sits very low and gets hidden by PlaybackControls
- In 4:3 mode (short container), labels are relatively higher
- Not consistent across viewport ratios

## Solution

### 1. Use percentage-based positioning
Replace fixed pixel positioning with percentage-based:
- **City label**: `top: X%` of the map container (default ~5%)
- **Route segment label**: `bottom: Y%` of the map container (default ~15%)

This makes labels consistently positioned regardless of container height.

### 2. Add settings to configure label positions
Add two new settings to `uiStore`:
- `cityLabelTopPercent: number` (default 5, range 0-30)
- `routeLabelBottomPercent: number` (default 15, range 5-40)

### 3. Add controls to Settings panel
In the Settings popover (TopToolbar gear icon), add two sliders:
- "City Label Position" — slider 0-30%
- "Route Label Position" — slider 5-40%

Keep them in the same settings panel as City Label Language and Size.

### 4. Apply in MapStage
- `CityLabelOverlay`: replace `className="absolute top-6 ..."` with `style={{ top: '${cityLabelTopPercent}%' }}`
- Route segment label: replace `className="absolute bottom-20 ..."` with `style={{ bottom: '${routeLabelBottomPercent}%' }}`
- Read both values from `useUIStore`

## Files to modify
- `src/stores/uiStore.ts` — add `cityLabelTopPercent`, `routeLabelBottomPercent` + setters
- `src/components/editor/MapStage.tsx` — use percentage positioning
- `src/components/editor/TopToolbar.tsx` — add position sliders to settings panel

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`

## Verification
- `npx tsc --noEmit` must pass
- `npm run build` must pass
- Labels positioned consistently in free mode and 4:3 mode
- Settings sliders adjust label positions in real-time
