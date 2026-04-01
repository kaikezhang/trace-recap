import type { AspectRatio, ExportResolution } from "@/types";

export interface ViewportDimensions {
  width: number;
  height: number;
}

const RESOLUTION_HEIGHTS: Record<ExportResolution, number> = {
  "720p": 720,
  "1080p": 1080,
  "4K": 2160,
};

export function parseViewportRatio(
  viewportRatio: AspectRatio,
): ViewportDimensions | null {
  if (viewportRatio === "free") {
    return null;
  }

  const [width, height] = viewportRatio.split(":").map(Number);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { width, height };
}

export function computeContainedViewportSize(
  availableWidth: number,
  availableHeight: number,
  viewportRatio: AspectRatio,
): ViewportDimensions | null {
  const ratio = parseViewportRatio(viewportRatio);
  if (!ratio || availableWidth <= 0 || availableHeight <= 0) {
    return null;
  }

  const aspectRatio = ratio.width / ratio.height;
  let targetWidth = Math.min(availableWidth, availableHeight * aspectRatio);
  let targetHeight = targetWidth / aspectRatio;

  if (targetHeight > availableHeight) {
    targetHeight = availableHeight;
    targetWidth = targetHeight * aspectRatio;
  }

  return {
    width: Math.round(targetWidth),
    height: Math.round(targetHeight),
  };
}

export function getExportViewportSize(
  viewportRatio: AspectRatio,
  canvasWidth: number,
  canvasHeight: number,
  resolution: ExportResolution = "1080p",
): ViewportDimensions {
  const ratio = parseViewportRatio(viewportRatio);
  if (!ratio) {
    const targetHeight = RESOLUTION_HEIGHTS[resolution];
    const scale = targetHeight / Math.max(canvasHeight, 1);
    return {
      width: Math.round(canvasWidth * scale),
      height: targetHeight,
    };
  }

  const exportHeight = RESOLUTION_HEIGHTS[resolution];
  const exportWidth = Math.round(exportHeight * (ratio.width / ratio.height));
  return { width: exportWidth, height: exportHeight };
}
