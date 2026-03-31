import type { PhotoLayout, SceneTransition } from "@/types";

/**
 * Resolve the effective scene transition for a location.
 * Per-location override takes precedence over global default.
 */
export function resolveSceneTransition(
  layout: PhotoLayout | undefined,
  globalDefault: SceneTransition,
): SceneTransition {
  return layout?.sceneTransition ?? globalDefault;
}

/** Smooth easeInOut curve (cubic) */
function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Compute dissolve opacities for outgoing and incoming photo sets.
 * @param progress 0 = fully outgoing, 1 = fully incoming
 */
export function computeDissolveOpacity(progress: number): {
  outgoing: number;
  incoming: number;
} {
  const t = easeInOut(Math.max(0, Math.min(1, progress)));
  return {
    outgoing: 1 - t,
    incoming: t,
  };
}

/**
 * Compute blur-dissolve values: dissolve + gaussian blur that peaks mid-transition.
 * @param progress 0 = fully outgoing, 1 = fully incoming
 */
export function computeBlurDissolve(progress: number): {
  outgoing: number;
  incoming: number;
  blur: number;
} {
  const clamped = Math.max(0, Math.min(1, progress));
  const t = easeInOut(clamped);
  // Blur peaks at 50% progress (bell curve shape)
  const blur = 8 * Math.sin(clamped * Math.PI);
  return {
    outgoing: 1 - t,
    incoming: t,
    blur,
  };
}

/**
 * Compute wipe progress for a directional wipe following travel direction.
 * @param progress 0 = fully outgoing, 1 = fully incoming
 * @param bearing travel direction in degrees (0 = north, 90 = east, etc.)
 * Returns clip fraction (0-1) for the wipe edge position, plus the bearing for directional rendering.
 */
export function computeWipeProgress(
  progress: number,
  bearing: number,
): {
  /** Wipe edge position 0-1 (0 = no wipe, 1 = fully wiped) */
  wipePosition: number;
  /** Bearing in degrees for the wipe direction */
  bearing: number;
} {
  const t = easeInOut(Math.max(0, Math.min(1, progress)));
  return {
    wipePosition: t,
    bearing,
  };
}

/** Scene transition labels for UI display */
export const SCENE_TRANSITION_LABELS: Record<SceneTransition, string> = {
  cut: "Cut",
  dissolve: "Dissolve",
  "blur-dissolve": "Blur Dissolve",
  wipe: "Wipe",
};
