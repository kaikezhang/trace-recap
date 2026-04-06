import { create } from "zustand";
import { useUIStore } from "@/stores/uiStore";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import type {
  AspectRatio,
  AlbumStyle,
  PhotoAnimation,
  PhotoFrameStyle,
  PhotoStyle,
  SceneTransition,
  Location,
  Segment,
  Photo,
  PhotoLayout,
  TransportMode,
  TransportIconStyle,
  IconVariant,
  MapStyle,
  ProjectMeta,
} from "@/types";
import {
  DEFAULT_TRANSPORT_ICON_STYLE,
  resolveTransportIconStyle,
} from "@/lib/transportIcons";
import { useHistoryStore, registerPhotoUrl, registerPhotoUrls } from "./historyStore";
import {
  saveProject,
  getProjectData,
  getProjectMeta,
  listProjects as listProjectsFromDB,
  deleteProject as deleteProjectFromDB,
  renameProject as renameProjectInDB,
  duplicateProject as duplicateProjectInDB,
  migrateFromLocalStorage,
  putProjectData,
} from "@/lib/storage";
import {
  compressBlobUrl,
  compressDataUrl,
  getImageDimensions,
  isImageOversized,
} from "@/lib/imageUtils";
import { ALLOWED_CAPTION_FONTS } from "@/lib/constants";

export interface RouteUISettings {
  viewportRatio?: AspectRatio;
  speedMultiplier?: number;
  cityLabelLang?: "en" | "local" | "zh";
  cityLabelSize?: number;
  cityLabelTopPercent?: number;
  routeLabelSize?: number;
  routeLabelBottomPercent?: number;
  photoAnimation?: PhotoAnimation;
  photoStyle?: PhotoStyle;
  photoFrameStyle?: PhotoFrameStyle;
  sceneTransition?: SceneTransition;
  albumStyle?: AlbumStyle;
  albumCaptionsEnabled?: boolean;
  moodColorsEnabled?: boolean;
  chapterPinsEnabled?: boolean;
  breadcrumbsEnabled?: boolean;
  tripStatsEnabled?: boolean;
}

export interface ImportRouteData extends RouteUISettings {
  name: string;
  locations: {
    id?: string;
    name: string;
    nameLocal?: string;
    coordinates: [number, number];
    isWaypoint?: boolean;
    photos?: {
      id?: string;
      url: string;
      caption?: string;
      focalPoint?: { x: number; y: number };
    }[];
    photoLayout?: PhotoLayout;
    chapterTitle?: string;
    chapterNote?: string;
    chapterDate?: string;
    chapterEmoji?: string;
  }[];
  segments: {
    id?: string;
    fromIndex: number;
    toIndex: number;
    transportMode: TransportMode;
    iconStyle?: TransportIconStyle;
    iconVariant?: IconVariant;
  }[];
  timingOverrides?: Record<string, number>;
  mapStyle?: MapStyle;
}

type PersistedProjectData = ImportRouteData;
type SerializedLocation = PersistedProjectData["locations"][number];

const DEFAULT_ROUTE_NAME = "My Trip";
const DEFAULT_MAP_STYLE: MapStyle = "light";
const PROJECT_SAVE_DEBOUNCE_MS = 2000; // 2 seconds — prevents heavy serialization during rapid slider drags
function serializeFreeTransforms(
  photoLayout: PhotoLayout | undefined,
  photos: Location["photos"],
): PhotoLayout["freeTransforms"] | undefined {
  if (!photoLayout?.freeTransforms) {
    return undefined;
  }

  return photoLayout.freeTransforms.reduce<NonNullable<PhotoLayout["freeTransforms"]>>((acc, transform, index) => {
      const photoIndex = photos.findIndex((photo) => photo.id === transform.photoId);
      if (photoIndex < 0) {
        return acc;
      }

      acc.push({
        ...transform,
        photoId: String(photoIndex),
        zIndex: Number.isFinite(transform.zIndex) ? transform.zIndex : index,
      });
      return acc;
    }, []);
}

function deserializeFreeTransforms(
  rawLayout: Record<string, unknown>,
  photos: Location["photos"],
): PhotoLayout["freeTransforms"] | undefined {
  if (!Array.isArray(rawLayout.freeTransforms)) {
    return undefined;
  }

  return rawLayout.freeTransforms.reduce<NonNullable<PhotoLayout["freeTransforms"]>>((acc, value, index) => {
      if (!value || typeof value !== "object") {
        return acc;
      }

      const transform = value as Record<string, unknown>;
      const photoIndex = Number.parseInt(String(transform.photoId), 10);
      const photoId = Number.isInteger(photoIndex) && photoIndex >= 0 && photoIndex < photos.length
        ? photos[photoIndex]?.id
        : null;

      if (
        !photoId ||
        typeof transform.x !== "number" ||
        typeof transform.y !== "number" ||
        typeof transform.width !== "number" ||
        typeof transform.height !== "number"
      ) {
        return acc;
      }

      const rawCaption = transform.caption;
      const caption = rawCaption && typeof rawCaption === "object"
        ? {
            offsetX: typeof (rawCaption as Record<string, unknown>).offsetX === "number"
              ? (rawCaption as Record<string, unknown>).offsetX as number
              : 0,
            offsetY: typeof (rawCaption as Record<string, unknown>).offsetY === "number"
              ? (rawCaption as Record<string, unknown>).offsetY as number
              : 0,
            text: typeof (rawCaption as Record<string, unknown>).text === "string"
              ? (rawCaption as Record<string, unknown>).text as string
              : undefined,
            fontFamily: typeof (rawCaption as Record<string, unknown>).fontFamily === "string" &&
              ALLOWED_CAPTION_FONTS.includes((rawCaption as Record<string, unknown>).fontFamily as typeof ALLOWED_CAPTION_FONTS[number])
              ? (rawCaption as Record<string, unknown>).fontFamily as typeof ALLOWED_CAPTION_FONTS[number]
              : undefined,
            fontSize: typeof (rawCaption as Record<string, unknown>).fontSize === "number"
              ? Math.max(8, Math.min(72, (rawCaption as Record<string, unknown>).fontSize as number))
              : undefined,
            color: typeof (rawCaption as Record<string, unknown>).color === "string"
              ? (rawCaption as Record<string, unknown>).color as string
              : undefined,
            bgColor: typeof (rawCaption as Record<string, unknown>).bgColor === "string"
              ? (rawCaption as Record<string, unknown>).bgColor as string
              : undefined,
            rotation: typeof (rawCaption as Record<string, unknown>).rotation === "number"
              ? (rawCaption as Record<string, unknown>).rotation as number
              : undefined,
          }
        : undefined;

      acc.push({
        photoId,
        x: transform.x,
        y: transform.y,
        width: transform.width,
        height: transform.height,
        rotation: typeof transform.rotation === "number" ? transform.rotation : 0,
        zIndex: typeof transform.zIndex === "number" ? transform.zIndex : index,
        ...(caption ? { caption } : {}),
      });
      return acc;
    }, []);
}

interface ProjectState {
  // Multi-project state
  currentProjectId: string | null;
  currentProjectName: string;
  projects: ProjectMeta[];
  isSwitchingProject: boolean;

  // Current project data
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
  segmentTimingOverrides: Record<string, number>;
  segmentColors: Record<number, string>; // segmentIndex → hex color

  // Location CRUD
  addLocation: (
    location: Omit<Location, "id" | "photos" | "isWaypoint">,
  ) => void;
  addLocationAtCoordinates: (
    lngLat: { lng: number; lat: number },
    options?: { isWaypoint?: boolean; insertIndex?: number },
  ) => Promise<void>;
  duplicateLocation: (locationId: string) => void;
  removeLocation: (id: string) => void;
  batchRemoveLocations: (ids: string[]) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;
  updateLocation: (
    id: string,
    updates: Partial<Pick<Location, "name" | "nameLocal" | "coordinates" | "chapterTitle" | "chapterNote" | "chapterDate" | "chapterEmoji">>,
  ) => void;
  toggleWaypoint: (locationId: string) => void;
  batchToggleWaypoint: (ids: string[]) => void;

  // Segment operations
  setTransportMode: (segmentId: string, mode: TransportMode) => void;
  setSegmentIconStyle: (
    segmentId: string,
    iconStyle: TransportIconStyle,
  ) => void;
  setSegmentIconVariant: (
    segmentId: string,
    variant: IconVariant,
  ) => void;
  setSegmentGeometry: (segmentId: string, geometry: GeoJSON.LineString) => void;
  setSegmentTiming: (segmentId: string, duration: number | null) => void;
  clearAllTimingOverrides: () => void;
  setSegmentColor: (index: number, color: string) => void;
  clearSegmentColors: () => void;

  // Photo operations
  addPhoto: (
    locationId: string,
    photo: Omit<Photo, "id" | "locationId">,
  ) => string;
  removePhoto: (locationId: string, photoId: string) => void;
  setPhotoLayout: (locationId: string, layout: PhotoLayout) => void;
  setPhotoFocalPoint: (
    locationId: string,
    photoId: string,
    point: { x: number; y: number },
  ) => void;
  setPhotoCaption: (
    locationId: string,
    photoId: string,
    caption: string,
  ) => void;

