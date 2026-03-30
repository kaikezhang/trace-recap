import type { AspectRatio } from "@/types";

export interface ViewportDimensions {
  width: number;
  height: number;
}

const EXPORT_HEIGHT_CANDIDATES = [1080, 720] as const;

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
): ViewportDimensions {
  const ratio = parseViewportRatio(viewportRatio);
  if (!ratio) {
    return { width: canvasWidth, height: canvasHeight };
  }

  for (const exportHeight of EXPORT_HEIGHT_CANDIDATES) {
    const exportWidth = Math.round(exportHeight * (ratio.width / ratio.height));
    if (Number.isFinite(exportWidth) && exportWidth > 0) {
      return {
        width: exportWidth,
        height: exportHeight,
      };
    }
  }

  return { width: canvasWidth, height: canvasHeight };
}
