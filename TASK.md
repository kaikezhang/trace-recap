# TASK.md — Current Sprint: CrowdTest Fixes

## ⚠️ DO NOT MERGE ANY PR. Create PR and stop. DO NOT MERGE.

## Sprint: CrowdTest v1 Fixes

| PR | Task | Priority | Status |
|----|------|----------|--------|
| PR25 | Project Persistence (localStorage) | P0 | 🔜 |
| PR26 | Local Photo Upload (file picker) | P0 | 🔜 |
| PR27 | Onboarding + Demo Project | P0 | ⏳ |
| PR28 | Undo/Redo | P1 | ⏳ |

## PR25: Project Persistence (localStorage)

**Problem**: Refreshing the page loses ALL work. This is the #1 user complaint.

**Solution**: Auto-save project state to localStorage, auto-restore on page load.

### What to Build

1. **Auto-save**: After every state change in `projectStore`, debounce-save the full project state to `localStorage` under key `trace-recap-project`.
   - Save: locations, segments, mapStyle, segmentTimingOverrides
   - Debounce: 500ms after last change

2. **Auto-restore**: On app load, check localStorage for saved state and hydrate `projectStore`.
   - If saved state exists → import it (use existing `importRoute` logic)
   - Also restore segment geometry by re-fetching directions

3. **Clear project**: Add a "Clear Route" button that clears localStorage + resets store.
   - Confirm dialog: "Are you sure? This cannot be undone."

4. **Route export includes photos**: Ensure `exportRoute()` includes photo URLs in the JSON so imported routes preserve photos.

### Files to Modify
- `src/stores/projectStore.ts` — add localStorage save/restore logic
- `src/components/editor/LeftPanel.tsx` or `TopToolbar.tsx` — add Clear Route button

### Acceptance Criteria
- [ ] Route persists after page refresh
- [ ] All locations, segments, transport modes preserved
- [ ] Segment timing overrides preserved
- [ ] Map style preserved
- [ ] Photos (URLs) preserved
- [ ] "Clear Route" works with confirmation
- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes

### Branch: `feat/project-persistence`

---

## PR26: Local Photo Upload

**Problem**: Users can only add photos via URL. No way to upload from local device.

**Solution**: Add a file picker that lets users select local images, convert to data URLs or object URLs.

### What to Build

1. **File input**: In `PhotoManager`, add a button "Upload from device" alongside the URL input.
   - Accept: `.jpg, .jpeg, .png, .webp, .gif`
   - Multiple selection allowed
   - Max file size: 10MB per image

2. **Convert to usable URL**: 
   - Use `URL.createObjectURL(file)` for preview (fast, no memory copy)
   - For persistence/export: convert to base64 data URL and store in the photo's `url` field
   - Or: store as object URL for session, and on export warn that local photos won't be included in JSON

3. **Drag & drop**: Support dragging image files onto a location card to add photos.
   - Already partially implemented (`usePhotoDropZone` exists) — extend to handle File drops, not just reorder

4. **Mobile camera**: On mobile, the file input should also offer "Take Photo" option (automatically available with `accept="image/*"` + `capture` attribute).

### Files to Modify
- `src/components/editor/PhotoManager.tsx` — add file upload button, handle File objects
- `src/components/editor/LocationCard.tsx` — extend drop zone to handle file drops

### Acceptance Criteria
- [ ] "Upload" button opens native file picker
- [ ] Selected images appear as photo thumbnails
- [ ] Multiple file selection works
- [ ] Drag & drop files onto location card works
- [ ] Works on mobile (camera option available)
- [ ] Photos display correctly in preview and animation
- [ ] `npm run build` passes

### Branch: `feat/local-photo-upload`
