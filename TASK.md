# ⚠️ DO NOT MERGE ANY PR. Create PR and STOP.

# TASK: Free Mode UX Round 2 — Layout Sizing, Toolbar Overflow, Font Library

## Issues to Fix

### 1. Expanded mode photos are tiny — preview doesn't fill available space
**Files:** `src/components/editor/PhotoLayoutEditor.tsx`
**Problem:** In expanded mode (95vw×95vh), the photo preview area is very small relative to the available space. The `previewContainerStyle` uses the viewport ratio to constrain the preview, but when expanded the constraint is too aggressive.
**Fix:** When `expanded` is true, the preview container should grow to fill the available space. The FreeCanvas or PhotoOverlay inside should scale to use the full area. The preview container style calculation needs to account for the expanded state — use the full panel dimensions, not just the viewport-ratio-constrained size.
- In expanded mode, set `previewContainerStyle` to `{ width: "100%", height: "100%" }` so the canvas fills the entire available area
- The FreeCanvas should fill its parent container entirely

### 2. Caption style toolbar gets cut off / clips outside container
**Files:** `src/components/editor/FreeCanvas.tsx`
**Problem:** The caption editing toolbar (font dropdown, size slider, color presets, fill presets) pops up above the selected caption. When the caption is near the top of the container, the toolbar gets clipped by `overflow: hidden` on the parent.
**Fix:**
- Change the FreeCanvas container from `overflow-hidden` to `overflow-visible`
- OR reposition the toolbar: if the caption is in the top half of the container, show the toolbar BELOW the caption instead of above
- The toolbar should never be clipped. Test with captions at all four edges.

### 3. More fonts needed — especially Chinese fonts — with preview in dropdown
**Files:** `src/components/editor/FreeCanvas.tsx`, `src/components/editor/PhotoLayoutEditor.tsx`
**Problem:** Only 4 generic fonts (System UI, Serif, Monospace, Cursive). Need more fonts, especially Chinese-friendly ones. Font dropdown should show each option rendered in its own font for preview.
**Fix:**
- Expand the font list to include Google Fonts that support Chinese. Use `@import` or `<link>` to load them. Add to the app's global CSS or load dynamically.
- New font list (keep existing + add):
  - `system-ui` — System UI
  - `"Noto Sans SC", sans-serif` — Noto Sans SC (思源黑体)
  - `"Noto Serif SC", serif` — Noto Serif SC (思源宋体)
  - `"ZCOOL KuaiLe", sans-serif` — ZCOOL KuaiLe (站酷快乐体)
  - `"ZCOOL XiaoWei", serif` — ZCOOL XiaoWei (站酷小薇体)
  - `"Ma Shan Zheng", cursive` — Ma Shan Zheng (马善政楷体)
  - `"Liu Jian Mao Cao", cursive` — Liu Jian Mao Cao (流坚毛草)
  - `serif` — Serif
  - `monospace` — Monospace
  - `cursive` — Cursive
- Load these Google Fonts by adding a `<link>` tag in `src/app/layout.tsx`:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Noto+Serif+SC:wght@400;700&family=ZCOOL+KuaiLe&family=ZCOOL+XiaoWei&family=Ma+Shan+Zheng&family=Liu+Jian+Mao+Cao&display=swap" rel="stylesheet">
  ```
- In the font `<select>` dropdown in FreeCanvas, render each `<option>` with `style={{ fontFamily: value }}` so users can preview the font
- Also update the font list in `PhotoLayoutEditor.tsx` (the global Caption Style section in the left panel) to use the same expanded font list
- Extract the font list into a shared constant in `src/lib/constants.ts`

### 4. Font size slider in toolbar needs a numeric display
**Files:** `src/components/editor/FreeCanvas.tsx`
**Problem:** The font size slider has no numeric indicator showing the current value.
**Fix:** Add a small `<span>` after the slider showing the current font size value (e.g. "24px"), similar to the existing caption font size control in PhotoLayoutEditor's left panel.

## File Checklist
- [ ] `src/components/editor/FreeCanvas.tsx` — Fix #2, #3, #4
- [ ] `src/components/editor/PhotoLayoutEditor.tsx` — Fix #1, #3
- [ ] `src/app/layout.tsx` — Add Google Fonts `<link>` tag
- [ ] `src/lib/constants.ts` — Shared font list constant

## Validation
- `npx tsc --noEmit` must pass
- `npm run build` must pass

## Branch
`fix/free-mode-ux-r2`
