import { MAP_STYLES, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "./constants";
import type { MapStyle } from "@/types";

export function getMapStyle(style: MapStyle): string {
  return MAP_STYLES[style];
}

export function getDefaultMapOptions() {
  return {
    center: DEFAULT_MAP_CENTER as [number, number],
    zoom: DEFAULT_MAP_ZOOM,
    style: MAP_STYLES.light,
  };
}

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
