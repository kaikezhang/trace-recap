# TASK — Export Resolution Selector + Estimated Size

⚠️ DO NOT MERGE ANY PR. Create the PR and stop.

## Problem

The export dialog currently has no resolution options — it always exports at 1080p (or 720p fallback). Users should be able to choose their preferred resolution and see an estimated file size before exporting.

## Goal

Add a resolution selector (720p / 1080p / 4K) to the ExportDialog with estimated file size display.

## Requirements

### 1. Add `resolution` to ExportSettings

In `src/types/index.ts`, add to `ExportSettings`:

```ts
export type ExportResolution = "720p" | "1080p" | "4K";

export interface ExportSettings {
  fps: number;
  resolution?: ExportResolution; // default "1080p"
  // ... existing fields
}
```

### 2. Update `getExportViewportSize` in `src/lib/viewportRatio.ts`

Currently it always picks from `[1080, 720]`. Change it to accept a resolution parameter:

```ts
const RESOLUTION_HEIGHTS: Record<ExportResolution, number> = {
  "720p": 720,
  "1080p": 1080,
  "4K": 2160,
};

export function getExportViewportSize(
  viewportRatio: AspectRatio,
  canvasWidth: number,
  canvasHeight: number,
  resolution: ExportResolution = "1080p",
): ViewportDimensions {
  const ratio = parseViewportRatio(viewportRatio);
  if (!ratio) {
    // "free" ratio: scale canvas to target height, maintain aspect
    const targetH = RESOLUTION_HEIGHTS[resolution];
    const scale = targetH / Math.max(canvasHeight, 1);
    return {
      width: Math.round(canvasWidth * scale),
      height: targetH,
    };
  }

  const exportHeight = RESOLUTION_HEIGHTS[resolution];
  const exportWidth = Math.round(exportHeight * (ratio.width / ratio.height));
  return { width: exportWidth, height: exportHeight };
}
```

### 3. Update VideoExporter.ts call site

In `export()` method (~line 3425), pass the resolution:

```ts
const { width: targetW, height: targetH } = getExportViewportSize(
  this.settings.viewportRatio ?? "free",
  canvas.width,
  canvas.height,
  this.settings.resolution ?? "1080p",
);
```

### 4. Update ExportDialog UI

Transform the export dialog to show resolution options and estimated size:

**Resolution selector**: Three radio-style buttons (720p, 1080p default, 4K) in a row.

**Estimated size display**: Show estimated file size below the resolution selector. Formula:
```
bitrate = clamp(1_000_000, 4_000_000, (width * height) / (1920 * 1080) * 2_000_000)
estimatedBytes = bitrate * totalDuration / 8
```

Where `totalDuration` comes from AnimationEngine. Create the engine when the dialog opens to get the real duration, destroy it when the dialog closes.

**The dialog should show:**
1. Resolution selector row (720p / 1080p / 4K)
2. Estimated size text (e.g. "Estimated size: ~35 MB")
3. Export button

### 5. Bitrate scaling for 4K

The existing bitrate formula in WebCodecsExporter and MediaRecorderExporter already scales by pixel count — caps at 4 Mbps. That's fine for map animations. No encoder changes needed.

### 6. Warning for 4K

Show a small warning text when 4K is selected: "4K export may be slow on some devices"

## Files to Change

1. `src/types/index.ts` — Add `ExportResolution` type, add `resolution` field
2. `src/lib/viewportRatio.ts` — Update `getExportViewportSize` to accept resolution param
3. `src/engine/VideoExporter.ts` — Pass resolution through to `getExportViewportSize`
4. `src/components/editor/ExportDialog.tsx` — Resolution selector UI + estimated size

## Constraints

- Default resolution: 1080p (no behavior change for existing users)
- Tailwind CSS for styling (project uses shadcn/ui)
- Keep the dialog compact and clean
- The estimate doesn't need to be exact — within 2x is fine
- Must work with all aspect ratios (16:9, 9:16, 4:3, 1:1, free)
- "free" aspect ratio should scale proportionally to the target height
