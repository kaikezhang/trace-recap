import type { PhotoAnimation, PhotoLayout } from "@/types";

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
