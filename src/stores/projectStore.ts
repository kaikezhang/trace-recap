import { create } from "zustand";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import type {
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
import { useHistoryStore } from "./historyStore";
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

export interface ImportRouteData {
  name: string;
  locations: {
    name: string;
    nameZh?: string;
    coordinates: [number, number];
    isWaypoint?: boolean;
    photos?: {
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
  removeLocation: (id: string) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;
  updateLocation: (
    id: string,
    updates: Partial<Pick<Location, "name" | "nameZh" | "coordinates" | "chapterTitle" | "chapterNote" | "chapterDate" | "chapterEmoji">>,
  ) => void;
  toggleWaypoint: (locationId: string) => void;

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
  ) => void;
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
  enrichChineseNames: () => Promise<void>;
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
let saveCommitChain: Promise<void> = Promise.resolve();
const projectSaveVersions = new Map<string, number>();

const VALID_TRANSPORT_MODES: TransportMode[] = [
  "flight",
  "car",
  "train",
  "bus",
  "ferry",
  "walk",
  "bicycle",
];

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

/** Convert a blob: URL to a data: URL for persistence (cached) */
async function blobUrlToDataUrl(url: string): Promise<string> {
  if (!url.startsWith("blob:")) return url;
  const cached = blobToDataUrlCache.get(url);
  if (cached) return cached;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    blobToDataUrlCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return url;
  }
}

async function serializeLocation(loc: Location): Promise<SerializedLocation> {
  return {
    name: loc.name,
    nameZh: loc.nameZh,
    coordinates: loc.coordinates as [number, number],
    isWaypoint: loc.isWaypoint ?? false,
    ...(loc.photos.length > 0
      ? {
          photos: await Promise.all(loc.photos.map(async (photo) => ({
            url: await blobUrlToDataUrl(photo.url),
            caption: photo.caption,
            ...(photo.focalPoint ? { focalPoint: photo.focalPoint } : {}),
          }))),
        }
      : {}),
    ...(loc.photoLayout
      ? {
          photoLayout: {
            ...loc.photoLayout,
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
        nameZh: loc.nameZh,
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
    locations: exportedLocations,
    segments: segments.map((segment) => ({
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
  };
}

interface ParsedProjectData {
  name: string;
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
  segmentTimingOverrides: Record<string, number>;
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

    const locationId = generateId();
    const photoInputs = Array.isArray(loc.photos) ? loc.photos : [];
    const photos: Photo[] = photoInputs.map((photo, photoIndex) => {
      if (!isObject(photo) || typeof photo.url !== "string") {
        throw new Error(
          `Invalid photo at location ${locationIndex}, photo ${photoIndex}.`,
        );
      }

      return {
        id: generateId(),
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

    const photoLayout = isObject(loc.photoLayout)
      ? {
          ...loc.photoLayout,
          order: Array.isArray(loc.photoLayout.order)
            ? loc.photoLayout.order
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
        }
      : undefined;

    return {
      id: locationId,
      name: loc.name,
      nameZh: typeof loc.nameZh === "string" ? loc.nameZh : undefined,
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
      id: generateId(),
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

async function queueProjectSave(
  projectId: string,
  saveVersion: number,
  meta: ProjectMeta,
  data: ImportRouteData,
  nextProjectJson: string,
): Promise<boolean> {
  let didSave = false;
  const saveTask = saveCommitChain
    .catch(() => undefined)
    .then(async () => {
      if (saveVersion !== getLatestProjectSaveVersion(projectId)) {
        return;
      }

      await saveProject(meta, data);
      didSave = true;

      if (useProjectStore.getState().currentProjectId === projectId) {
        lastSavedProjectJson = nextProjectJson;
      }

      const projects = await listProjectsFromDB();
      useProjectStore.setState({ projects });
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

  const nextProjectJson = JSON.stringify(data);
  if (
    currentProjectId === useProjectStore.getState().currentProjectId &&
    nextProjectJson === lastSavedProjectJson
  ) {
    return false;
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
    useHistoryStore.getState().pushState();
    return set((state) => {
      const newLocation: Location = {
        id: generateId(),
        name: loc.name,
        nameZh: loc.nameZh,
        coordinates: loc.coordinates,
        isWaypoint: false,
        photos: [],
      };
      const locations = [...state.locations, newLocation];
      return {
        locations,
        segments: rebuildSegments(locations, state.segments),
      };
    });
  },

  removeLocation: (id) => {
    useHistoryStore.getState().pushState();
    return set((state) => {
      const locations = state.locations.filter((l) => l.id !== id);
      // Ensure first and last locations are never waypoints
      if (locations.length > 0) {
        locations[0] = { ...locations[0], isWaypoint: false };
      }
      return {
        locations,
        segments: rebuildSegments(locations, state.segments),
      };
    });
  },

  reorderLocations: (fromIndex, toIndex) => {
    useHistoryStore.getState().pushState();
    return set((state) => {
      const locations = [...state.locations];
      const [moved] = locations.splice(fromIndex, 1);
      locations.splice(toIndex, 0, moved);
      // Ensure first and last locations are never waypoints
      if (locations.length > 0) {
        locations[0] = { ...locations[0], isWaypoint: false };
      }
      return {
        locations,
        segments: rebuildSegments(locations, state.segments),
      };
    });
  },

  updateLocation: (id, updates) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === id ? { ...l, ...updates } : l,
      ),
    })),

  toggleWaypoint: (locationId) => {
    useHistoryStore.getState().pushState();
    return set((state) => {
      const idx = state.locations.findIndex((l) => l.id === locationId);
      // First and last locations can never be waypoints
      if (idx <= 0 || idx >= state.locations.length - 1) return state;
      return {
        locations: state.locations.map((l) =>
          l.id === locationId ? { ...l, isWaypoint: !l.isWaypoint } : l,
        ),
      };
    });
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

  addPhoto: (locationId, photo) => {
    useHistoryStore.getState().pushState();
    markLocationDirty(locationId);
    return set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              photos: [...l.photos, { ...photo, id: generateId(), locationId }],
            }
          : l,
      ),
    }));
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

    // Convert blob URLs to base64 data URLs for persistence
    const toDataURL = async (url: string): Promise<string> => {
      if (url.startsWith("data:")) return url; // already base64
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        return url; // fallback to original
      }
    };

    const exportedLocations = await Promise.all(
      locations.map(async (loc) => {
        const photos = await Promise.all(
          loc.photos.map(async (p) => ({
            url: await toDataURL(p.url),
            caption: p.caption,
            ...(p.focalPoint ? { focalPoint: p.focalPoint } : {}),
          })),
        );
        return {
          name: loc.name,
          nameZh: loc.nameZh,
          coordinates: loc.coordinates as [number, number],
          isWaypoint: loc.isWaypoint ?? false,
          ...(photos.length > 0 ? { photos } : {}),
          ...(loc.photoLayout
            ? {
                photoLayout: {
                  ...loc.photoLayout,
                  // Convert order from photo IDs to indices for portable serialization
                  order: loc.photoLayout.order
                    ? loc.photoLayout.order
                        .map((id) => loc.photos.findIndex((p) => p.id === id))
                        .filter((idx) => idx >= 0)
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
      }),
    );

    return {
      name: currentProjectName,
      mapStyle,
      locations: exportedLocations,
      segments: segments.map((seg) => ({
        fromIndex: locations.findIndex((l) => l.id === seg.fromId),
        toIndex: locations.findIndex((l) => l.id === seg.toId),
        transportMode: seg.transportMode,
        iconStyle: seg.iconStyle,
        ...(seg.iconVariant ? { iconVariant: seg.iconVariant } : {}),
      })),
      ...(Object.keys(segmentTimingOverrides).length > 0
        ? {
            timingOverrides: Object.fromEntries(
              Object.entries(segmentTimingOverrides)
                .map(([segId, duration]) => {
                  const idx = segments.findIndex((s) => s.id === segId);
                  return idx >= 0 ? [String(idx), duration] : null;
                })
                .filter(Boolean) as [string, number][],
            ),
          }
        : {}),
    };
  },

  importRoute: (data) => {
    const parsed = parseImportedProjectData(data);
    useHistoryStore.getState().pushState();
    clearDirtyTracking();
    set({
      locations: parsed.locations,
      segments: parsed.segments,
      mapStyle: parsed.mapStyle,
      segmentTimingOverrides: parsed.segmentTimingOverrides,
      segmentColors: {},
    });
  },

  loadRouteData: async (data) => {
    try {
      // Ensure there's a project to save into
      if (!get().currentProjectId) {
        await get().createNewProject(data.name);
      }
      get().importRoute(data);
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
      lastSavedProjectJson = JSON.stringify(data);

      useHistoryStore.getState().resetHistory();
      await get().regenerateSegmentGeometries();
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

  enrichChineseNames: async () => {
    const { locations } = get();
    const needsZh = locations.filter((l) => !l.nameZh && !l.isWaypoint);
    if (needsZh.length === 0) return;

    const updates = await Promise.all(
      needsZh.map(async (loc) => {
        try {
          // Forward geocode English name → Chinese: more reliable than reverse geocode
          // which returns the nearest place at a finer granularity (e.g. district instead of city)
          const res = await fetch(
            `/api/geocode?q=${encodeURIComponent(loc.name)}&language=zh-Hans`,
          );
          const data = await res.json();
          const nameZh =
            data.features?.[0]?.text ||
            data.features?.[0]?.place_name ||
            undefined;
          return { id: loc.id, nameZh };
        } catch (error) {
          console.error(`Failed to enrich Chinese name for ${loc.name}.`, error);
          return { id: loc.id, nameZh: undefined };
        }
      }),
    );

    set((state) => ({
      locations: state.locations.map((loc) => {
        const update = updates.find((u) => u.id === loc.id);
        return update?.nameZh ? { ...loc, nameZh: update.nameZh } : loc;
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
      lastSavedProjectJson = JSON.stringify(data);
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
      lastSavedProjectJson = JSON.stringify(data);
      useHistoryStore.getState().resetHistory();

      await get().regenerateSegmentGeometries();
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
        lastSavedProjectJson = JSON.stringify(data);
        useHistoryStore.getState().resetHistory();
        return;
      }

      const nextProject = projects[0];
      const data = await ensureProjectData(nextProject.id, nextProject.name);
      const parsed = parseImportedProjectData(data);

      clearDirtyTracking();
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
      lastSavedProjectJson = JSON.stringify(data);
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
