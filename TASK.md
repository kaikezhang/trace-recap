# TASK: Mobile UI Polish — Settings Panel & Scrolling

⚠️ DO NOT MERGE. Create PR and stop.

## Problems (from user testing on iPhone)

1. **Settings panel gets cut off on mobile** — It's an `absolute` positioned dropdown (`right-0 top-full`) with `max-h-[80vh] overflow-y-auto`. On mobile screens, the panel extends below the viewport and users can't see/reach the bottom settings (Mood Colors, etc.)

2. **Bottom content unreachable** — Even with `overflow-y-auto`, the bottom of the settings panel can be obscured by the iOS safe area / home indicator bar

3. **Settings + BottomSheet z-index conflict** — Both use `z-50`, settings panel can render behind the bottom sheet on mobile

## Solution: Mobile Settings Drawer

On mobile (`md:` breakpoint), convert the settings dropdown into a **slide-up drawer/sheet** instead of a positioned dropdown:

### Implementation

1. **Desktop (≥768px)**: Keep current dropdown behavior unchanged — `absolute right-0 top-full` with `max-h-[80vh] overflow-y-auto`

2. **Mobile (<768px)**: Render settings as a **full-height drawer** from the bottom:
   - Use a fixed overlay (`fixed inset-0 z-[60]`) with backdrop blur/dim
   - Content panel: `fixed bottom-0 left-0 right-0 z-[60]` with `max-h-[85vh]` and `overflow-y-auto`
   - Add `pb-safe` / `pb-[env(safe-area-inset-bottom)]` for iOS safe area
   - Rounded top corners (`rounded-t-2xl`)
   - Drag handle at top (like BottomSheet)
   - Close button (X) in header
   - Tap backdrop to close

3. **Extract settings content** into a shared component/fragment so desktop dropdown and mobile drawer render the same controls without duplication

### Files to modify
- `src/components/editor/TopToolbar.tsx` — Split settings rendering by breakpoint
- `tailwind.config.ts` — Add `safe-area-inset-bottom` utility if not present

### Additional mobile polish
- Add `overscroll-contain` to prevent scroll chaining on the settings panel
- Ensure the last setting item has enough bottom padding to be fully visible (`pb-8` or similar)
- When settings drawer is open on mobile, prevent body/map scrolling (add `overflow-hidden` to body)

### Testing checklist
- [ ] Settings panel scrolls to bottom on iPhone (all items visible including Mood Colors)
- [ ] iOS safe area respected (content not hidden behind home indicator)
- [ ] Settings drawer closes on backdrop tap
- [ ] Settings drawer closes on X button
- [ ] Desktop dropdown behavior unchanged
- [ ] No z-index conflicts with BottomSheet
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
