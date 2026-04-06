import type { Location, Segment, MapStyle } from "@/types";
import type {
  CloudProjectData,
  CloudLocation,
  CloudSegment,
  CloudPhotoRef,
} from "./types";

/** Convert local in-memory state → CloudProjectData (for push to Supabase) */
export function toCloudProjectData(
  locations: Location[],
  segments: Segment[],
  mapStyle: MapStyle,
  timingOverrides: Record<string, number>,
  name: string,
  photoAssetMap: Map<string, string>, // photoId → assetId (from IDB photoRefs)
): CloudProjectData {
  const cloudLocations: CloudLocation[] = locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    ...(loc.nameLocal ? { nameLocal: loc.nameLocal } : {}),
    coordinates: loc.coordinates,
    ...(loc.isWaypoint ? { isWaypoint: true } : {}),
    ...(loc.photos.length > 0
      ? {
          photoRefs: loc.photos
            .map((photo): CloudPhotoRef | null => {
              const assetId = photoAssetMap.get(photo.id);
              if (!assetId) return null;
              return {
                photoId: photo.id,
                assetId,
                ...(photo.caption ? { caption: photo.caption } : {}),
                ...(photo.focalPoint ? { focalPoint: photo.focalPoint } : {}),
              };
            })
            .filter((ref): ref is CloudPhotoRef => ref !== null),
        }
      : {}),
    ...(loc.photoLayout ? { photoLayout: loc.photoLayout } : {}),
    ...(loc.chapterTitle ? { chapterTitle: loc.chapterTitle } : {}),
    ...(loc.chapterNote ? { chapterNote: loc.chapterNote } : {}),
    ...(loc.chapterDate ? { chapterDate: loc.chapterDate } : {}),
    ...(loc.chapterEmoji ? { chapterEmoji: loc.chapterEmoji } : {}),
  }));

  const cloudSegments: CloudSegment[] = segments.map((seg) => ({
    id: seg.id,
    fromLocationId: seg.fromId,
    toLocationId: seg.toId,
    transportMode: seg.transportMode,
    ...(seg.iconStyle ? { iconStyle: seg.iconStyle } : {}),
    ...(seg.iconVariant ? { iconVariant: seg.iconVariant } : {}),
  }));

  return {
    schemaVersion: 2,
    name,
    locations: cloudLocations,
    segments: cloudSegments,
    ...(mapStyle ? { mapStyle } : {}),
    ...(Object.keys(timingOverrides).length > 0
      ? { timingOverrides }
      : {}),
  };
}

/** Convert CloudProjectData → local project state (for pull from Supabase) */
export function fromCloudProjectData(cloud: CloudProjectData): {
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
  timingOverrides: Record<string, number>;
  name: string;
} {
  const locations: Location[] = cloud.locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    nameLocal: loc.nameLocal,
    coordinates: loc.coordinates,
    isWaypoint: loc.isWaypoint ?? false,
    photos: (loc.photoRefs ?? []).map((ref) => ({
      id: ref.photoId,
      locationId: loc.id,
      url: "", // populated later by photo download
      caption: ref.caption,
      focalPoint: ref.focalPoint,
    })),
    photoLayout: loc.photoLayout,
    chapterTitle: loc.chapterTitle,
    chapterNote: loc.chapterNote,
    chapterDate: loc.chapterDate,
    chapterEmoji: loc.chapterEmoji,
  }));

  const segments: Segment[] = cloud.segments.map((seg) => ({
    id: seg.id,
    fromId: seg.fromLocationId,
    toId: seg.toLocationId,
    transportMode: seg.transportMode,
    iconStyle: seg.iconStyle ?? "solid",
    iconVariant: seg.iconVariant,
    geometry: null,
  }));

  return {
    locations,
    segments,
    mapStyle: cloud.mapStyle ?? "streets",
    timingOverrides: cloud.timingOverrides ?? {},
    name: cloud.name,
  };
}
