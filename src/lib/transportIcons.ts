import type { IconVariant, TransportIconStyle, TransportMode } from "@/types";

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
  variant?: IconVariant,
): string {
  const v = variant && variant !== getDefaultVariant(mode) ? variant : "";
  return v ? `${mode}:${v}:${style}` : `${mode}:${style}`;
}

export function getTransportIconAssetPath(
  mode: TransportMode,
  style: TransportIconStyle,
  variant?: IconVariant,
): string {
  const v = variant && variant !== getDefaultVariant(mode) ? variant : "";
  return v ? `/lottie/${mode}-${v}-${style}.json` : `/lottie/${mode}-${style}.json`;
}

/** Get the default variant ID for a transport mode */
export function getDefaultVariant(mode: TransportMode): string {
  return ICON_VARIANTS[mode][0].id;
}

/** Resolve variant to a valid value, falling back to the mode's default */
export function resolveIconVariant(
  mode: TransportMode,
  variant?: IconVariant | null,
): string {
  if (!variant) return getDefaultVariant(mode);
  const valid = ICON_VARIANTS[mode].some((v) => v.id === variant);
  return valid ? variant : getDefaultVariant(mode);
}

export interface IconVariantConfig {
  id: string;
  label: string;
  /** Short description shown in tooltip */
  description: string;
}

/** Available icon variants per transport mode */
export const ICON_VARIANTS: Record<TransportMode, IconVariantConfig[]> = {
  flight: [
    { id: "airplane", label: "Airplane", description: "Classic commercial airplane" },
    { id: "jet", label: "Jet", description: "Sleek private jet" },
    { id: "balloon", label: "Balloon", description: "Hot air balloon" },
  ],
  car: [
    { id: "sedan", label: "Sedan", description: "Standard sedan car" },
    { id: "suv", label: "SUV", description: "Sport utility vehicle" },
    { id: "sports", label: "Sports", description: "Low-profile sports car" },
  ],
  train: [
    { id: "bullet", label: "Bullet", description: "High-speed bullet train" },
    { id: "steam", label: "Steam", description: "Classic steam locomotive" },
    { id: "metro", label: "Metro", description: "Modern metro train" },
  ],
  bus: [
    { id: "city", label: "City", description: "Standard city bus" },
    { id: "coach", label: "Coach", description: "Long-distance coach" },
    { id: "double", label: "Double", description: "Double-decker bus" },
  ],
  ferry: [
    { id: "ship", label: "Ship", description: "Passenger ferry ship" },
    { id: "sailboat", label: "Sailboat", description: "Classic sailboat" },
    { id: "speedboat", label: "Speedboat", description: "Fast speedboat" },
  ],
  walk: [
    { id: "person", label: "Person", description: "Walking person" },
    { id: "hiker", label: "Hiker", description: "Hiker with backpack" },
    { id: "runner", label: "Runner", description: "Running person" },
  ],
  bicycle: [
    { id: "bike", label: "Bike", description: "Standard bicycle" },
    { id: "scooter", label: "Scooter", description: "Electric scooter" },
    { id: "motorcycle", label: "Motorcycle", description: "Motorcycle" },
  ],
};