  // Project operations
  setMapStyle: (style: MapStyle) => void;
  clearRoute: () => void;
  importRoute: (data: ImportRouteData) => void;
  loadRouteData: (data: ImportRouteData) => Promise<void>;
  regenerateSegmentGeometries: () => Promise<void>;
  restorePersistedProject: () => Promise<void>;
  enrichLocalNames: (force?: boolean) => Promise<void>;
  exportRoute: () => Promise<ImportRouteData>;

  // Multi-project operations
  createNewProject: (name?: string) => Promise<string>;
  switchProject: (projectId: string) => Promise<void>;
  deleteCurrentProject: () => Promise<void>;
  deleteProjectById: (projectId: string) => Promise<void>;
  renameCurrentProject: (name: string) => Promise<void>;
  renameProjectById: (projectId: string, name: string) => Promise<void>;
  duplicateProjectById: (projectId: string) => Promise<ProjectMeta | null>;
  refreshProjectList: () => Promise<void>;
}

let nextId = 1;
let persistTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceInitialized = false;
let skipNextPersist = false;
let persistSuspended = false;
let lastSavedProjectJson = "";
let diffCheckDisabled = false;

function tryUpdateLastSavedJson(data: unknown): void {
  if (diffCheckDisabled) return;
  try {
    lastSavedProjectJson = JSON.stringify(data);
  } catch {
    diffCheckDisabled = true;
    lastSavedProjectJson = "";
  }
}
let saveCommitChain: Promise<void> = Promise.resolve();
const projectSaveVersions = new Map<string, number>();
let activeLoadCompressionJob = 0;

async function runBackgroundPhotoCompression(): Promise<void> {
  if (!isBrowser()) return;

  const loadCompressionJob = ++activeLoadCompressionJob;
  const projectId = useProjectStore.getState().currentProjectId;
  if (!projectId) return;

  const importedLocations = useProjectStore.getState().locations;
  let totalPhotos = 0;
  let skippedType = 0;
  let skippedSize = 0;
  let compressed = 0;
  let failed = 0;

  for (const loc of importedLocations) {
    totalPhotos += loc.photos.length;
  }
  console.log(`[compress] Starting compression check: ${totalPhotos} photos across ${importedLocations.length} locations`);

  for (const location of importedLocations) {
    for (const photo of location.photos) {
      try {
        const isData = photo.url.startsWith("data:");
        const isBlob = photo.url.startsWith("blob:");
        if (!isData && !isBlob) {
          skippedType++;
          continue;
        }
        if (loadCompressionJob !== activeLoadCompressionJob) {
          console.log(`[compress] Aborted — load job changed`);
          return;
        }

        const dimensions = await getImageDimensions(photo.url);
        if (!dimensions || !isImageOversized(dimensions)) {
          skippedSize++;
          console.log(`[compress] Skip ${photo.id}: ${dimensions?.width}x${dimensions?.height} (not oversized)`);
          continue;
        }

        console.log(`[compress] Compressing ${photo.id}: ${dimensions.width}x${dimensions.height} (${isBlob ? "blob" : "data"} URL)`);
        const compressedBlob = isData
          ? await compressDataUrl(photo.url)
          : await compressBlobUrl(photo.url);
        const compressedUrl = URL.createObjectURL(compressedBlob);
        console.log(`[compress] Compressed ${photo.id}: ${(compressedBlob.size / 1024 / 1024).toFixed(1)}MB`);

        if (loadCompressionJob !== activeLoadCompressionJob) {
          URL.revokeObjectURL(compressedUrl);
          return;
        }

        const currentState = useProjectStore.getState();
        const currentLocation = currentState.locations.find(
          (entry) => entry.id === location.id,
        );
        const currentPhoto = currentLocation?.photos.find(
          (entry) => entry.id === photo.id,
        );

        if (
          currentState.currentProjectId !== projectId ||
          !currentPhoto ||
          currentPhoto.url !== photo.url
        ) {
          URL.revokeObjectURL(compressedUrl);
          continue;
        }

        markLocationDirty(location.id);

        let didUpdate = false;
        useProjectStore.setState((state) => {
          const locations = state.locations.map((entry) => {
            if (entry.id !== location.id) {
              return entry;
            }

            const photos = entry.photos.map((item) => {
              if (item.id === photo.id && item.url === photo.url) {
                didUpdate = true;
                return { ...item, url: compressedUrl };
              }
              return item;
            });

            return didUpdate ? { ...entry, photos } : entry;
          });

          return didUpdate ? { locations } : state;
        });

        if (didUpdate && isBlob) {
          URL.revokeObjectURL(photo.url);
        }
        if (!didUpdate) {
          URL.revokeObjectURL(compressedUrl);
          console.log(`[compress] ${photo.id}: URL changed during compression, discarded`);
        } else {
          compressed++;
          // Update the URL registry so undo/redo uses the compressed version
          registerPhotoUrl(photo.id, compressedUrl);
          console.log(`[compress] ✅ ${photo.id} replaced`);
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });
      } catch (error) {
        failed++;
        console.error(
          `[compress] ❌ Failed to compress photo ${photo.id}.`,
          error,
        );
      }
    }
  }
  console.log(`[compress] Done! ${compressed} compressed, ${skippedType} skipped (url type), ${skippedSize} skipped (small enough), ${failed} failed, ${totalPhotos} total`);
}

const VALID_TRANSPORT_MODES: TransportMode[] = [
  "flight",
  "car",
  "train",
  "bus",
  "ferry",
  "walk",
  "bicycle",
];
const VALID_VIEWPORT_RATIOS: AspectRatio[] = ["free", "16:9", "9:16", "4:3", "3:4", "1:1"];
const VALID_PHOTO_ANIMATIONS: PhotoAnimation[] = ["scale", "fade", "slide", "flip", "scatter", "typewriter", "none"];
const VALID_PHOTO_STYLES: PhotoStyle[] = ["classic", "kenburns", "portal"];
const VALID_PHOTO_FRAME_STYLES: PhotoFrameStyle[] = ["polaroid", "borderless", "film-strip", "classic-border", "rounded-card"];
const VALID_SCENE_TRANSITIONS: SceneTransition[] = ["cut", "dissolve", "blur-dissolve", "wipe"];
const VALID_ALBUM_STYLES: AlbumStyle[] = ["vintage-leather", "japanese-minimal", "classic-hardcover", "travel-scrapbook"];
const MIN_SPEED_MULTIPLIER = 0.5;
const MAX_SPEED_MULTIPLIER = 2;

function normalizeSpeedMultiplier(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(
    MAX_SPEED_MULTIPLIER,
    Math.max(MIN_SPEED_MULTIPLIER, Math.round(value * 10) / 10),
  );
}

const generateId = () => String(nextId++);

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Cache for blob→dataURL conversions to avoid redundant work on repeated saves */
const blobToDataUrlCache = new Map<string, string>();

/**
 * Dirty tracking for incremental serialization.
 * Only locations whose photos changed need re-serialization (the expensive blob→dataURL step).
 * Non-photo changes (name, coordinates, waypoint) are cheap to serialize.
 */
const dirtyLocationIds = new Set<string>();
const serializedLocationCache = new Map<string, SerializedLocation>();

function markLocationDirty(locationId: string): void {
  dirtyLocationIds.add(locationId);
  serializedLocationCache.delete(locationId);
  locationDirtyVersion.set(locationId, (locationDirtyVersion.get(locationId) ?? 0) + 1);
}

function clearDirtyTracking(): void {
  dirtyLocationIds.clear();
  serializedLocationCache.clear();
  locationDirtyVersion.clear();
}

function cancelPendingPersist(): void {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
    persistTimeout = null;
  }
}

