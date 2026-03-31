import type { PhotoAnimation, PhotoLayout, PhotoStyle } from "@/types";

export const PHOTO_ANIMATION_LABELS: Record<PhotoAnimation, string> = {
  scale: "Scale",
  fade: "Fade",
  slide: "Slide",
  flip: "Flip",
  scatter: "Scatter",
  typewriter: "Typewriter",
  none: "None",
};

export const PHOTO_EXIT_ANIMATION_LABELS: Record<PhotoAnimation, string> = {
  scale: "Shrink",
  fade: "Fade Out",
  slide: "Slide Out",
  flip: "Flip Away",
  scatter: "Scatter",
  typewriter: "Sequential",
  none: "None",
};

export function resolvePhotoAnimations(
  layout: PhotoLayout | undefined,
  fallback: PhotoAnimation,
): { enterAnimation: PhotoAnimation; exitAnimation: PhotoAnimation } {
  return {
    enterAnimation: layout?.enterAnimation ?? fallback,
    exitAnimation: layout?.exitAnimation ?? fallback,
  };
}

export function resolvePhotoStyle(
  layout: PhotoLayout | undefined,
  fallback: PhotoStyle,
): PhotoStyle {
  return layout?.photoStyle ?? fallback;
}

/** Duration of the Ken Burns zoom+pan effect in seconds (shared between preview & export). */
export const KEN_BURNS_DURATION_SEC = 3;

/**
 * Compute Ken Burns transform for a photo at a given progress (0-1).
 * Each photo gets a unique direction based on its index and focal point.
 * Returns scale and translate values for the slow zoom+pan effect.
 */
export function getKenBurnsTransform(
  progress: number,
  index: number,
  focalPoint: { x: number; y: number },
): { scale: number; translateX: number; translateY: number } {
  // Smooth easing for natural motion
  const t = progress;

  // Zoom: 1.0 → 1.18 over the duration
  const scale = 1.0 + t * 0.18;

  // Pan direction: alternate between zooming toward and away from focal point
  // Use index to vary direction so adjacent photos feel different
  const directions: [number, number][] = [
    [1, 1],   // toward bottom-right
    [-1, -1], // toward top-left
    [1, -1],  // toward bottom-left
    [-1, 1],  // toward top-right
  ];
  const [dx, dy] = directions[index % directions.length];

  // Pan magnitude: up to 4% of container size, biased by focal point offset from center
  const fpOffX = (focalPoint.x - 0.5) * 2; // -1 to 1
  const fpOffY = (focalPoint.y - 0.5) * 2;
  const panMax = 4; // percent

  const translateX = t * (dx * panMax + fpOffX * 1.5);
  const translateY = t * (dy * panMax + fpOffY * 1.5);

  return { scale, translateX, translateY };
}
