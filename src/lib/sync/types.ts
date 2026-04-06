import type {
  TransportMode,
  TransportIconStyle,
  PhotoLayout,
  MapStyle,
} from "@/types";

/** What gets synced to Supabase project_data.data JSONB — project content only */
export interface CloudProjectData {
  schemaVersion: 2;
  name: string;
  locations: CloudLocation[];
  segments: CloudSegment[];
  mapStyle?: MapStyle;
  timingOverrides?: Record<string, number>;
  // NO RouteUISettings — UI prefs stay local
}

export interface CloudLocation {
  id: string;
  name: string;
  nameLocal?: string;
  coordinates: [number, number];
  isWaypoint?: boolean;
  photoRefs?: CloudPhotoRef[];
  photoLayout?: PhotoLayout;
  chapterTitle?: string;
  chapterNote?: string;
  chapterDate?: string;
  chapterEmoji?: string;
}

export interface CloudPhotoRef {
  photoId: string;
  assetId: string;
  caption?: string;
  focalPoint?: { x: number; y: number };
}

export interface CloudSegment {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  transportMode: TransportMode;
  iconStyle?: TransportIconStyle;
  iconVariant?: string;
}