function createEmptyProjectData(name = DEFAULT_ROUTE_NAME): ImportRouteData {
  return {
    name,
    locations: [],
    segments: [],
    mapStyle: DEFAULT_MAP_STYLE,
    ...collectRouteUISettings(),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidCoordinates(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteCoordinate(value[0]) &&
    isFiniteCoordinate(value[1])
  );
}

function collectRouteUISettings(): RouteUISettings {
  const uiState = useUIStore.getState();
  return {
    viewportRatio: uiState.viewportRatio,
    speedMultiplier: uiState.speedMultiplier,
    cityLabelLang: uiState.cityLabelLang,
    cityLabelSize: uiState.cityLabelSize,
    cityLabelTopPercent: uiState.cityLabelTopPercent,
    routeLabelSize: uiState.routeLabelSize,
    routeLabelBottomPercent: uiState.routeLabelBottomPercent,
    photoAnimation: uiState.photoAnimation,
    photoStyle: uiState.photoStyle,
    photoFrameStyle: uiState.photoFrameStyle,
    sceneTransition: uiState.sceneTransition,
    albumStyle: uiState.albumStyle,
    albumCaptionsEnabled: uiState.albumCaptionsEnabled,
    moodColorsEnabled: uiState.moodColorsEnabled,
    chapterPinsEnabled: uiState.chapterPinsEnabled,
    breadcrumbsEnabled: uiState.breadcrumbsEnabled,
    tripStatsEnabled: uiState.tripStatsEnabled,
  };
}

function parseImportedUISettings(data: ImportRouteData): RouteUISettings {
  const speedMultiplier = normalizeSpeedMultiplier(data.speedMultiplier);

  return {
    ...(VALID_VIEWPORT_RATIOS.includes(data.viewportRatio as AspectRatio)
      ? { viewportRatio: data.viewportRatio }
      : {}),
    ...(speedMultiplier !== undefined ? { speedMultiplier } : {}),
    ...(data.cityLabelLang === "en" || data.cityLabelLang === "local" || data.cityLabelLang === "zh"
      ? { cityLabelLang: data.cityLabelLang === "zh" ? "local" : data.cityLabelLang }
      : {}),
    ...(typeof data.cityLabelSize === "number" && Number.isFinite(data.cityLabelSize)
      ? { cityLabelSize: data.cityLabelSize }
      : {}),
    ...(typeof data.cityLabelTopPercent === "number" && Number.isFinite(data.cityLabelTopPercent)
      ? { cityLabelTopPercent: data.cityLabelTopPercent }
      : {}),
    ...(typeof data.routeLabelSize === "number" && Number.isFinite(data.routeLabelSize)
      ? { routeLabelSize: data.routeLabelSize }
      : {}),
    ...(typeof data.routeLabelBottomPercent === "number" && Number.isFinite(data.routeLabelBottomPercent)
      ? { routeLabelBottomPercent: data.routeLabelBottomPercent }
      : {}),
    ...(VALID_PHOTO_ANIMATIONS.includes(data.photoAnimation as PhotoAnimation)
      ? { photoAnimation: data.photoAnimation }
      : {}),
    ...(VALID_PHOTO_STYLES.includes(data.photoStyle as PhotoStyle)
      ? { photoStyle: data.photoStyle }
      : {}),
    ...(VALID_PHOTO_FRAME_STYLES.includes(data.photoFrameStyle as PhotoFrameStyle)
      ? { photoFrameStyle: data.photoFrameStyle }
      : {}),
    ...(VALID_SCENE_TRANSITIONS.includes(data.sceneTransition as SceneTransition)
      ? { sceneTransition: data.sceneTransition }
      : {}),
    ...(VALID_ALBUM_STYLES.includes(data.albumStyle as AlbumStyle)
      ? { albumStyle: data.albumStyle }
      : {}),
    ...(typeof data.albumCaptionsEnabled === "boolean"
      ? { albumCaptionsEnabled: data.albumCaptionsEnabled }
      : {}),
    ...(typeof data.moodColorsEnabled === "boolean"
      ? { moodColorsEnabled: data.moodColorsEnabled }
      : {}),
    ...(typeof data.chapterPinsEnabled === "boolean"
      ? { chapterPinsEnabled: data.chapterPinsEnabled }
      : {}),
    ...(typeof data.breadcrumbsEnabled === "boolean"
      ? { breadcrumbsEnabled: data.breadcrumbsEnabled }
      : {}),
    ...(typeof data.tripStatsEnabled === "boolean"
      ? { tripStatsEnabled: data.tripStatsEnabled }
      : {}),
  };
}

function applyImportedUISettings(uiSettings: RouteUISettings): void {
  const nextState: Partial<ReturnType<typeof useUIStore.getState>> = {};

  if (uiSettings.viewportRatio !== undefined) nextState.viewportRatio = uiSettings.viewportRatio;
  if (uiSettings.speedMultiplier !== undefined) nextState.speedMultiplier = uiSettings.speedMultiplier;
  if (uiSettings.cityLabelLang !== undefined) nextState.cityLabelLang = uiSettings.cityLabelLang === "zh" ? "local" : uiSettings.cityLabelLang;
  if (uiSettings.cityLabelSize !== undefined) nextState.cityLabelSize = uiSettings.cityLabelSize;
  if (uiSettings.cityLabelTopPercent !== undefined) nextState.cityLabelTopPercent = uiSettings.cityLabelTopPercent;
  if (uiSettings.routeLabelSize !== undefined) nextState.routeLabelSize = uiSettings.routeLabelSize;
  if (uiSettings.routeLabelBottomPercent !== undefined) nextState.routeLabelBottomPercent = uiSettings.routeLabelBottomPercent;
  if (uiSettings.photoAnimation !== undefined) nextState.photoAnimation = uiSettings.photoAnimation;
  if (uiSettings.photoStyle !== undefined) nextState.photoStyle = uiSettings.photoStyle;
  if (uiSettings.photoFrameStyle !== undefined) nextState.photoFrameStyle = uiSettings.photoFrameStyle;
  if (uiSettings.sceneTransition !== undefined) nextState.sceneTransition = uiSettings.sceneTransition;
  if (uiSettings.albumStyle !== undefined) nextState.albumStyle = uiSettings.albumStyle;
  if (uiSettings.albumCaptionsEnabled !== undefined) nextState.albumCaptionsEnabled = uiSettings.albumCaptionsEnabled;
  if (uiSettings.moodColorsEnabled !== undefined) nextState.moodColorsEnabled = uiSettings.moodColorsEnabled;
  if (uiSettings.chapterPinsEnabled !== undefined) nextState.chapterPinsEnabled = uiSettings.chapterPinsEnabled;
  if (uiSettings.breadcrumbsEnabled !== undefined) nextState.breadcrumbsEnabled = uiSettings.breadcrumbsEnabled;
  if (uiSettings.tripStatsEnabled !== undefined) nextState.tripStatsEnabled = uiSettings.tripStatsEnabled;

  if (Object.keys(nextState).length > 0) {
    useUIStore.setState(nextState);
  }
}

function nextProjectSaveVersion(projectId: string): number {
  const version = (projectSaveVersions.get(projectId) ?? 0) + 1;
  projectSaveVersions.set(projectId, version);
  return version;
}

function getLatestProjectSaveVersion(projectId: string): number {
  return projectSaveVersions.get(projectId) ?? 0;
}

/** Invalidate all serialization caches and mark all locations dirty (e.g. after undo/redo) */
export function invalidateSerializationCache(): void {
  const { locations } = useProjectStore.getState();
  serializedLocationCache.clear();
  dirtyLocationIds.clear();
  locationDirtyVersion.clear();
  for (const loc of locations) {
    dirtyLocationIds.add(loc.id);
    locationDirtyVersion.set(loc.id, (locationDirtyVersion.get(loc.id) ?? 0) + 1);
  }
}

/** Convert a non-data URL (blob:, relative path, etc.) to a data: URL for persistence (cached).
 *  Returns null if conversion fails — callers must handle missing photos gracefully
 *  rather than persisting broken URLs. */
async function blobUrlToDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  // Preserve cloud placeholder URLs (cloud:assetId) through serialization
  if (url.startsWith("cloud:")) return url;
  const cached = blobToDataUrlCache.get(url);
  if (cached) return cached;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[persist] Failed to fetch photo for persistence (${resp.status}): ${url.slice(0, 80)}`);
      return null;
    }
    const blob = await resp.blob();
    if (blob.size < 100) {
      console.warn(`[persist] Photo too small (${blob.size}B), likely broken: ${url.slice(0, 80)}`);
      return null;
    }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    blobToDataUrlCache.set(url, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn(`[persist] Failed to convert photo to data URL: ${url.slice(0, 80)}`, err);
    return null;
  }
}

async function serializeLocation(loc: Location): Promise<SerializedLocation> {
  return {
    id: loc.id,
    name: loc.name,
    nameLocal: loc.nameLocal,
    coordinates: loc.coordinates as [number, number],
    isWaypoint: loc.isWaypoint ?? false,
    ...(loc.photos.length > 0
      ? {
          photos: (await Promise.all(loc.photos.map(async (photo) => {
            const persistedUrl = await blobUrlToDataUrl(photo.url);
            if (!persistedUrl) {
              // Photo data is not fetchable (blob revoked / relative path 404).
              // Skip it rather than persisting a broken URL that can never load.
              console.warn(`[persist] Dropping un-persistable photo ${photo.id} from location ${loc.name}`);
              return null;
            }
            return {
              id: photo.id,
              url: persistedUrl,
              caption: photo.caption,
              ...(photo.focalPoint ? { focalPoint: photo.focalPoint } : {}),
            };
          }))).filter((p): p is NonNullable<typeof p> => p !== null),
        }
      : {}),
    ...(loc.photoLayout
      ? {
          photoLayout: {
            ...loc.photoLayout,
            freeTransforms: serializeFreeTransforms(loc.photoLayout, loc.photos),
            order: loc.photoLayout.order
              ? loc.photoLayout.order
                  .map((photoId) =>
                    loc.photos.findIndex((photo) => photo.id === photoId),
                  )
                  .filter((index) => index >= 0)
                  .map(String)
              : undefined,
          },
        }
      : {}),
    ...(loc.chapterTitle ? { chapterTitle: loc.chapterTitle } : {}),
    ...(loc.chapterNote ? { chapterNote: loc.chapterNote } : {}),
    ...(loc.chapterDate ? { chapterDate: loc.chapterDate } : {}),
    ...(loc.chapterEmoji ? { chapterEmoji: loc.chapterEmoji } : {}),
  };
}

/** Version counter per location — incremented on each markLocationDirty() call */
const locationDirtyVersion = new Map<string, number>();

async function serializeProjectState(
  locations: Location[],
  segments: Segment[],
  mapStyle: MapStyle,
  segmentTimingOverrides: Record<string, number>,
  name?: string,
): Promise<PersistedProjectData> {
  // Snapshot dirty versions at save start to detect concurrent edits
  const dirtySnapshotVersions = new Map<string, number>();
  for (const locId of dirtyLocationIds) {
    dirtySnapshotVersions.set(locId, locationDirtyVersion.get(locId) ?? 0);
  }

  const exportedLocations = await Promise.all(locations.map(async (loc) => {
    // Use cached serialization for clean locations (no photo changes)
    const cached = serializedLocationCache.get(loc.id);
    if (cached && !dirtySnapshotVersions.has(loc.id)) {
      // Re-serialize cheap fields (name, coords, waypoint, chapter metadata) but reuse photo data
      const updated: SerializedLocation = {
        ...cached,
        name: loc.name,
        nameLocal: loc.nameLocal,
        coordinates: loc.coordinates as [number, number],
        isWaypoint: loc.isWaypoint ?? false,
        chapterTitle: loc.chapterTitle,
        chapterNote: loc.chapterNote,
        chapterDate: loc.chapterDate,
        chapterEmoji: loc.chapterEmoji,
      };
      serializedLocationCache.set(loc.id, updated);
      return updated;
    }

    // Full serialization (expensive blob→dataURL for photos)
    const serialized = await serializeLocation(loc);
    // Only update cache/clear dirty if version hasn't changed during async save
    const snapshotVersion = dirtySnapshotVersions.get(loc.id);
    const currentVersion = locationDirtyVersion.get(loc.id) ?? 0;
    if (snapshotVersion === undefined || snapshotVersion === currentVersion) {
      serializedLocationCache.set(loc.id, serialized);
      dirtyLocationIds.delete(loc.id);
    }
    return serialized;
  }));

  return {
    name: name ?? DEFAULT_ROUTE_NAME,
    mapStyle,
    ...collectRouteUISettings(),
    locations: exportedLocations,
    segments: segments.map((segment) => ({
      id: segment.id,
      fromIndex: locations.findIndex(
        (location) => location.id === segment.fromId,
      ),
      toIndex: locations.findIndex((location) => location.id === segment.toId),
      transportMode: segment.transportMode,
      iconStyle: segment.iconStyle,
      ...(segment.iconVariant ? { iconVariant: segment.iconVariant } : {}),
    })),
    ...(Object.keys(segmentTimingOverrides).length > 0
      ? {
          timingOverrides: Object.fromEntries(
            Object.entries(segmentTimingOverrides)
              .map(([segmentId, duration]) => {
                const index = segments.findIndex(
                  (segment) => segment.id === segmentId,
                );
                return index >= 0 ? [String(index), duration] : null;
              })
              .filter(Boolean) as [string, number][],
          ),
        }
      : {}),
  };
}

function rebuildSegments(
  locations: Location[],
  oldSegments: Segment[],
): Segment[] {
  if (locations.length < 2) return [];

  const segmentMap = new Map<string, Segment>();
  for (const seg of oldSegments) {
    segmentMap.set(`${seg.fromId}-${seg.toId}`, seg);
  }

  const segments: Segment[] = [];
  for (let i = 0; i < locations.length - 1; i++) {
    const fromId = locations[i].id;
    const toId = locations[i + 1].id;
    const forward = segmentMap.get(`${fromId}-${toId}`);
    const reversed = segmentMap.get(`${toId}-${fromId}`);
    const existing = forward || reversed;
    if (existing) {
      segments.push({
        ...existing,
        id: forward ? existing.id : generateId(),
        fromId,
        toId,
        iconStyle: resolveTransportIconStyle(existing.iconStyle),
        // Keep geometry only if direction unchanged; reversed needs re-fetch
        geometry: forward ? existing.geometry : null,
      });
    } else {
      segments.push({
        id: generateId(),
        fromId,
        toId,
        transportMode: "flight",
        iconStyle: DEFAULT_TRANSPORT_ICON_STYLE,
        geometry: null,
      });
    }
  }
  return segments;
}

function normalizeEdgeWaypoints(locations: Location[]): Location[] {
  if (locations.length === 0) return locations;

  const nextLocations = [...locations];
  if (nextLocations[0]?.isWaypoint) {
    nextLocations[0] = { ...nextLocations[0], isWaypoint: false };
  }

  const lastIndex = nextLocations.length - 1;
  if (lastIndex > 0 && nextLocations[lastIndex]?.isWaypoint) {
    nextLocations[lastIndex] = { ...nextLocations[lastIndex], isWaypoint: false };
  }

  return nextLocations;
}

function insertLocationAtIndex(
  locations: Location[],
  location: Location,
  index: number,
): Location[] {
  const nextLocations = [...locations];
  const safeIndex = Math.max(0, Math.min(index, nextLocations.length));
  nextLocations.splice(safeIndex, 0, location);
  return normalizeEdgeWaypoints(nextLocations);
}

function clonePhotoLayout(
  photoLayout: PhotoLayout | undefined,
  photoIdMap: Map<string, string>,
): PhotoLayout | undefined {
  if (!photoLayout) {
    return undefined;
  }

  return {
    ...photoLayout,
    customProportions: photoLayout.customProportions
      ? {
          rows: photoLayout.customProportions.rows
            ? [...photoLayout.customProportions.rows]
            : undefined,
          cols: photoLayout.customProportions.cols
            ? [...photoLayout.customProportions.cols]
            : undefined,
        }
      : undefined,
    order: photoLayout.order
      ?.map((photoId) => photoIdMap.get(photoId))
      .filter((photoId): photoId is string => Boolean(photoId)),
    freeTransforms: photoLayout.freeTransforms?.reduce<NonNullable<PhotoLayout["freeTransforms"]>>((acc, transform) => {
      const nextPhotoId = photoIdMap.get(transform.photoId);
      if (!nextPhotoId) {
        return acc;
      }

      acc.push({
        ...transform,
        photoId: nextPhotoId,
        ...(transform.caption
          ? { caption: { ...transform.caption } }
          : {}),
      });
      return acc;
    }, []),
  };
}

function duplicateLocationEntry(location: Location): Location {
  const nextLocationId = generateId();
  const photoIdMap = new Map<string, string>();
  const photos = location.photos.map((photo) => {
    const nextPhotoId = generateId();
    photoIdMap.set(photo.id, nextPhotoId);
    registerPhotoUrl(nextPhotoId, photo.url);

    return {
      ...photo,
      id: nextPhotoId,
      locationId: nextLocationId,
      ...(photo.focalPoint ? { focalPoint: { ...photo.focalPoint } } : {}),
    };
  });

  return {
    ...location,
    id: nextLocationId,
    coordinates: [...location.coordinates] as [number, number],
    photos,
    ...(location.photoLayout
      ? { photoLayout: clonePhotoLayout(location.photoLayout, photoIdMap) }
      : {}),
  };
}

async function resolveLocationFromCoordinates(
  lng: number,
  lat: number,
): Promise<Pick<Location, "name" | "nameLocal" | "coordinates">> {
  try {
    const reverseResponse = await fetch(`/api/geocode?lng=${lng}&lat=${lat}`);
    const reverseData = await reverseResponse.json();
    const name =
      reverseData.features?.[0]?.text ||
      reverseData.features?.[0]?.place_name ||
      `${lat.toFixed(2)}, ${lng.toFixed(2)}`;

    let nameLocal: string | undefined;
    try {
      const { localLanguage } = useUIStore.getState();
      const localRes = await fetch(
        `/api/geocode?q=${encodeURIComponent(name)}&language=${localLanguage}`,
      );
      const localData = await localRes.json();
      nameLocal =
        localData.features?.[0]?.text ||
        localData.features?.[0]?.place_name ||
        undefined;
    } catch {
      // Local language reverse lookup is a nice-to-have fallback.
    }

    return {
      name,
      nameLocal,
      coordinates: [lng, lat],
    };
  } catch {
    return {
      name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      coordinates: [lng, lat],
    };
  }
}

function buildProjectMeta(
  id: string,
  name: string,
  locations: Location[],
  existingMeta?: ProjectMeta,
): ProjectMeta {
  const now = Date.now();
  return {
    id,
    name,
    createdAt: existingMeta?.createdAt ?? now,
    updatedAt: now,
    locationCount: locations.length,
    previewLocations: locations
      .filter((l) => !l.isWaypoint)
      .slice(0, 3)
      .map((l) => l.name),
    cloudRevision: existingMeta?.cloudRevision,
  };
}

interface ParsedProjectData {
  name: string;
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
  segmentTimingOverrides: Record<string, number>;
  uiSettings: RouteUISettings;
}

function parseImportedProjectData(data: ImportRouteData): ParsedProjectData {
  if (
    !isObject(data) ||
    !Array.isArray(data.locations) ||
    !Array.isArray(data.segments)
  ) {
    throw new Error("Invalid route data: missing locations or segments.");
  }

  const locations: Location[] = data.locations.map((loc, locationIndex) => {
    if (
      !isObject(loc) ||
      typeof loc.name !== "string" ||
      !isValidCoordinates(loc.coordinates)
    ) {
      throw new Error(`Invalid route location at index ${locationIndex}.`);
    }

    const locationId = (typeof loc.id === "string" && loc.id) || generateId();
    const photoInputs = Array.isArray(loc.photos) ? loc.photos : [];
    const photos: Photo[] = photoInputs.map((photo, photoIndex) => {
      if (!isObject(photo) || typeof photo.url !== "string") {
        throw new Error(
          `Invalid photo at location ${locationIndex}, photo ${photoIndex}.`,
        );
      }

      return {
        id: (typeof photo.id === "string" && photo.id) || generateId(),
        locationId,
        url: photo.url,
        caption: typeof photo.caption === "string" ? photo.caption : undefined,
        ...(isObject(photo.focalPoint) &&
        isFiniteCoordinate(photo.focalPoint.x) &&
        isFiniteCoordinate(photo.focalPoint.y)
          ? { focalPoint: { x: photo.focalPoint.x, y: photo.focalPoint.y } }
          : {}),
      };
    });

    const rawLayout = isObject(loc.photoLayout) ? loc.photoLayout : undefined;
    const photoLayout = rawLayout
      ? {
          ...rawLayout,
          freeTransforms: deserializeFreeTransforms(rawLayout, photos),
          order: Array.isArray(rawLayout.order)
            ? rawLayout.order
                .map((indexValue) => {
                  const photoIndex = Number.parseInt(String(indexValue), 10);
                  return Number.isInteger(photoIndex) &&
                    photoIndex >= 0 &&
                    photoIndex < photos.length
                    ? photos[photoIndex]?.id
                    : null;
                })
                .filter((photoId): photoId is string => Boolean(photoId))
            : undefined,
          captionFontSize: typeof rawLayout.captionFontSize === "number"
            ? Math.max(8, Math.min(72, rawLayout.captionFontSize))
            : undefined,
          captionFontFamily: typeof rawLayout.captionFontFamily === "string" &&
            ALLOWED_CAPTION_FONTS.includes(rawLayout.captionFontFamily as typeof ALLOWED_CAPTION_FONTS[number])
            ? rawLayout.captionFontFamily as typeof ALLOWED_CAPTION_FONTS[number]
            : undefined,
        }
      : undefined;

    return {
      id: locationId,
      name: loc.name,
      nameLocal: typeof loc.nameLocal === "string" ? loc.nameLocal
        : typeof (loc as Record<string, unknown>).nameZh === "string" ? (loc as Record<string, unknown>).nameZh as string
        : undefined,
      coordinates: loc.coordinates,
      photos,
      isWaypoint:
        locationIndex > 0 &&
        locationIndex < data.locations.length - 1 &&
        Boolean(loc.isWaypoint),
      ...(photoLayout ? { photoLayout } : {}),
      ...(typeof loc.chapterTitle === "string" ? { chapterTitle: loc.chapterTitle } : {}),
      ...(typeof loc.chapterNote === "string" ? { chapterNote: loc.chapterNote } : {}),
      ...(typeof loc.chapterDate === "string" ? { chapterDate: loc.chapterDate } : {}),
      ...(typeof loc.chapterEmoji === "string" ? { chapterEmoji: loc.chapterEmoji } : {}),
    };
  });

  const segments: Segment[] = data.segments.map((segment, segmentIndex) => {
    if (!isObject(segment)) {
      throw new Error(`Invalid route segment at index ${segmentIndex}.`);
    }

    const fromIndex = segment.fromIndex;
    const toIndex = segment.toIndex;

    if (
      !Number.isInteger(fromIndex) ||
      fromIndex < 0 ||
      fromIndex >= locations.length
    ) {
      throw new Error(
        `Invalid route segment ${segmentIndex}: fromIndex ${String(fromIndex)} is out of bounds.`,
      );
    }
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= locations.length) {
      throw new Error(
        `Invalid route segment ${segmentIndex}: toIndex ${String(toIndex)} is out of bounds.`,
      );
    }

    const transportMode = VALID_TRANSPORT_MODES.includes(
      segment.transportMode as TransportMode,
    )
      ? (segment.transportMode as TransportMode)
      : "flight";

    return {
      id: (typeof segment.id === "string" && segment.id) || generateId(),
      fromId: locations[fromIndex].id,
      toId: locations[toIndex].id,
      transportMode,
      iconStyle: resolveTransportIconStyle(
        segment.iconStyle as TransportIconStyle | undefined,
      ),
      ...(segment.iconVariant ? { iconVariant: segment.iconVariant as IconVariant } : {}),
      geometry: null,
    };
  });

  const segmentTimingOverrides: Record<string, number> = {};
  if (isObject(data.timingOverrides)) {
    for (const [segmentIndexValue, duration] of Object.entries(
      data.timingOverrides,
    )) {
      const segmentIndex = Number.parseInt(segmentIndexValue, 10);
      if (
        Number.isInteger(segmentIndex) &&
        segmentIndex >= 0 &&
        segmentIndex < segments.length &&
        typeof duration === "number" &&
        Number.isFinite(duration)
      ) {
        segmentTimingOverrides[segments[segmentIndex].id] = duration;
      }
    }
  }

  return {
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : DEFAULT_ROUTE_NAME,
    locations,
    segments,
    mapStyle: data.mapStyle ?? DEFAULT_MAP_STYLE,
    segmentTimingOverrides,
    uiSettings: parseImportedUISettings(data),
  };
}

async function resolveExistingProjectMeta(
  projectId: string,
): Promise<ProjectMeta | undefined> {
  const state = useProjectStore.getState();
  const inMemoryMeta = state.projects.find((project) => project.id === projectId);
  if (inMemoryMeta) {
    return inMemoryMeta;
  }
  return getProjectMeta(projectId);
}

type RouteHistoryState = Pick<
  ProjectState,
  "locations" | "segments" | "segmentTimingOverrides"
>;

type LocationUpdateFields = Partial<
  Pick<
    Location,
    | "name"
    | "nameLocal"
    | "coordinates"
    | "chapterTitle"
    | "chapterNote"
    | "chapterDate"
    | "chapterEmoji"
  >
>;

function getRouteHistoryState(
  state: RouteHistoryState,
): RouteHistoryState {
  return {
    locations: state.locations,
    segments: state.segments,
    segmentTimingOverrides: state.segmentTimingOverrides,
  };
}

function buildRouteHistoryState(
  locations: Location[],
  segments: Segment[],
  segmentTimingOverrides: Record<string, number>,
): RouteHistoryState {
  return {
    locations,
    segments,
    segmentTimingOverrides,
  };
}

function pushRouteHistoryChange(params: {
  before: RouteHistoryState;
  after: RouteHistoryState;
  label: string;
  redoLabel?: string;
}): void {
  useHistoryStore.getState().pushRouteChange({
    before: getRouteHistoryState(params.before),
    after: getRouteHistoryState(params.after),
    undoLabel: params.label,
    redoLabel: params.redoLabel,
  });
}

function formatStopLabel(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled stop";
}

function buildToggleWaypointLabel(location: Location): string {
  return `${location.isWaypoint ? "Mark" : "Convert"} ${formatStopLabel(location.name)} ${location.isWaypoint ? "as destination" : "to waypoint"}`;
}

function buildBatchRemoveLabel(removedLocations: Location[]): string {
  if (removedLocations.length === 1) {
    return `Remove ${formatStopLabel(removedLocations[0]?.name)}`;
  }

  return `Remove ${removedLocations.length} stops`;
}

function buildBatchToggleWaypointLabel(toggledLocations: Location[]): string {
  if (toggledLocations.length === 1) {
    return buildToggleWaypointLabel(toggledLocations[0]);
  }

  return `Toggle pass-through for ${toggledLocations.length} stops`;
}

function buildLocationUpdateLabel(
  previousLocation: Location,
  nextLocation: Location,
  changedKeys: Array<keyof LocationUpdateFields>,
): string {
  if (changedKeys.length === 1 && changedKeys[0] === "name") {
    return `Rename ${formatStopLabel(previousLocation.name)} → ${formatStopLabel(nextLocation.name)}`;
  }

  return `Edit ${formatStopLabel(nextLocation.name)}`;
}

function removeLocationFromRouteState(
  state: RouteHistoryState,
  id: string,
): {
  nextState: RouteHistoryState;
  removedLocation: Location | null;
} {
  const removedLocation = state.locations.find((entry) => entry.id === id) ?? null;
  if (!removedLocation) {
    return { nextState: state, removedLocation: null };
  }

  const locations = normalizeEdgeWaypoints(
    state.locations.filter((entry) => entry.id !== id),
  );

  return {
    removedLocation,
    nextState: buildRouteHistoryState(
      locations,
      rebuildSegments(locations, state.segments),
      state.segmentTimingOverrides,
    ),
  };
}

function toggleWaypointInRouteState(
  state: RouteHistoryState,
  locationId: string,
): {
  nextState: RouteHistoryState;
  toggledLocation: Location | null;
} {
  const index = state.locations.findIndex((location) => location.id === locationId);
  if (index <= 0 || index >= state.locations.length - 1) {
    return { nextState: state, toggledLocation: null };
  }

  const toggledLocation = state.locations[index];
  const locations = state.locations.map((location) =>
    location.id === locationId
      ? { ...location, isWaypoint: !location.isWaypoint }
      : location,
  );

  return {
    toggledLocation,
    nextState: buildRouteHistoryState(
      locations,
      state.segments,
      state.segmentTimingOverrides,
    ),
  };
}

async function queueProjectSave(
  projectId: string,
  saveVersion: number,
  meta: ProjectMeta,
  data: ImportRouteData,
  nextProjectJson: string,
): Promise<boolean> {
  const { setSaveStatus } = useUIStore.getState();
  let didSave = false;
  const saveTask = saveCommitChain
    .catch(() => undefined)
    .then(async () => {
      if (saveVersion !== getLatestProjectSaveVersion(projectId)) {
        return;
      }

      setSaveStatus("saving");
      try {
        await saveProject(meta, data);
        didSave = true;

        if (useProjectStore.getState().currentProjectId === projectId) {
          lastSavedProjectJson = nextProjectJson;
        }

        const projects = await listProjectsFromDB();
        useProjectStore.setState({ projects });
        setSaveStatus("saved");
        // Reset to idle after 2 seconds
        setTimeout(() => {
          if (useUIStore.getState().saveStatus === "saved") {
            setSaveStatus("idle");
          }
        }, 2000);
      } catch (error) {
        console.error("[save] Failed to save project to IndexedDB:", error);
        setSaveStatus("error");
      }
    });

  saveCommitChain = saveTask.then(
    () => undefined,
    () => undefined,
  );

  await saveTask;
  return didSave;
}

async function persistProjectSnapshot(
  state: Pick<
    ProjectState,
    | "currentProjectId"
    | "currentProjectName"
    | "locations"
    | "segments"
    | "mapStyle"
    | "segmentTimingOverrides"
  >,
  saveVersion?: number,
): Promise<boolean> {
  const {
    currentProjectId,
    currentProjectName,
    locations,
    segments,
    mapStyle,
    segmentTimingOverrides,
  } = state;
  if (!currentProjectId) return false;

  const version = saveVersion ?? nextProjectSaveVersion(currentProjectId);
  const data = await serializeProjectState(
    locations,
    segments,
    mapStyle,
    segmentTimingOverrides,
    currentProjectName,
  );

  let nextProjectJson = "";
  if (!diffCheckDisabled) {
    try {
      nextProjectJson = JSON.stringify(data);
    } catch {
      console.warn("Project too large for diff check — disabling for this session.");
      diffCheckDisabled = true;
      nextProjectJson = "";
    }
    if (
      nextProjectJson &&
      currentProjectId === useProjectStore.getState().currentProjectId &&
      nextProjectJson === lastSavedProjectJson
    ) {
      return false;
    }
  }

  const existingMeta = await resolveExistingProjectMeta(currentProjectId);
  const meta = buildProjectMeta(
    currentProjectId,
    currentProjectName,
    locations,
    existingMeta,
  );

  return queueProjectSave(
    currentProjectId,
    version,
    meta,
    data,
    nextProjectJson,
  );
}

async function ensureProjectData(
  projectId: string,
  projectName: string,
): Promise<ImportRouteData> {
  const data = await getProjectData(projectId);
  if (data) {
    return data;
  }

  console.error(
    `Project ${projectId} is missing persisted data. Recreating an empty project payload.`,
  );
  const emptyData = createEmptyProjectData(projectName);
  await putProjectData(projectId, emptyData);
  return emptyData;
}

async function runProjectTransition<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (useProjectStore.getState().isSwitchingProject) {
    throw new Error(
      `Cannot ${label} while another project transition is in progress.`,
    );
  }

  persistSuspended = true;
  useProjectStore.setState({ isSwitchingProject: true });

  try {
    return await operation();
  } catch (error) {
    console.error(`Failed to ${label}.`, error);
    throw error;
  } finally {
    useProjectStore.setState({ isSwitchingProject: false });
    persistSuspended = false;
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectId: null,
  currentProjectName: DEFAULT_ROUTE_NAME,
  projects: [],
  isSwitchingProject: false,

  locations: [],
  segments: [],
  mapStyle: DEFAULT_MAP_STYLE,
  segmentTimingOverrides: {},
  segmentColors: {},

  addLocation: (loc) => {
    const state = get();
    const newLocation: Location = {
      id: generateId(),
      name: loc.name,
      nameLocal: loc.nameLocal,
      coordinates: loc.coordinates,
      isWaypoint: false,
      photos: [],
    };
    const locations = insertLocationAtIndex(
      state.locations,
      newLocation,
      state.locations.length,
    );
    const nextState = {
      locations,
      segments: rebuildSegments(locations, state.segments),
      segmentTimingOverrides: state.segmentTimingOverrides,
    };

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: `Add ${formatStopLabel(newLocation.name)}`,
    });
    set(nextState);
  },

  addLocationAtCoordinates: async (lngLat, options) => {
    const locationData = await resolveLocationFromCoordinates(lngLat.lng, lngLat.lat);
    const state = get();
    const shouldBecomeWaypoint =
      Boolean(options?.isWaypoint) && state.locations.length >= 2;
    const insertIndex =
      typeof options?.insertIndex === "number"
        ? options.insertIndex
        : shouldBecomeWaypoint
          ? state.locations.length - 1
          : state.locations.length;
    const newLocation: Location = {
      id: generateId(),
      ...locationData,
      isWaypoint: shouldBecomeWaypoint,
      photos: [],
    };
    const locations = insertLocationAtIndex(
      state.locations,
      newLocation,
      insertIndex,
    );
    const nextState = {
      locations,
      segments: rebuildSegments(locations, state.segments),
      segmentTimingOverrides: state.segmentTimingOverrides,
    };

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: `Add ${formatStopLabel(newLocation.name)}`,
    });
    set(nextState);
  },

  duplicateLocation: (locationId) => {
    const state = get();
    const locationIndex = state.locations.findIndex((location) => location.id === locationId);
    if (locationIndex < 0) {
      return;
    }

    const sourceLocation = state.locations[locationIndex];
    const locations = insertLocationAtIndex(
      state.locations,
      duplicateLocationEntry(sourceLocation),
      locationIndex + 1,
    );
    const nextState = {
      locations,
      segments: rebuildSegments(locations, state.segments),
      segmentTimingOverrides: state.segmentTimingOverrides,
    };

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: `Duplicate ${formatStopLabel(sourceLocation.name)}`,
    });
    set(nextState);
  },

  removeLocation: (id) => {
    const state = get();
    const { nextState, removedLocation } = removeLocationFromRouteState(
      getRouteHistoryState(state),
      id,
    );
    if (!removedLocation) {
      return;
    }

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: buildBatchRemoveLabel([removedLocation]),
    });
    set(nextState);
  },

  batchRemoveLocations: (ids) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return;
    }

    const state = get();
    let nextState = getRouteHistoryState(state);
    const removedLocations: Location[] = [];

    for (const id of uniqueIds) {
      const result = removeLocationFromRouteState(nextState, id);
      if (!result.removedLocation) {
        continue;
      }

      removedLocations.push(result.removedLocation);
      nextState = result.nextState;
    }

    if (removedLocations.length === 0) {
      return;
    }

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: buildBatchRemoveLabel(removedLocations),
    });
    set(nextState);
  },

  reorderLocations: (fromIndex, toIndex) => {
    const state = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.locations.length ||
      toIndex >= state.locations.length
    ) {
      return;
    }

    const locations = [...state.locations];
    const [moved] = locations.splice(fromIndex, 1);
    if (!moved) {
      return;
    }

    locations.splice(toIndex, 0, moved);
    const normalizedLocations = normalizeEdgeWaypoints(locations);
    const nextState = {
      locations: normalizedLocations,
      segments: rebuildSegments(normalizedLocations, state.segments),
      segmentTimingOverrides: state.segmentTimingOverrides,
    };

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: `Move ${formatStopLabel(moved.name)} to stop ${toIndex + 1}`,
    });
    set(nextState);
  },

  updateLocation: (id, updates) => {
    const state = get();
    const previousLocation = state.locations.find((location) => location.id === id);
    if (!previousLocation) {
      return;
    }

    const changedKeys = (Object.keys(updates) as Array<keyof LocationUpdateFields>).filter(
      (key) =>
        Object.prototype.hasOwnProperty.call(updates, key) &&
        previousLocation[key] !== updates[key],
    );

    if (changedKeys.length === 0) {
      return;
    }

    const nextLocation = { ...previousLocation, ...updates };
    const locations = state.locations.map((location) =>
      location.id === id ? nextLocation : location,
    );

    pushRouteHistoryChange({
      before: state,
      after: {
        locations,
        segments: state.segments,
        segmentTimingOverrides: state.segmentTimingOverrides,
      },
      label: buildLocationUpdateLabel(previousLocation, nextLocation, changedKeys),
    });
    set({ locations });
  },

  toggleWaypoint: (locationId) => {
    const state = get();
    const { nextState, toggledLocation } = toggleWaypointInRouteState(
      getRouteHistoryState(state),
      locationId,
    );
    if (!toggledLocation) {
      return;
    }

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: buildBatchToggleWaypointLabel([toggledLocation]),
    });
    set(nextState);
  },

  batchToggleWaypoint: (ids) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return;
    }

    const state = get();
    let nextState = getRouteHistoryState(state);
    const toggledLocations: Location[] = [];

    for (const id of uniqueIds) {
      const result = toggleWaypointInRouteState(nextState, id);
      if (!result.toggledLocation) {
        continue;
      }

      toggledLocations.push(result.toggledLocation);
      nextState = result.nextState;
    }

    if (toggledLocations.length === 0) {
      return;
    }

    pushRouteHistoryChange({
      before: state,
      after: nextState,
      label: buildBatchToggleWaypointLabel(toggledLocations),
    });
    set(nextState);
  },

  setTransportMode: (segmentId, mode) => {
    useHistoryStore.getState().pushState();
    return set((state) => ({
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, transportMode: mode, iconVariant: undefined, geometry: null } : s,
      ),
    }));
  },

  setSegmentIconStyle: (segmentId, iconStyle) => {
    useHistoryStore.getState().pushState();
    return set((state) => ({
      segments: state.segments.map((segment) =>
        segment.id === segmentId ? { ...segment, iconStyle } : segment,
      ),
    }));
  },

  setSegmentIconVariant: (segmentId, variant) => {
    useHistoryStore.getState().pushState();
    return set((state) => ({
      segments: state.segments.map((segment) =>
        segment.id === segmentId ? { ...segment, iconVariant: variant } : segment,
      ),
    }));
  },

  setSegmentGeometry: (segmentId, geometry) =>
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, geometry } : s,
      ),
    })),

  setSegmentTiming: (segmentId, duration) => {
    useHistoryStore.getState().pushState();
    return set((state) => {
      const overrides = { ...state.segmentTimingOverrides };
      if (duration === null) {
        delete overrides[segmentId];
      } else {
        overrides[segmentId] = duration;
      }
      return { segmentTimingOverrides: overrides };
    });
  },

  clearAllTimingOverrides: () => set({ segmentTimingOverrides: {} }),

  setSegmentColor: (index, color) =>
    set((state) => ({
      segmentColors: { ...state.segmentColors, [index]: color },
    })),

  clearSegmentColors: () => set({ segmentColors: {} }),

  addPhoto: (locationId, photo): string => {
    useHistoryStore.getState().pushState();
    markLocationDirty(locationId);
    const newId = generateId();
    // Register the photo URL so undo/redo can restore it without cloning
    registerPhotoUrl(newId, photo.url);
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              photos: [...l.photos, { ...photo, id: newId, locationId }],
            }
          : l,
      ),
    }));
    return newId;
  },

  removePhoto: (locationId, photoId) => {
    useHistoryStore.getState().pushState();
    markLocationDirty(locationId);
    return set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? { ...l, photos: l.photos.filter((p) => p.id !== photoId) }
          : l,
      ),
    }));
  },

  setPhotoLayout: (locationId, layout) => {
    markLocationDirty(locationId);
    return set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId ? { ...l, photoLayout: layout } : l,
      ),
    }));
  },

  setPhotoFocalPoint: (locationId, photoId, point) => {
    markLocationDirty(locationId);
    return set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              photos: l.photos.map((p) =>
                p.id === photoId ? { ...p, focalPoint: point } : p,
              ),
            }
          : l,
      ),
    }));
  },

  setPhotoCaption: (locationId, photoId, caption) => {
    markLocationDirty(locationId);
    return set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              photos: l.photos.map((p) =>
                p.id === photoId ? { ...p, caption: caption || undefined } : p,
              ),
            }
          : l,
      ),
    }));
  },

  setMapStyle: (style) => set({ mapStyle: style }),

  clearRoute: () => {
    useHistoryStore.getState().pushState();
    if (isBrowser()) {
      cancelPendingPersist();
      skipNextPersist = true;
    }

    set({
      locations: [],
      segments: [],
      mapStyle: DEFAULT_MAP_STYLE,
      segmentTimingOverrides: {},
      segmentColors: {},
    });

    const state = get();
    const { currentProjectId } = state;
    if (currentProjectId) {
      const saveVersion = nextProjectSaveVersion(currentProjectId);
      void persistProjectSnapshot(get(), saveVersion).catch((error) => {
        console.error("Failed to persist cleared project state.", error);
      });
    }
  },

  exportRoute: async () => {
    const { locations, segments, mapStyle, segmentTimingOverrides, currentProjectName } = get();
    return serializeProjectState(
      locations,
      segments,
      mapStyle,
      segmentTimingOverrides,
      currentProjectName,
    );
  },

  importRoute: (data) => {
    const parsed = parseImportedProjectData(data);
    useHistoryStore.getState().pushState();
    clearDirtyTracking();
    applyImportedUISettings(parsed.uiSettings);
    set({
      currentProjectName: parsed.name,
      locations: parsed.locations,
      segments: parsed.segments,
      mapStyle: parsed.mapStyle,
      segmentTimingOverrides: parsed.segmentTimingOverrides,
      segmentColors: {},
    });

    // Register photo URLs for undo/redo
    registerPhotoUrls(parsed.locations);
  },

  loadRouteData: async (data) => {
    try {
      // Ensure there's a project to save into
      if (!get().currentProjectId) {
        await get().createNewProject(data.name);
      }
      get().importRoute(data);
      void runBackgroundPhotoCompression().catch((error) => {
        console.error("Failed to compress loaded project photos.", error);
      });
      await get().regenerateSegmentGeometries();
    } catch (error) {
      console.error("Failed to load route data.", error);
      throw error;
    }
  },

  regenerateSegmentGeometries: async () => {
    const { locations, segments } = get();

    const geometries = await Promise.all(
      segments.map(async (segment) => {
        const fromLocation = locations.find(
          (location) => location.id === segment.fromId,
        );
        const toLocation = locations.find(
          (location) => location.id === segment.toId,
        );

        if (!fromLocation || !toLocation) {
          return { segmentId: segment.id, geometry: null };
        }

        try {
          const geometry = await generateRouteGeometry(
            fromLocation.coordinates,
            toLocation.coordinates,
            segment.transportMode,
          );
          return { segmentId: segment.id, geometry };
        } catch (error) {
          console.error(
            `Failed to regenerate geometry for segment ${segment.id}.`,
            error,
          );
          return { segmentId: segment.id, geometry: null };
        }
      }),
    );

    set((state) => ({
      segments: state.segments.map((segment) => {
        const match = geometries.find(
          (entry) => entry.segmentId === segment.id,
        );
        return match ? { ...segment, geometry: match.geometry } : segment;
      }),
    }));
  },

  restorePersistedProject: async () => {
    if (!isBrowser()) return;

    persistSuspended = true;

    try {
      const migratedId = await migrateFromLocalStorage();
      const projects = await listProjectsFromDB();
      set({ projects });

      const targetId = migratedId ?? projects[0]?.id ?? null;
      if (!targetId) {
        persistSuspended = false;
        await get().createNewProject();
        return;
      }

      const meta = projects.find((project) => project.id === targetId);
      const projectName = meta?.name ?? DEFAULT_ROUTE_NAME;
      const data = await ensureProjectData(targetId, projectName);
      const parsed = parseImportedProjectData(data);

      clearDirtyTracking();
      applyImportedUISettings(parsed.uiSettings);
      set({
        currentProjectId: targetId,
        currentProjectName: meta?.name ?? parsed.name ?? DEFAULT_ROUTE_NAME,
        locations: parsed.locations,
        segments: parsed.segments,
        mapStyle: parsed.mapStyle,
        segmentTimingOverrides: parsed.segmentTimingOverrides,
        segmentColors: {},
        projects,
      });
      tryUpdateLastSavedJson(data);

      // Register all photo URLs so undo/redo can restore them without cloning
      registerPhotoUrls(parsed.locations);

      useHistoryStore.getState().resetHistory();
      await get().regenerateSegmentGeometries();
      void runBackgroundPhotoCompression().catch((error) => {
        console.error("Failed to compress restored project photos.", error);
      });
    } catch (error) {
      console.error("Failed to restore persisted project.", error);
      const currentProjectId = get().currentProjectId;
      if (!currentProjectId) {
        persistSuspended = false;
        await get().createNewProject();
        return;
      }
    } finally {
      persistSuspended = false;
    }
  },

  enrichLocalNames: async (force?: boolean) => {
    const { locations } = get();
    const { localLanguage } = useUIStore.getState();
    const needsLocal = locations.filter((l) => (force || !l.nameLocal) && !l.isWaypoint);
    if (needsLocal.length === 0) return;

    const updates = await Promise.all(
      needsLocal.map(async (loc) => {
        try {
          const res = await fetch(
            `/api/geocode?q=${encodeURIComponent(loc.name)}&language=${localLanguage}`,
          );
          const data = await res.json();
          const nameLocal =
            data.features?.[0]?.text ||
            data.features?.[0]?.place_name ||
            undefined;
          return { id: loc.id, nameLocal };
        } catch (error) {
          console.error(`Failed to enrich local name for ${loc.name}.`, error);
          return { id: loc.id, nameLocal: undefined };
        }
      }),
    );

    set((state) => ({
      locations: state.locations.map((loc) => {
        const update = updates.find((u) => u.id === loc.id);
        return update?.nameLocal ? { ...loc, nameLocal: update.nameLocal } : loc;
      }),
    }));
  },

  // -------------------------------------------------------------------------
  // Multi-project operations
  // -------------------------------------------------------------------------

  createNewProject: async (name) =>
    runProjectTransition("create a new project", async () => {
      cancelPendingPersist();

      const state = get();
      if (state.currentProjectId) {
        await persistCurrentProject(state);
      }

      const id = crypto.randomUUID();
      const projectName = name ?? DEFAULT_ROUTE_NAME;
      const now = Date.now();
      const meta: ProjectMeta = {
        id,
        name: projectName,
        createdAt: now,
        updatedAt: now,
        locationCount: 0,
        previewLocations: [],
      };
      const data = createEmptyProjectData(projectName);

      await saveProject(meta, data);
      const projects = await listProjectsFromDB();

      clearDirtyTracking();
      diffCheckDisabled = false;
      set({
        currentProjectId: id,
        currentProjectName: projectName,
        projects,
        locations: [],
        segments: [],
        mapStyle: DEFAULT_MAP_STYLE,
        segmentTimingOverrides: {},
        segmentColors: {},
      });
      tryUpdateLastSavedJson(data);
      useHistoryStore.getState().resetHistory();

      return id;
    }),

  switchProject: async (projectId) =>
    runProjectTransition("switch projects", async () => {
      const state = get();
      if (state.currentProjectId === projectId) return;

      cancelPendingPersist();

      if (state.currentProjectId) {
        await persistCurrentProject(state);
      }

      const projects = await listProjectsFromDB();
      const meta = projects.find((project) => project.id === projectId);
      if (!meta) {
        throw new Error(`Project ${projectId} does not exist.`);
      }

      const data = await ensureProjectData(projectId, meta.name);
      const parsed = parseImportedProjectData(data);

      clearDirtyTracking();
      applyImportedUISettings(parsed.uiSettings);
      set({
        currentProjectId: projectId,
        currentProjectName: meta.name ?? parsed.name ?? DEFAULT_ROUTE_NAME,
        projects,
        locations: parsed.locations,
        segments: parsed.segments,
        mapStyle: parsed.mapStyle,
        segmentTimingOverrides: parsed.segmentTimingOverrides,
        segmentColors: {},
      });
      tryUpdateLastSavedJson(data);

      // Register photo URLs for undo/redo
      registerPhotoUrls(parsed.locations);

      useHistoryStore.getState().resetHistory();

      await get().regenerateSegmentGeometries();
      void runBackgroundPhotoCompression().catch((error) => {
        console.error("Failed to compress switched project photos.", error);
      });
    }),

  deleteCurrentProject: async () =>
    runProjectTransition("delete the current project", async () => {
      cancelPendingPersist();

      const { currentProjectId } = get();
      if (!currentProjectId) return;

      await deleteProjectFromDB(currentProjectId);

      let projects = await listProjectsFromDB();
      if (projects.length === 0) {
        const id = crypto.randomUUID();
        const now = Date.now();
        const meta: ProjectMeta = {
          id,
          name: DEFAULT_ROUTE_NAME,
          createdAt: now,
          updatedAt: now,
          locationCount: 0,
          previewLocations: [],
        };
        const data = createEmptyProjectData(DEFAULT_ROUTE_NAME);
        await saveProject(meta, data);
        projects = await listProjectsFromDB();

        clearDirtyTracking();
        set({
          currentProjectId: id,
          currentProjectName: DEFAULT_ROUTE_NAME,
          projects,
          locations: [],
          segments: [],
          mapStyle: DEFAULT_MAP_STYLE,
          segmentTimingOverrides: {},
          segmentColors: {},
        });
        tryUpdateLastSavedJson(data);
        useHistoryStore.getState().resetHistory();
        return;
      }

      const nextProject = projects[0];
      const data = await ensureProjectData(nextProject.id, nextProject.name);
      const parsed = parseImportedProjectData(data);

      clearDirtyTracking();
      applyImportedUISettings(parsed.uiSettings);
      set({
        currentProjectId: nextProject.id,
        currentProjectName: nextProject.name,
        projects,
        locations: parsed.locations,
        segments: parsed.segments,
        mapStyle: parsed.mapStyle,
        segmentTimingOverrides: parsed.segmentTimingOverrides,
        segmentColors: {},
      });
      tryUpdateLastSavedJson(data);
      useHistoryStore.getState().resetHistory();

      await get().regenerateSegmentGeometries();
    }),

  deleteProjectById: async (projectId) => {
    try {
      const { currentProjectId } = get();

      if (projectId === currentProjectId) {
        await get().deleteCurrentProject();
        return;
      }

      await deleteProjectFromDB(projectId);
      const projects = await listProjectsFromDB();
      set({ projects });
    } catch (error) {
      console.error(`Failed to delete project ${projectId}.`, error);
      throw error;
    }
  },

  renameCurrentProject: async (name) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    try {
      await renameProjectInDB(currentProjectId, name);
      set({ currentProjectName: name });

      const projects = await listProjectsFromDB();
      set({ projects });
    } catch (error) {
      console.error(`Failed to rename project ${currentProjectId}.`, error);
      throw error;
    }
  },

  renameProjectById: async (projectId, name) => {
    try {
      await renameProjectInDB(projectId, name);

      const { currentProjectId } = get();
      if (projectId === currentProjectId) {
        set({ currentProjectName: name });
      }

      const projects = await listProjectsFromDB();
      set({ projects });
    } catch (error) {
      console.error(`Failed to rename project ${projectId}.`, error);
      throw error;
    }
  },

  duplicateProjectById: async (projectId) => {
    try {
      const newId = crypto.randomUUID();
      const projects = get().projects;
      const source = projects.find((project) => project.id === projectId);
      const newName = source ? `${source.name} (copy)` : "Copy";

      const newMeta = await duplicateProjectInDB(projectId, newId, newName);
      if (!newMeta) return null;

      const refreshed = await listProjectsFromDB();
      set({ projects: refreshed });
      return newMeta;
    } catch (error) {
      console.error(`Failed to duplicate project ${projectId}.`, error);
      throw error;
    }
  },

  refreshProjectList: async () => {
    try {
      const projects = await listProjectsFromDB();
      set({ projects });
    } catch (error) {
      console.error("Failed to refresh project list.", error);
      throw error;
    }
  },
}));

// ---------------------------------------------------------------------------
// Helper: persist current in-memory project to IndexedDB
// ---------------------------------------------------------------------------

async function persistCurrentProject(state: ProjectState): Promise<void> {
  await persistProjectSnapshot(state);
}

// ---------------------------------------------------------------------------
// Persistence initializer — subscribes to store changes and auto-saves
// ---------------------------------------------------------------------------

interface ProjectPersistenceOptions {
  skipRestore?: boolean;
}

export function initializeProjectPersistence(
  options: ProjectPersistenceOptions = {},
): void {
  if (!isBrowser() || persistenceInitialized) return;

  persistenceInitialized = true;

  useProjectStore.subscribe((state) => {
    if (persistSuspended) {
      return;
    }

    if (skipNextPersist) {
      skipNextPersist = false;
      return;
    }

    if (!state.currentProjectId) return;

    cancelPendingPersist();
    const saveVersion = nextProjectSaveVersion(state.currentProjectId);

    persistTimeout = setTimeout(async () => {
      try {
        await persistProjectSnapshot(state, saveVersion);
      } catch (error) {
        console.error("Failed to autosave project state.", error);
      }
    }, PROJECT_SAVE_DEBOUNCE_MS);
  });

  if (!options.skipRestore) {
    void useProjectStore.getState().restorePersistedProject();
  }
}
