export interface PortalHeroRect {
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
}

export interface PortalSatelliteLayout {
  index: number;
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
}

export interface PortalLayout {
  radius: number;
  ringRadius: number;
  ringWidth: number;
  glowOpacity: number;
  heroRect: PortalHeroRect;
  satellites: PortalSatelliteLayout[];
}

const PORTAL_OPEN_END = 0.42;
const PORTAL_CLOSE_START = 0.78;
const SATELLITE_START_PROGRESS = 0.6;
const SATELLITE_STAGGER_PROGRESS = 0.1;
const SATELLITE_SIZE = 48;
const PORTAL_ANGLES_DEG = [45, 135, 225, 315];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutBack(value: number): number {
  const t = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInCubic(value: number): number {
  const t = clamp01(value);
  return t * t * t;
}

function getSatelliteProgress(progress: number, index: number): number {
  const start = SATELLITE_START_PROGRESS + index * SATELLITE_STAGGER_PROGRESS;
  const normalized = clamp01((progress - start) / Math.max(0.14, 1 - start));
  return easeOutBack(normalized);
}

export function computePortalPhaseProgress(arrivePhaseProgress: number): number {
  const t = clamp01(arrivePhaseProgress);

  if (t <= PORTAL_OPEN_END) {
    return easeOutBack(t / PORTAL_OPEN_END);
  }

  if (t >= PORTAL_CLOSE_START) {
    return 1 - easeInCubic((t - PORTAL_CLOSE_START) / (1 - PORTAL_CLOSE_START));
  }

  return 1;
}

export function computePortalLayout<T>(
  photos: T[],
  containerW: number,
  containerH: number,
  originX: number,
  originY: number,
  progress: number,
): PortalLayout {
  const openProgress = clamp01(progress);
  const radius = Math.min(containerW, containerH) * 0.35 * openProgress;
  const heroRect: PortalHeroRect = {
    x: originX - radius,
    y: originY - radius,
    size: radius * 2,
    width: radius * 2,
    height: radius * 2,
  };
  const orbitRadius = radius + SATELLITE_SIZE * 0.85 + 10;
  const satellites = photos.slice(1, 5).map((_, index) => {
    const angle = (PORTAL_ANGLES_DEG[index] * Math.PI) / 180;
    const revealProgress = getSatelliteProgress(openProgress, index);
    return {
      index,
      x: originX + Math.cos(angle) * orbitRadius,
      y: originY + Math.sin(angle) * orbitRadius,
      size: SATELLITE_SIZE,
      width: SATELLITE_SIZE,
      height: SATELLITE_SIZE,
      scale: revealProgress,
      opacity: revealProgress,
    };
  });

  return {
    radius,
    ringRadius: radius,
    ringWidth: 3,
    glowOpacity: openProgress,
    heroRect,
    satellites,
  };
}
