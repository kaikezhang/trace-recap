# TASK.md — New layout templates + refresh button for random layouts

⚠️ DO NOT MERGE. Create PR and stop.

## Task 1: Add 3 new layout templates

### Diagonal (`diagonal`)
- Photos arranged in a staircase/diagonal pattern from top-left to bottom-right
- Each photo offset right and down from the previous
- Slight overlap between adjacent photos
- Photos sized based on their real aspect ratios

### Rows (`rows`)
- Smart row-based layout (like Google Photos)
- Photos fill rows left-to-right, sized proportionally by their aspect ratios
- Each row has equal height, photos in a row have widths proportional to their aspects
- Rows fill the container width perfectly (justified)
- This is different from Grid — Grid uses equal cells, Rows uses variable widths

### Magazine (`magazine`)
- First photo takes up ~60% of the container as a hero
- Remaining photos arranged in a smaller strip below or beside the hero
- Clean editorial look with generous spacing

### Implementation
1. Add to `LayoutTemplate` type in `src/types/index.ts`: `"diagonal" | "rows" | "magazine"`
2. Add layout functions in `src/lib/photoLayout.ts` — each receives `photos: PhotoMeta[]`, `containerAspect: number`, `gap: number`
3. Add to `LAYOUT_STYLES` in `src/components/editor/PhotoLayoutEditor.tsx` with appropriate icons
4. Add cases in `computeTemplateLayout` switch

## Task 2: Refresh button for random layouts

Layouts with randomness: **Scatter**, **Polaroid**, **Overlap** (they use random rotations/positions).

### Implementation
1. Add a `layoutSeed` field to `PhotoLayout` type (`src/types/index.ts`):
   ```ts
   layoutSeed?: number; // random seed for layouts with randomness
   ```
2. In `PhotoLayoutEditor.tsx`: when a random layout (scatter/polaroid/overlap) is active, show a 🔄 refresh button next to the layout name
3. Clicking refresh: `updateLayout({ layoutSeed: Math.random() })` — this changes the seed, causing a re-render with new random values
4. In `photoLayout.ts`: use `layoutSeed` as a seed for a simple PRNG (seeded random) instead of `Math.random()`:
   ```ts
   function seededRandom(seed: number): () => number {
     let s = seed;
     return () => {
       s = (s * 1664525 + 1013904223) % 4294967296;
       return s / 4294967296;
     };
   }
   ```
5. Pass `layoutSeed` from `PhotoLayout` into the random layout functions
6. This makes random layouts deterministic (same seed = same layout) but refreshable

### Refresh button UI
- Small circular button with a refresh/shuffle icon (🔄 or `RefreshCw` from lucide)
- Positioned next to the active layout style button or in a toolbar
- Only visible when current layout is scatter, polaroid, or overlap
- On click: generates new seed → layout re-randomizes → preview updates

## Files to modify
- `src/types/index.ts` — add template types + layoutSeed
- `src/lib/photoLayout.ts` — add 3 layout functions + seeded random
- `src/components/editor/PhotoLayoutEditor.tsx` — add styles + refresh button

## Working directory
`/home/kaike/.openclaw/workspace/trace-recap`

## Verification
- `npx tsc --noEmit` and `npm run build` must pass
- All 11 layout options visible
- Diagonal, Rows, Magazine render correctly
- Refresh button appears for Scatter/Polaroid/Overlap
- Clicking refresh changes the random layout
