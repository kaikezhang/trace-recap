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
  coordinates: [number, number]; // [lng, lat]
  photos: Photo[];
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
}

export type MapStyle = "light" | "dark" | "satellite";

export interface Project {
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
}
