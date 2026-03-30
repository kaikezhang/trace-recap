import type { TransportIconStyle, TransportMode } from "@/types";

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
