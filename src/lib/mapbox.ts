import { MAP_STYLES, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getMapStyleConfig } from "./constants";
import type { MapStyle } from "@/types";
import type mapboxgl from "mapbox-gl";

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

/**
 * Apply runtime paint overrides for custom styles (vintage, blueprint, etc.).
 * Call this after "style.load" fires.
 */
export function applyStyleOverrides(map: mapboxgl.Map, style: MapStyle): void {
  const config = getMapStyleConfig(style);
  if (config.overrides) {
    try {
      config.overrides(map);
    } catch {
      // Some layers may not support certain paint properties — swallow errors
    }
  }
}

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
