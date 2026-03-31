export type TransportMode =
  | "flight"
  | "car"
  | "train"
  | "bus"
  | "ferry"
  | "walk"
  | "bicycle";

export type TransportIconStyle = "solid" | "outline" | "soft";

/** Vehicle icon variant within a transport mode (e.g. "jet" for flight, "suv" for car) */
export type IconVariant = string;

export interface Photo {
  id: string;
  locationId: string;
  url: string;
  caption?: string;
  focalPoint?: { x: number; y: number }; // 0-1 range, default center (0.5, 0.5)
}

export interface Location {
  id: string;
  name: string;
  nameZh?: string; // Chinese name from geocoding
  coordinates: [number, number]; // [lng, lat]
  photos: Photo[];
  isWaypoint: boolean;
  photoLayout?: PhotoLayout;
}

export interface Segment {
  id: string;
  fromId: string;
  toId: string;
  transportMode: TransportMode;
  iconStyle: TransportIconStyle;
  iconVariant?: IconVariant;
  geometry: GeoJSON.LineString | null;
}

export type AnimationPhase =
  | "HOVER"
  | "ZOOM_OUT"
  | "FLY"
  | "ZOOM_IN"
  | "ARRIVE";

export interface PhaseTiming {
  phase: AnimationPhase;
  startTime: number;
  duration: number;
}

export interface SegmentTiming {
  segmentId: string;
  startTime: number;
  duration: number;
  phases: PhaseTiming[];
}

export interface AnimationGroup {
  segments: Segment[];
  fromLoc: Location;
  toLoc: Location;
  allLocations: Location[];
  mergedGeometry: GeoJSON.LineString | null;
}

export interface CameraState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
}

export type PlaybackState = "idle" | "playing" | "paused" | "exporting";

export type AspectRatio = "free" | "16:9" | "9:16" | "4:3" | "3:4" | "1:1";

export interface ExportSettings {
  fps: number;
  cityLabelSize?: number; // CSS font size in px (default 18)
  cityLabelLang?: "en" | "zh";
  viewportRatio?: AspectRatio;
  routeLabelSize?: number; // Route label font size in px (default 14)
  routeLabelBottomPercent?: number; // Route label bottom position % (default 15)
  photoAnimation?: PhotoAnimation;
  photoStyle?: PhotoStyle;
}

export type LayoutTemplate =
  | "grid"
  | "hero"
  | "masonry"
  | "filmstrip"
  | "scatter"
  | "polaroid"
  | "overlap"
  | "full"
  | "diagonal"
  | "rows"
  | "magazine";

export interface PhotoLayout {
  mode: "auto" | "manual";
  template?: LayoutTemplate;
  order?: string[];        // photo IDs in custom order
  layoutSeed?: number;     // random seed for layouts with randomness
  gap?: number;            // gap in px (0-20), default 8
  borderRadius?: number;   // border radius in px (0-20), default 8
  enterAnimation?: PhotoAnimation; // per-location enter animation, falls back to global default
  exitAnimation?: PhotoAnimation; // per-location exit animation, falls back to global default
  photoStyle?: PhotoStyle; // per-location photo style override (classic or kenburns)
  customProportions?: {
    rows?: number[];       // relative row heights (e.g. [2, 1] = first row 2x the second)
    cols?: number[];       // relative column widths
  };
}

export type PhotoAnimation = "scale" | "fade" | "slide" | "flip" | "scatter" | "typewriter" | "none";

export type PhotoStyle = "classic" | "kenburns";

export type MapStyle =
  | "light"
  | "dark"
  | "satellite"
  | "streets"
  | "outdoors"
  | "satellite-raw"
  | "navigation-day"
  | "navigation-night"
  | "standard"
  | "standard-satellite"
  | "monochrome"
  | "vintage"
  | "blueprint"
  | "pastel"
  | "midnight";

export type MapStyleCategory = "classic" | "navigation" | "creative";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  locationCount: number;
  /** First location name, used as subtitle in project list */
  previewLocations: string[];
}

export interface Project {
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
}
