# TASK.md — Route Editing UX Overhaul

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Changes

### 1. Drag-and-Drop Reorder (Major)
Replace the up/down arrow buttons with proper drag-and-drop sorting.

**Install**: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**RouteList.tsx** — Wrap with DndContext + SortableContext:
- Each LocationCard becomes a sortable item
- Drag handle: the existing GripVertical icon (⠿) becomes the drag handle
- On drag end: call `reorderLocations(oldIndex, newIndex)`
- Visual feedback: lifted card with shadow, insertion indicator line

**LocationCard.tsx** — Make sortable:
- Wrap with `useSortable()` hook from @dnd-kit/sortable
- Apply transform/transition styles
- GripVertical becomes the drag handle (via `listeners` and `attributes`)
- Remove ChevronUp/ChevronDown buttons entirely

### 2. Fix Transport Mode Reset Bug (Critical)
**projectStore.ts `rebuildSegments()`**:
Current: only matches `fromId-toId` key → misses reversed segments after reorder.
Fix: Also check `toId-fromId` (reversed). If reversed match found, use the old segment's transportMode but set geometry to null (needs re-fetch for new direction).

```typescript
const existing = segmentMap.get(`${fromId}-${toId}`) 
  || segmentMap.get(`${toId}-${fromId}`);
if (existing) {
  segments.push({
    ...existing,
    id: generateId(),
    fromId,
    toId,
    geometry: segmentMap.has(`${fromId}-${toId}`) ? existing.geometry : null,
  });
} else {
  // genuinely new pair — default to flight
}
```

### 3. Rename "fly-through" to "Stop by"
- LocationCard.tsx: change "fly-through" label to "stop by"
- BottomSheet.tsx: if it shows "fly-through" anywhere, change to "stop by"
- Tooltip: "Switch to stop by" / "Switch to destination"

### 4. Transport Selector Between Cards
**TransportSelector.tsx** — Restyle to appear between location cards:
- Show as a compact pill between two cards with a vertical connecting line
- Display the selected transport icon prominently
- Click to expand icon row for selection
- Show distance between the two cities if geometry exists (use turf.length)

### 5. Auto-regenerate Geometry After Reorder
When segments are rebuilt after reorder, any segment with `geometry: null` needs geometry re-fetched. In EditorLayout or RouteList, detect segments with null geometry and trigger `generateRouteGeometry()` for them.

## Branch
Create branch: `feat/route-editing-ux`

## Verification
1. `npx tsc --noEmit` passes
2. Drag reorder works on desktop and mobile
3. Reordering preserves transport modes (not reset to flight)
4. "stop by" label instead of "fly-through"
5. Transport selector shows icons between cards with distance
