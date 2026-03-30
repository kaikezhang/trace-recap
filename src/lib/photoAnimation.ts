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

export function resolvePhotoAnimations(
  layout: PhotoLayout | undefined,
  fallback: PhotoAnimation,
): { enterAnimation: PhotoAnimation; exitAnimation: PhotoAnimation } {
  return {
    enterAnimation: layout?.enterAnimation ?? fallback,
    exitAnimation: layout?.exitAnimation ?? fallback,
  };
}
