export type TransportMode =
  | "flight"
  | "car"
  | "train"
  | "bus"
  | "ferry"
  | "walk"
  | "bicycle";

export interface Photo {
  id: string;
  locationId: string;
  url: string;
  caption?: string;
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

export type AspectRatio = "16:9" | "9:16";

export interface ExportSettings {
  aspectRatio: AspectRatio;
  resolution: number; // height in pixels (720 or 1080)
  fps: number;
  cityLabelSize?: number; // CSS font size in px (default 18)
  cityLabelLang?: "en" | "zh";
}

export type LayoutTemplate = "grid" | "hero" | "masonry" | "filmstrip" | "scatter";

export interface PhotoLayout {
  mode: "auto" | "manual";
  template?: LayoutTemplate;
  order?: string[];        // photo IDs in custom order
  gap?: number;            // gap in px (0-20), default 8
  borderRadius?: number;   // border radius in px (0-20), default 8
}

export type MapStyle = "light" | "dark" | "satellite";

export interface Project {
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
}
