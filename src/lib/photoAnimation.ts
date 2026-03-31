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

// ── Bloom transforms ──

/** Duration of the bloom enter animation in seconds. */
export const BLOOM_ENTER_DURATION_SEC = 1.2;
/** Duration of the bloom exit (collapse) animation in seconds. */
export const BLOOM_EXIT_DURATION_SEC = 0.8;
/** Per-photo stagger delay in seconds for bloom. */
export const BLOOM_STAGGER_SEC = 0.1;

/**
 * Spring-like easing with overshoot for bloom spread.
 */
function bloomSpringEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.7) {
    const p = t / 0.7;
    return 1.05 * (1 - Math.pow(1 - p, 3));
  }
  const p = (t - 0.7) / 0.3;
  return 1.05 - 0.05 * (p * p * (3 - 2 * p));
}

/**
 * Compute bloom enter transform for a photo at a given progress (0-1).
 * Photos emerge from origin and fan outward to their final layout position target.
 */
export function getBloomTransform(
  progress: number,
  index: number,
  total: number,
  originX: number,
  originY: number,
  target: { x: number; y: number; w: number; h: number },
): { scale: number; translateX: number; translateY: number; opacity: number } {
  const staggerDelay = index * (BLOOM_STAGGER_SEC / BLOOM_ENTER_DURATION_SEC);
  const adjustedProgress = Math.max(0, Math.min(1, (progress - staggerDelay) / (1 - staggerDelay + 0.001)));
  const t = bloomSpringEase(adjustedProgress);

  const targetCX = target.x + target.w / 2;
  const targetCY = target.y + target.h / 2;

  const currentX = originX + (targetCX - originX) * t;
  const currentY = originY + (targetCY - originY) * t;

  const translateX = currentX - targetCX;
  const translateY = currentY - targetCY;

  const scale = 0.2 + 0.8 * t;
  const opacity = Math.min(1, adjustedProgress / 0.3);

  return { scale, translateX, translateY, opacity };
}

/**
 * Compute bloom exit (collapse) transform for a photo.
 */
export function getBloomExitTransform(
  progress: number,
  index: number,
  total: number,
  originX: number,
  originY: number,
  current: { x: number; y: number; w: number; h: number },
): { scale: number; translateX: number; translateY: number; opacity: number } {
  const reverseIndex = total - 1 - index;
  const staggerDelay = reverseIndex * (BLOOM_STAGGER_SEC / BLOOM_EXIT_DURATION_SEC);
  const adjustedProgress = Math.max(0, Math.min(1, (progress - staggerDelay) / (1 - staggerDelay + 0.001)));

  const t = adjustedProgress * adjustedProgress;

  const currentCX = current.x + current.w / 2;
  const currentCY = current.y + current.h / 2;

  const translateX = (originX - currentCX) * t;
  const translateY = (originY - currentCY) * t;

  const scale = 1.0 - 0.8 * t;
  const opacity = adjustedProgress < 0.7 ? 1 : 1 - (adjustedProgress - 0.7) / 0.3;

  return { scale, translateX, translateY, opacity };
}

/**
 * Compute radial fan layout for bloom style (1-5 photos).
 * Photos spread outward from the origin at even angular intervals, like a hand of cards.
 * Returns rects as fractions (0-1) of the container.
 */
export function computeBloomFanLayout(
  originFracX: number,
  originFracY: number,
  photos: Array<{ aspect: number }>,
  containerW: number,
  containerH: number,
): Array<{ x: number; y: number; width: number; height: number; rotation?: number }> {
  const n = photos.length;
  if (n === 0) return [];

  // Fan radius: ~30% of container height
  const radius = containerH * 0.3;
  // Photo size: scale based on count
  const photoSize = Math.min(containerW, containerH) * (n <= 2 ? 0.25 : n <= 3 ? 0.22 : 0.18);

  const originPxX = originFracX * containerW;
  const originPxY = originFracY * containerH;

  // Fan arc: centered on "up" direction (-PI/2)
  const arcSpan = n === 1 ? 0 : Math.min(Math.PI * 0.8, (n - 1) * Math.PI / 6);
  const startAngle = -Math.PI / 2 - arcSpan / 2;

  return photos.map((photo, i) => {
    const angle = n === 1 ? -Math.PI / 2 : startAngle + (i / (n - 1)) * arcSpan;
    let cx = originPxX + Math.cos(angle) * radius;
    let cy = originPxY + Math.sin(angle) * radius;

    // Size based on aspect ratio
    const w = photo.aspect >= 1 ? photoSize : photoSize * photo.aspect;
    const h = photo.aspect >= 1 ? photoSize / photo.aspect : photoSize;

    // Clamp to container bounds
    cx = Math.max(w / 2, Math.min(containerW - w / 2, cx));
    cy = Math.max(h / 2, Math.min(containerH - h / 2, cy));

    return {
      x: (cx - w / 2) / containerW,
      y: (cy - h / 2) / containerH,
      width: w / containerW,
      height: h / containerH,
    };
  });
}
