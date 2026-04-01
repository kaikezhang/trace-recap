import type { TransportMode, MapStyle, MapStyleCategory } from "@/types";
import type mapboxgl from "mapbox-gl";

export const PHASE_DURATIONS = {
  HOVER: 1.5,
  ARRIVE: 1.0,
  PHOTO_DISPLAY: 1.5,
} as const;

export const ZOOM_RANGE = {
  flyMin: 2,
  flyMax: 10,
  cityMin: 10,
  cityMax: 16,
} as const;

export const TARGET_DURATION = {
  min: 20,
  max: 180,  // Allow longer videos for big trips
} as const;

export const FPS = 30;
export const DEFAULT_CAPTION_BG_COLOR = "rgba(0,0,0,0.55)";
export const DEFAULT_CAPTION_FONT_FAMILY = "system-ui";

export const CAPTION_FONT_OPTIONS = [
  { value: "system-ui", label: "System UI" },
  { value: "\"Noto Sans SC\", sans-serif", label: "Noto Sans SC (思源黑体)" },
  { value: "\"Noto Serif SC\", serif", label: "Noto Serif SC (思源宋体)" },
  { value: "\"ZCOOL KuaiLe\", sans-serif", label: "ZCOOL KuaiLe (站酷快乐体)" },
  { value: "\"ZCOOL XiaoWei\", serif", label: "ZCOOL XiaoWei (站酷小薇体)" },
  { value: "\"Ma Shan Zheng\", cursive", label: "Ma Shan Zheng (马善政楷体)" },
  { value: "\"Liu Jian Mao Cao\", cursive", label: "Liu Jian Mao Cao (流坚毛草)" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "cursive", label: "Cursive" },
] as const;

export type CaptionFontFamily = (typeof CAPTION_FONT_OPTIONS)[number]["value"];

export const ALLOWED_CAPTION_FONTS: ReadonlyArray<CaptionFontFamily> =
  CAPTION_FONT_OPTIONS.map((option) => option.value);

export interface TransportModeConfig {
  id: TransportMode;
  label: string;
  directionsProfile: "driving" | "walking" | "cycling" | null;
}

export const TRANSPORT_MODES: TransportModeConfig[] = [
  { id: "flight", label: "Flight", directionsProfile: null },
  { id: "car", label: "Car", directionsProfile: "driving" },
  { id: "train", label: "Train", directionsProfile: "driving" },
  { id: "bus", label: "Bus", directionsProfile: "driving" },
  { id: "ferry", label: "Ferry", directionsProfile: null },
  { id: "walk", label: "Walk", directionsProfile: "walking" },
  { id: "bicycle", label: "Bicycle", directionsProfile: "cycling" },
];

export const MAP_STYLES: Record<MapStyle, string> = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  "satellite-raw": "mapbox://styles/mapbox/satellite-v9",
  "navigation-day": "mapbox://styles/mapbox/navigation-day-v1",
  "navigation-night": "mapbox://styles/mapbox/navigation-night-v1",
  standard: "mapbox://styles/mapbox/standard",
  "standard-satellite": "mapbox://styles/mapbox/standard-satellite",
  monochrome: "mapbox://styles/mapbox/light-v11",
  vintage: "mapbox://styles/mapbox/light-v11",
  blueprint: "mapbox://styles/mapbox/dark-v11",
  pastel: "mapbox://styles/mapbox/light-v11",
  midnight: "mapbox://styles/mapbox/dark-v11",
};

// ── Runtime paint override helpers for custom styles ──

/** Safely set a paint property — no-op if the layer doesn't exist */
function safePaint(map: mapboxgl.Map, layerId: string, prop: string, value: unknown) {
  if (map.getLayer(layerId)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setPaintProperty(layerId, prop as any, value);
  }
}

function overrideLayers(
  map: mapboxgl.Map,
  fn: (layer: mapboxgl.LayerSpecification) => void,
) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    fn(layer);
  }
}

function applyMonochromeOverrides(map: mapboxgl.Map) {
  overrideLayers(map, (layer) => {
    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#e8e8e8");
    } else if (layer.type === "line") {
      map.setPaintProperty(layer.id, "line-color", "#cccccc");
    } else if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", "#666666");
    }
  });
  safePaint(map, "background", "background-color", "#f5f5f5");
}

function applyVintageOverrides(map: mapboxgl.Map) {
  overrideLayers(map, (layer) => {
    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#f0e6d3");
    } else if (layer.type === "line") {
      map.setPaintProperty(layer.id, "line-color", "#c4a882");
    } else if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", "#6b4e2e");
    }
  });
  safePaint(map, "background", "background-color", "#f5ead6");
}

