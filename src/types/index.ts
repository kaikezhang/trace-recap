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

/** Supported local languages for city labels (code = Mapbox geocoding language param) */
export const SUPPORTED_LOCAL_LANGUAGES = [
  { code: "zh-Hans", mapboxField: "name_zh-Hans", label: "中文", fallbackFields: ["name_zh-Hant"] },
  { code: "ja", mapboxField: "name_ja", label: "日本語", fallbackFields: [] },
  { code: "ko", mapboxField: "name_ko", label: "한국어", fallbackFields: [] },
  { code: "es", mapboxField: "name_es", label: "Español", fallbackFields: [] },
  { code: "fr", mapboxField: "name_fr", label: "Français", fallbackFields: [] },
  { code: "de", mapboxField: "name_de", label: "Deutsch", fallbackFields: [] },
  { code: "pt", mapboxField: "name_pt", label: "Português", fallbackFields: [] },
  { code: "ru", mapboxField: "name_ru", label: "Русский", fallbackFields: [] },
  { code: "ar", mapboxField: "name_ar", label: "العربية", fallbackFields: [] },
  { code: "it", mapboxField: "name_it", label: "Italiano", fallbackFields: [] },
  { code: "vi", mapboxField: "name_vi", label: "Tiếng Việt", fallbackFields: [] },
  { code: "th", mapboxField: "name_th", label: "ไทย", fallbackFields: [] },
] as const;

export type LocalLanguageCode = (typeof SUPPORTED_LOCAL_LANGUAGES)[number]["code"];

export interface Location {
  id: string;
  name: string;
  nameLocal?: string; // Localized name from geocoding (user's chosen language)
  coordinates: [number, number]; // [lng, lat]
  photos: Photo[];
  isWaypoint: boolean;
  photoLayout?: PhotoLayout;
  chapterTitle?: string;      // User-editable chapter title (defaults to city name)
  chapterNote?: string;       // Optional one-line note/caption
  chapterDate?: string;       // Display date (e.g. "Mar 15-17")
  chapterEmoji?: string;      // Optional emoji stamp (e.g. "🏯" "🍜" "🎌")
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
export type ExportResolution = "720p" | "1080p" | "4K";

export interface ExportSettings {
  fps: number;
  resolution?: ExportResolution;
  speedMultiplier?: number;
  cityLabelSize?: number; // CSS font size in px (default 18)
  cityLabelLang?: "en" | "local";
  cityLabelTopPercent?: number; // City label top position % (default 5)
  viewportRatio?: AspectRatio;
  routeLabelSize?: number; // Route label font size in px (default 14)
  routeLabelBottomPercent?: number; // Route label bottom position % (default 15)
  photoAnimation?: PhotoAnimation;
  photoStyle?: PhotoStyle;
  photoFrameStyle?: PhotoFrameStyle;
}

export type LayoutTemplate =
  | "grid"
  | "collage"
  | "single"
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

export interface FreePhotoTransform {
  photoId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  caption?: {
    text?: string;
    offsetX: number;
    offsetY: number;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    bgColor?: string;
    rotation?: number;
  };
}

export interface PhotoLayout {
  mode: "auto" | "manual" | "free";
  template?: LayoutTemplate;
  order?: string[];        // photo IDs in custom order
  layoutSeed?: number;     // random seed for layouts with randomness
  gap?: number;            // gap in px (0-20), default 8
  borderRadius?: number;   // border radius in px (0-20), default 8
  enterAnimation?: PhotoAnimation; // per-location enter animation, falls back to global default
  exitAnimation?: PhotoAnimation; // per-location exit animation, falls back to global default
  photoStyle?: PhotoStyle; // per-location photo style override
  sceneTransition?: SceneTransition; // per-location scene transition override
  customProportions?: {
    rows?: number[];       // relative row heights (e.g. [2, 1] = first row 2x the second)
    cols?: number[];       // relative column widths
  };
  freeTransforms?: FreePhotoTransform[];
  captionFontFamily?: string;  // Font family for captions
  captionFontSize?: number;    // Font size in px (default 14)
}

export type PhotoAnimation = "scale" | "fade" | "slide" | "flip" | "scatter" | "typewriter" | "none";

export type PhotoStyle = "classic" | "kenburns" | "portal";

export type SceneTransition = "cut" | "dissolve" | "blur-dissolve" | "wipe";

export type AlbumStyle =
  | "vintage-leather"
  | "japanese-minimal"
  | "classic-hardcover"
  | "travel-scrapbook";

export type PhotoFrameStyle =
  | "polaroid"
  | "borderless"
  | "film-strip"
  | "classic-border"
  | "rounded-card";

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
