# TASK: Compact Playback Controller During Playback

⚠️ DO NOT MERGE. Create PR and stop.

## Problem
The playback controller bar is too tall during playback and blocks the bottom of the map/video view. We need a compact mode when playing.

## Design

### Idle / Paused State (current design, keep as-is)
- Normal pill shape with all controls visible
- Reset button, Play/Pause button, Slider, Time display
- `bg-white/90 backdrop-blur-xl`, rounded pill

### Playing State (NEW — compact mode)
- **Much shorter height**: hide the Reset button and time display text
- **Wider**: stretch to ~90% of container width on desktop (keep full-width on mobile)
- **Shorter play/pause button**: shrink from h-14/w-14 to h-8/w-8 (mobile) and h-12/w-12 to h-7/w-7 (desktop)
- **Thinner slider**: reduce track height
- **More transparent**: `bg-white/30 backdrop-blur-sm` so map shows through
- **Lower position**: hug the bottom edge with less padding
- Layout: just `[Pause button] [———— progress bar ————]` in a single thin row

### Smooth Transition
- Use CSS transitions or framer-motion `layout` animation for smooth morph between states
- Transition duration: ~300ms ease-in-out
- When user clicks Pause → smoothly expand back to full controls
- When user clicks Play → smoothly collapse to compact bar

## Implementation

### File: `src/components/editor/PlaybackControls.tsx`

1. Use the existing `isPlaying` boolean to toggle between modes
2. Add CSS transition classes for width, height, padding, opacity
3. In compact (playing) mode:
   - Hide Reset button (use `hidden` or `opacity-0 w-0 overflow-hidden` with transition)
   - Hide time display (same approach)
   - Shrink play/pause button
   - Make slider flex-1 to fill remaining space
   - Reduce vertical padding: `py-1` instead of `py-2`
4. Use `transition-all duration-300 ease-in-out` on the controls bar div
5. On desktop (md:), set compact width to `md:w-[90%] md:max-w-2xl` instead of `md:w-auto`

## Verification
- `npx tsc --noEmit` must pass
- `npm run build` must pass
- Test: click Play → controls should smoothly shrink. Click Pause → smoothly expand.
