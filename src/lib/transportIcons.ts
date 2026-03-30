import type { TransportIconStyle, TransportMode } from "@/types";

// 4 direction variants for static PNG icons (solid style)
export type IconDirection = "right" | "down" | "left" | "up";

/** Map a bearing (0°=N, 90°=E, …) to one of four cardinal directions for PNG icon selection */
export function bearingToDirection(bearing: number): IconDirection {
  const b = ((bearing % 360) + 360) % 360;
  if (b >= 315 || b < 45) return "up";
  if (b >= 45 && b < 135) return "right";
  if (b >= 135 && b < 225) return "down";
  return "left";
}

/** Returns true if the icon style uses static PNG icons (not Lottie) */
export function isSolidStyle(style: TransportIconStyle): boolean {
  return style === "solid";
}

/** Get the path to a directional PNG icon for the solid style */
export function getTransportIconPngPath(
  mode: TransportMode,
  direction: IconDirection,
): string {
  return `/icons/${mode}-${direction}.png`;
}

export const DEFAULT_TRANSPORT_ICON_STYLE: TransportIconStyle = "solid";

export const TRANSPORT_ICON_STYLES: Array<{
  id: TransportIconStyle;
  label: string;
  description: string;
}> = [
  {
    id: "solid",
    label: "Solid",
    description: "Filled badge with a white vehicle glyph.",
  },
  {
    id: "outline",
    label: "Outline",
    description: "White badge with a colored ring and glyph.",
  },
  {
    id: "soft",
    label: "Soft",
    description: "Tinted badge with a colored glyph.",
  },
];

export function resolveTransportIconStyle(
  style?: TransportIconStyle | null,
): TransportIconStyle {
  return style ?? DEFAULT_TRANSPORT_ICON_STYLE;
}

export function getTransportIconAssetKey(
  mode: TransportMode,
  style: TransportIconStyle,
): string {
  return `${mode}:${style}`;
}

export function getTransportIconAssetPath(
  mode: TransportMode,
  style: TransportIconStyle,
): string {
  return `/lottie/${mode}-${style}.json`;
}