function applyBlueprintOverrides(map: mapboxgl.Map) {
  overrideLayers(map, (layer) => {
    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#1a2744");
    } else if (layer.type === "line") {
      map.setPaintProperty(layer.id, "line-color", "#4a7ab5");
    } else if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", "#8ab4e8");
    }
  });
  safePaint(map, "background", "background-color", "#0f1d36");
}

function applyPastelOverrides(map: mapboxgl.Map) {
  overrideLayers(map, (layer) => {
    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#e8dff0");
    } else if (layer.type === "line") {
      map.setPaintProperty(layer.id, "line-color", "#c5b8d4");
    } else if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", "#7d6e8a");
    }
  });
  safePaint(map, "background", "background-color", "#f3eef8");
}

function applyMidnightOverrides(map: mapboxgl.Map) {
  overrideLayers(map, (layer) => {
    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#1a1340");
    } else if (layer.type === "line") {
      map.setPaintProperty(layer.id, "line-color", "#3d2d7a");
    } else if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", "#a08dd6");
    }
  });
  safePaint(map, "background", "background-color", "#0e0a2e");
}

export interface MapStyleConfig {
  id: MapStyle;
  url: string;
  label: string;
  category: MapStyleCategory;
  /** Preview swatch color for the settings panel */
  swatch: string;
  /** Runtime paint overrides applied after style loads */
  overrides?: (map: mapboxgl.Map) => void;
}

export const MAP_STYLE_CONFIGS: MapStyleConfig[] = [
  // ── Classic ──
  { id: "light", url: MAP_STYLES.light, label: "Light", category: "classic", swatch: "#f0f0f0" },
  { id: "dark", url: MAP_STYLES.dark, label: "Dark", category: "classic", swatch: "#2c2c2c" },
  { id: "streets", url: MAP_STYLES.streets, label: "Streets", category: "classic", swatch: "#e8d9b0" },
  { id: "outdoors", url: MAP_STYLES.outdoors, label: "Outdoors", category: "classic", swatch: "#b5d5a7" },
  { id: "satellite", url: MAP_STYLES.satellite, label: "Satellite", category: "classic", swatch: "#2a4a2e" },
  { id: "satellite-raw", url: MAP_STYLES["satellite-raw"], label: "Satellite (Raw)", category: "classic", swatch: "#1a3a1e" },
  // ── Navigation ──
  { id: "navigation-day", url: MAP_STYLES["navigation-day"], label: "Nav Day", category: "navigation", swatch: "#d4e4f7" },
  { id: "navigation-night", url: MAP_STYLES["navigation-night"], label: "Nav Night", category: "navigation", swatch: "#1a2a40" },
  // ── Creative ──
  { id: "standard", url: MAP_STYLES.standard, label: "Standard", category: "creative", swatch: "#c8d8e8" },
  { id: "standard-satellite", url: MAP_STYLES["standard-satellite"], label: "Std Satellite", category: "creative", swatch: "#3a5a3e" },
  { id: "monochrome", url: MAP_STYLES.monochrome, label: "Monochrome", category: "creative", swatch: "#e8e8e8", overrides: applyMonochromeOverrides },
  { id: "vintage", url: MAP_STYLES.vintage, label: "Vintage", category: "creative", swatch: "#f0e6d3", overrides: applyVintageOverrides },
  { id: "blueprint", url: MAP_STYLES.blueprint, label: "Blueprint", category: "creative", swatch: "#1a2744", overrides: applyBlueprintOverrides },
  { id: "pastel", url: MAP_STYLES.pastel, label: "Pastel", category: "creative", swatch: "#e8dff0", overrides: applyPastelOverrides },
  { id: "midnight", url: MAP_STYLES.midnight, label: "Midnight", category: "creative", swatch: "#1a1340", overrides: applyMidnightOverrides },
];

/** Look up the config for a given map style */
export function getMapStyleConfig(style: MapStyle): MapStyleConfig {
  return MAP_STYLE_CONFIGS.find((c) => c.id === style)!;
}

/** Category labels for the settings panel */
export const MAP_STYLE_CATEGORY_LABELS: Record<MapStyleCategory, string> = {
  classic: "Classic",
  navigation: "Navigation",
  creative: "Creative",
};

export const DEFAULT_MAP_CENTER: [number, number] = [0, 20];
export const DEFAULT_MAP_ZOOM = 2;
