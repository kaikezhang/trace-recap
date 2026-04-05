# CLAUDE.md — Fix WYSIWYG: Edit Preview Must Match Playback

## Two Bugs Reported by User

### Bug 1: Layout edit preview ≠ playback preview (NOT WYSIWYG)

**What user sees:**
- In the **photo layout editing dialog** (the modal with undo/redo/close): Photos are shown as large, beautifully arranged polaroid cards on the map
- In the **playback view** (pressing Play): Same photos become tiny thumbnail clusters on the map

**Expected:** What you see in the edit dialog is what you get during playback. The photo sizes, positions, and layout should be identical.

**Root cause investigation:**
The edit dialog likely renders photos using `PhotoOverlay` component with the full layout engine, but during playback the photos might be rendered differently — possibly through `ChapterPin` / `AlbumBook` (which uses tiny thumbnails) instead of the full `PhotoOverlay`.

Look at:
- How the layout editing dialog renders photos (likely `src/components/editor/PhotoLayoutEditor.tsx` or similar)
- How playback renders photos during ARRIVE phase (`src/components/editor/EditorLayout.tsx` → `PhotoOverlay`)
- Are they using the same layout computation? Same container size? Same component?
- The edit dialog might use `containerMode="parent"` while playback uses `containerMode="viewport"` — check if this causes different sizing

### Bug 2: Free ratio edit preview uses wrong aspect ratio

**What user sees:**
- When the map is in "free" aspect ratio mode (not 16:9/9:16/1:1)
- The photo layout edit dialog preview area has its OWN fixed aspect ratio
- Instead, it should match the ACTUAL aspect ratio of the map viewport behind it

**Expected:** In free ratio mode, the edit dialog preview should mirror the current map container's aspect ratio, not use a hardcoded ratio.

**Root cause investigation:**
The layout editing dialog probably has a hardcoded preview container aspect ratio (like 4:3 or 16:10). In free mode, it should:
1. Read the actual map container dimensions
2. Set the preview to match that aspect ratio
3. So the layout computation produces the same result as playback

Look at:
- The layout editor component — how does it set its preview container size?
- Does it receive the current viewportRatio prop?
- In free mode, does it use the actual canvas dimensions?

## How to Investigate

1. Start dev server: `npm install && npm run dev -- --port 3006`
2. Open in Playwright at desktop size (1280×800)
3. Load demo: `http://localhost:3006/editor?demo=true`
4. Click on Tokyo's photo area to open the layout editor
5. Screenshot the edit dialog — note photo sizes and arrangement
6. Close dialog, press Play, pause at Tokyo ARRIVE
7. Screenshot playback — compare photo sizes and arrangement
8. Identify the code difference causing the mismatch

## Files to Investigate

- `src/components/editor/PhotoLayoutEditor.tsx` (or similar — the layout editing dialog)
- `src/components/editor/PhotoOverlay.tsx` — playback photo display
- `src/components/editor/EditorLayout.tsx` — how playback triggers photo display
- `src/components/editor/AlbumBook.tsx` — if playback uses this instead of PhotoOverlay
- `src/lib/photoLayout.ts` — layout computation (should be same for both!)

## Fix Approach

### For Bug 1 (WYSIWYG):
- Both edit dialog and playback MUST use the same layout computation
- Same container aspect ratio → same `computePhotoLayout()` call → same photo rects
- If the edit dialog uses a different container mode, fix it to match playback
- The playback PhotoOverlay should render photos at the same relative sizes/positions as the edit dialog

### For Bug 2 (Free ratio):
- In free mode, the edit dialog preview should read the actual map container dimensions
- Pass the real aspect ratio to the layout computation
- Don't hardcode a preview aspect ratio

## Testing
- Open edit dialog, note layout
- Play, pause at same city
- Screenshots should look identical (same photo sizes, positions, proportions)
- Test in 9:16, 16:9, AND free mode

## Verification
`npx tsc --noEmit` must pass.
