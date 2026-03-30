import type { AspectRatio } from "@/types";

export interface ViewportDimensions {
  width: number;
  height: number;
}

const EXPORT_HEIGHT = 1080;

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
  const targetHeight = targetWidth / aspectRatio;

  return {
    width: Math.round(targetWidth),
    height: Math.round(targetHeight),
  };
}

export function getExportViewportSize(
  viewportRatio: AspectRatio,
  canvasWidth: number,
  canvasHeight: number,
): ViewportDimensions {
  const ratio = parseViewportRatio(viewportRatio);
  if (!ratio) {
    return { width: canvasWidth, height: canvasHeight };
  }

  return {
    width: Math.round(EXPORT_HEIGHT * (ratio.width / ratio.height)),
    height: EXPORT_HEIGHT,
  };
}
