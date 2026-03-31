const PHOTO_OVERLAY_LABEL_SHIFT_RATIO = 0.15;
const MIN_CITY_LABEL_TOP_PERCENT = 2;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeCityLabelTopPercent(
  baseTopPercent: number,
  photoOverlayVisible: boolean,
  photoOverlayOpacity: number,
): number {
  if (!photoOverlayVisible || photoOverlayOpacity <= 0) {
    return baseTopPercent;
  }

  const shiftedTopPercent = Math.max(
    MIN_CITY_LABEL_TOP_PERCENT,
    baseTopPercent * PHOTO_OVERLAY_LABEL_SHIFT_RATIO,
  );
  const visibleProgress = clamp01(photoOverlayOpacity);
  const adjustedTopPercent =
    baseTopPercent + (shiftedTopPercent - baseTopPercent) * visibleProgress;

  return Math.max(MIN_CITY_LABEL_TOP_PERCENT, adjustedTopPercent);
}
