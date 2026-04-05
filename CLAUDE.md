# CLAUDE.md — TraceRecap P0 Fixes

## Current Task

Fix **two P0 issues** for the TraceRecap demo:

### P0-1: Replace alishan-1.jpg ✅ ALREADY DONE
The file `public/demo-photos/alishan-1.jpg` has been replaced with a realistic Alishan mountain sunrise photo. No code change needed.

### P0-2: Photo Card 竖屏布局重构 — 9:16 改为全屏单图模式

**Problem:** When `viewportRatio === "9:16"`, the current masonry layout shows photos at ~130×80px each — completely unreadable. Tokyo Tower photos get compressed into tiny strips.

**Expected behavior in 9:16:**
- Show **one photo at a time** (single photo, full-width, or full-height in the photo card area)
- When there are 2+ photos, show them **side by side** (2-column) instead of masonry grid
- Photos should be **large and readable** — at least 200px wide in 9:16 portrait
- City label, chapter emoji, date, and caption text must be clearly legible

**NOT this (current broken behavior):**
```
┌────┬────┬────┐  ← 3 tiny photos, ~130px wide each, unreadable captions
│ p1 │ p2 │ p3 │
└────┴────┴────┘
```

**DO this instead (9:16 portrait):**
```
┌────────────────────┐
│                    │
│     photo 1       │  ← Single large photo, full container width
│                    │
│  🗼 Tokyo          │  ← City label
│  Tokyo Tower 🌆    │  ← Caption
└────────────────────┘
OR for 2 photos:
┌──────────┬──────────┐
│  photo1  │  photo2  │  ← 2-column layout, both clearly visible
│  caption │  caption │
└──────────┴──────────┘
```

## Files to Modify

1. **`src/lib/photoLayout.ts`** — Modify the `computePhotoLayout` function to accept `viewportRatio` and return a 9:16-friendly layout
2. **`src/components/editor/PhotoOverlay.tsx`** — Pass `viewportRatio` to the layout computation and adjust rendering logic

## Implementation Hints

### In `photoLayout.ts`:
```typescript
// Add viewportRatio parameter to computePhotoLayout
export function computePhotoLayout(
  photos: PhotoMeta[],
  containerWidth: number,
  containerHeight: number,
  template: LayoutTemplate,
  viewportRatio?: AspectRatio, // NEW PARAM
): PhotoLayout { ... }
```

### In `PhotoOverlay.tsx`:
```typescript
// Line 319 already has: const viewportRatio = useUIStore((s) => s.viewportRatio);
// Pass it to computePhotoLayout:
const photoLayout = computePhotoLayout(
  displayMetas,
  containerSize.w,
  containerSize.h,
  template,
  viewportRatio, // NEW — pass viewportRatio
);
```

### Layout logic for 9:16:
```typescript
const isPortraitViewport = viewportRatio === "9:16" || viewportRatio === "3:4";

if (isPortraitViewport) {
  // Single column, photos stacked or in 2-column grid
  if (photos.length <= 2) {
    return computeTwoColumnLayout(photos, containerWidth, containerHeight);
  } else {
    // For 3+ photos in portrait: show 2-column, first photo spans full width on top
    return computePortraitGalleryLayout(photos, containerWidth, containerHeight);
  }
}
// For 16:9, 4:3, 1:1: use existing masonry logic unchanged
```

## Acceptance Criteria

1. In 9:16 viewport, each photo is clearly visible (min 200px wide)
2. Photo captions and city labels are readable
3. The 9:16 layout is distinctly different from the 16:9 layout
4. Existing 16:9/4:3/1:1 behavior is unchanged
5. No TypeScript errors, no console errors

## Testing

After making changes:
1. Start the dev server: `cd /home/kaike/.openclaw/workspace/trace-recap && npx next start -p 3005 &`
2. Open http://localhost:3005/editor?demo=true
3. Click 9:16 aspect ratio button
4. Play the animation to a location with photos (e.g., Tokyo)
5. Verify photos are large and readable

## Constraints
- Do NOT change any 16:9 or other aspect ratio behavior
- Do NOT add new dependencies
- Keep the code clean and type-safe
- Write no new tests (MVP budget)
