# ⚠️ DO NOT MERGE ANY PR. Create PR and STOP.

# TASK: Free Mode UX Fixes — Comprehensive Bug Fix Round

## Issues to Fix

### 1. Default (non-free) captions should use pill style, not plain text
**Files:** `src/components/editor/PhotoOverlay.tsx`
**Problem:** Non-free mode captions use `text-gray-700 text-center truncate px-1` (plain dark text, no background). They should match the free mode pill style.
**Fix:** Change ALL non-free caption `<p>` elements to use the same pill style as free mode:
- Add `rounded-md shadow-sm` classes
- Add `backgroundColor: "rgba(255,255,255,0.74)"`
- Add `textShadow: "0 1px 3px rgba(0,0,0,0.35)"`
- Change text color from `text-gray-700` to white (the text color should come from the caption color setting, default `#ffffff`)
- Remove `truncate` — let text wrap naturally
- These exist in 3 places: bloom rendering, normal rendering, and incoming photo rendering

### 2. Switching to Free mode must preserve exact visual positions (WYSIWYG)
**Files:** `src/lib/photoLayout.ts` (`computedRectsToFreeTransforms`), `src/components/editor/PhotoLayoutEditor.tsx`
**Problem:** When clicking "Free" in layout selector, the photos jump to different positions. The caption offsets and zIndex get reset. The conversion from computed rects to free transforms doesn't preserve the current visual state perfectly.
**Fix:**
- `computedRectsToFreeTransforms` should produce transforms that render IDENTICALLY to the computed rects
- Ensure caption default offset position matches exactly where captions appear in non-free mode (below the photo, centered)
- Preserve any existing caption text from `Photo.caption`

### 3. Cannot deselect / exit caption editing
**Files:** `src/components/editor/FreeCanvas.tsx`
**Problem:** After selecting a caption or entering edit mode, there's no way to deselect/exit. Clicking empty space should deselect. Pressing Escape should exit editing.
**Fix:**
- Clicking on empty canvas area (the background) should clear selection (`setSelection(null)`) AND exit editing (`setEditingCaptionId(null)`) — verify the existing `onPointerDown` on the container actually works (it may be intercepted by child elements)
- Pressing Escape while editing a caption should exit edit mode (this may already exist but verify it works)
- Clicking a different photo/caption should deselect the current one

### 4. Cannot select/edit other photos — only one photo is interactive
**Files:** `src/components/editor/FreeCanvas.tsx`
**Problem:** User can only interact with one photo. Clicking other photos doesn't select them.
**Fix:** Debug the pointer event handling. Likely issue: the z-index layering or event propagation prevents clicks on photos that aren't on top. Each photo's container div has `className="absolute inset-0"` with `style={{ zIndex: transform.zIndex }}` — this creates overlapping full-size divs where only the top one receives clicks.
**Root cause:** Each photo is wrapped in `<div className="absolute inset-0" style={{ zIndex: transform.zIndex }}>` — this makes EVERY photo a full-screen overlay. Only the highest z-index one receives pointer events.
**Fix:** Change the outer wrapper from `absolute inset-0` to only cover the photo's actual area. The wrapper should be positioned at the photo's coordinates, not span the full container.

### 5. Expanded view wastes too much space — remove header and footer
**Files:** `src/components/editor/PhotoLayoutEditor.tsx`
**Problem:** In expanded mode, the header (title + buttons) and footer ("Changes applied automatically" + Done button) waste vertical space. The photo editing area should be maximized.
**Fix:**
- When `expanded` is true, hide the header and footer entirely
- Show only a floating minimize button (Minimize2 icon) in the top-right corner of the canvas, with a semi-transparent background so it doesn't obstruct editing
- The minimize button should restore the normal modal view

### 6. Max caption font size too small
**Files:** `src/components/editor/FreeCanvas.tsx`
**Problem:** The font size slider max is 32px — too small for large canvases.
**Fix:** Double the max to 64px. The `<input type="range">` max should be `64` instead of `32`.

### 7. Caption background fill should be customizable
**Files:** `src/components/editor/FreeCanvas.tsx`, `src/types/index.ts`
**Problem:** Caption pill background is hardcoded to `rgba(255,255,255,0.74)`. Users need to customize it.
**Fix:**
- Add `bgColor?: string` to the caption type in `FreePhotoTransform.caption` in `src/types/index.ts`
- Add a background color row in the caption style toolbar (below the text color row)
- Preset options: `rgba(255,255,255,0.74)` (default white), `rgba(0,0,0,0.6)` (dark), `rgba(99,102,241,0.7)` (indigo), `transparent` (no bg)
- The `bgColor` should be used in both FreeCanvas rendering AND PhotoOverlay free mode caption rendering
- Default: `rgba(255,255,255,0.74)` (current behavior)
- Also update `src/stores/projectStore.ts` serialization/deserialization to include `bgColor`

### 8. PhotoOverlay free mode captions should also use bgColor
**Files:** `src/components/editor/PhotoOverlay.tsx`
**Problem:** Free mode captions in PhotoOverlay have hardcoded `backgroundColor: "rgba(255,255,255,0.74)"`. Should use the per-caption `bgColor` if set.
**Fix:** Read `freeTransform.caption.bgColor` and use it as `backgroundColor`. Fall back to `"rgba(255,255,255,0.74)"` if not set. Apply this to all 3 free-mode caption render locations in PhotoOverlay.

## File Checklist
- [ ] `src/types/index.ts` — Add `bgColor?: string` to `FreePhotoTransform.caption`
- [ ] `src/components/editor/FreeCanvas.tsx` — Fix issues #3, #4, #6, #7
- [ ] `src/components/editor/PhotoOverlay.tsx` — Fix issues #1, #8
- [ ] `src/components/editor/PhotoLayoutEditor.tsx` — Fix issue #5
- [ ] `src/lib/photoLayout.ts` — Fix issue #2
- [ ] `src/stores/projectStore.ts` — Serialize/deserialize `bgColor`

## Validation
- `npx tsc --noEmit` must pass
- `npm run build` must pass

## Branch
`fix/free-mode-ux`
