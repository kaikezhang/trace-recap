import { create } from "zustand";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import type {
  Location,
  Segment,
  Photo,
  PhotoLayout,
  TransportMode,
  TransportIconStyle,
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
  listProjects as listProjectsFromDB,
  deleteProject as deleteProjectFromDB,
  renameProject as renameProjectInDB,
  duplicateProject as duplicateProjectInDB,
  migrateFromLocalStorage,
  putProjectMeta,
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
  }[];
  segments: {
    fromIndex: number;
    toIndex: number;
    transportMode: TransportMode;
    iconStyle?: TransportIconStyle;
  }[];
  timingOverrides?: Record<string, number>;
  mapStyle?: MapStyle;
}

type PersistedProjectData = ImportRouteData;

const DEFAULT_ROUTE_NAME = "My Trip";
const DEFAULT_MAP_STYLE: MapStyle = "light";
const PROJECT_SAVE_DEBOUNCE_MS = 500;

interface ProjectState {
  // Multi-project state
  currentProjectId: string | null;
  currentProjectName: string;
  projects: ProjectMeta[];

  // Current project data
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
  segmentTimingOverrides: Record<string, number>;

  // Location CRUD
  addLocation: (
    location: Omit<Location, "id" | "photos" | "isWaypoint">,
  ) => void;
  removeLocation: (id: string) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;
  updateLocation: (
    id: string,
    updates: Partial<Pick<Location, "name" | "nameZh" | "coordinates">>,
  ) => void;
  toggleWaypoint: (locationId: string) => void;

  // Segment operations
  setTransportMode: (segmentId: string, mode: TransportMode) => void;
  setSegmentIconStyle: (
    segmentId: string,
    iconStyle: TransportIconStyle,
  ) => void;
  setSegmentGeometry: (segmentId: string, geometry: GeoJSON.LineString) => void;
  setSegmentTiming: (segmentId: string, duration: number | null) => void;
  clearAllTimingOverrides: () => void;

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
let lastSavedProjectJson = "";

const generateId = () => String(nextId++);

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Convert a blob: URL to a data: URL for persistence */
async function blobUrlToDataUrl(url: string): Promise<string> {
  if (!url.startsWith("blob:")) return url;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function serializeProjectState(
  locations: Location[],
  segments: Segment[],
  mapStyle: MapStyle,
  segmentTimingOverrides: Record<string, number>,
  name?: string,
): Promise<PersistedProjectData> {
  const exportedLocations = await Promise.all(locations.map(async (loc) => ({
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
  })));

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

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectId: null,
  currentProjectName: DEFAULT_ROUTE_NAME,
  projects: [],

  locations: [],
  segments: [],
  mapStyle: DEFAULT_MAP_STYLE,
  segmentTimingOverrides: {},

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
        s.id === segmentId ? { ...s, transportMode: mode, geometry: null } : s,
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

  addPhoto: (locationId, photo) => {
    useHistoryStore.getState().pushState();
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
    return set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? { ...l, photos: l.photos.filter((p) => p.id !== photoId) }
          : l,
      ),
    }));
  },

  setPhotoLayout: (locationId, layout) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId ? { ...l, photoLayout: layout } : l,
      ),
    })),

  setPhotoFocalPoint: (locationId, photoId, point) =>
    set((state) => ({
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
    })),

  setMapStyle: (style) => set({ mapStyle: style }),

  clearRoute: () => {
    useHistoryStore.getState().pushState();
    if (isBrowser()) {
      if (persistTimeout) {
        clearTimeout(persistTimeout);
        persistTimeout = null;
      }
      skipNextPersist = true;
    }

    set({
      locations: [],
      segments: [],
      mapStyle: DEFAULT_MAP_STYLE,
      segmentTimingOverrides: {},
    });

    // Persist cleared state to IndexedDB immediately so reload doesn't resurrect old data
    const { currentProjectId, currentProjectName } = get();
    if (currentProjectId) {
      void serializeProjectState([], [], DEFAULT_MAP_STYLE, {}, currentProjectName).then((data) => {
        const meta = buildProjectMeta(currentProjectId, currentProjectName, []);
        void saveProject(meta, data).then(() => {
          lastSavedProjectJson = JSON.stringify(data);
        });
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
    useHistoryStore.getState().pushState();
    return set(() => {
      const locations: Location[] = data.locations.map((loc, i) => {
        const locId = generateId();
        const photos = (loc.photos ?? []).map((p) => ({
          id: generateId(),
          locationId: locId,
          url: p.url,
          caption: p.caption,
          ...(p.focalPoint ? { focalPoint: p.focalPoint } : {}),
        }));
        return {
          id: locId,
          name: loc.name,
          nameZh: loc.nameZh,
          coordinates: loc.coordinates,
          photos,
          isWaypoint:
            i > 0 && i < data.locations.length - 1 && (loc.isWaypoint ?? false),
          ...(loc.photoLayout
            ? {
                photoLayout: {
                  ...loc.photoLayout,
                  // Order was exported as index strings — remap to new photo IDs
                  order: loc.photoLayout.order
                    ? loc.photoLayout.order
                        .map((idxStr) => photos[parseInt(idxStr, 10)]?.id)
                        .filter(Boolean)
                    : undefined,
                },
              }
            : {}),
        };
      });

      const segments: Segment[] = data.segments.map((seg) => ({
        id: generateId(),
        fromId: locations[seg.fromIndex].id,
        toId: locations[seg.toIndex].id,
        transportMode: seg.transportMode,
        iconStyle: resolveTransportIconStyle(seg.iconStyle),
        geometry: null,
      }));

      // Remap timing overrides from segment indices to new segment IDs
      const segmentTimingOverrides: Record<string, number> = {};
      if (data.timingOverrides) {
        for (const [key, duration] of Object.entries(data.timingOverrides)) {
          const idx = parseInt(key, 10);
          if (!isNaN(idx) && idx >= 0 && idx < segments.length) {
            segmentTimingOverrides[segments[idx].id] = duration;
          }
        }
      }

      return {
        locations,
        segments,
        mapStyle: data.mapStyle ?? DEFAULT_MAP_STYLE,
        segmentTimingOverrides,
      };
    });
  },

  loadRouteData: async (data) => {
    get().importRoute(data);
    await get().regenerateSegmentGeometries();
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
        } catch {
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

    // Migrate legacy localStorage data to IndexedDB
    const migratedId = await migrateFromLocalStorage();

    // Load project list
    const projects = await listProjectsFromDB();
    set({ projects });

    // Determine which project to load
    let targetId = migratedId ?? projects[0]?.id ?? null;

    // Fresh start — create a default project
    if (!targetId) {
      targetId = await get().createNewProject();
      return;
    }

    const data = await getProjectData(targetId);
    if (!data) return;

    const meta = projects.find((p) => p.id === targetId);
    set({
      currentProjectId: targetId,
      currentProjectName: meta?.name ?? data.name ?? DEFAULT_ROUTE_NAME,
    });

    await get().loadRouteData(data);
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
        } catch {
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

  createNewProject: async (name) => {
    // Kill any pending debounce from the old project immediately
    if (persistTimeout) {
      clearTimeout(persistTimeout);
      persistTimeout = null;
    }

    // Save current project first
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

    const data: ImportRouteData = {
      name: projectName,
      locations: [],
      segments: [],
      mapStyle: DEFAULT_MAP_STYLE,
    };

    await saveProject(meta, data);
    // Clear current state and switch to new project
    skipNextPersist = true;
    set({
      currentProjectId: id,
      currentProjectName: projectName,
      locations: [],
      segments: [],
      mapStyle: DEFAULT_MAP_STYLE,
      segmentTimingOverrides: {},
    });
    lastSavedProjectJson = "";

    // Reset history to prevent cross-project undo/redo
    useHistoryStore.getState().resetHistory();

    // Refresh project list
    const projects = await listProjectsFromDB();
    set({ projects });

    return id;
  },

  switchProject: async (projectId) => {
    const state = get();
    if (state.currentProjectId === projectId) return;

    // Kill any pending debounce from the old project immediately
    if (persistTimeout) {
      clearTimeout(persistTimeout);
      persistTimeout = null;
    }

    // Save current project first
    if (state.currentProjectId) {
      await persistCurrentProject(state);
    }

    // Load the target project
    const data = await getProjectData(projectId);
    if (!data) return;

    const projects = await listProjectsFromDB();
    const meta = projects.find((p) => p.id === projectId);
    skipNextPersist = true;
    set({
      currentProjectId: projectId,
      currentProjectName: meta?.name ?? data.name ?? DEFAULT_ROUTE_NAME,
      locations: [],
      segments: [],
      mapStyle: DEFAULT_MAP_STYLE,
      segmentTimingOverrides: {},
      projects,
    });
    lastSavedProjectJson = "";

    // Reset history to prevent cross-project undo/redo
    useHistoryStore.getState().resetHistory();
    await get().loadRouteData(data);
  },

  deleteCurrentProject: async () => {
    // Kill any pending debounce from the old project immediately
    if (persistTimeout) {
      clearTimeout(persistTimeout);
      persistTimeout = null;
    }

    const { currentProjectId } = get();
    if (!currentProjectId) return;

    await deleteProjectFromDB(currentProjectId);
    const projects = await listProjectsFromDB();

    if (projects.length > 0) {
      // Switch to the most recent project
      const nextProject = projects[0];
      const data = await getProjectData(nextProject.id);

      skipNextPersist = true;
      set({
        currentProjectId: nextProject.id,
        currentProjectName: nextProject.name,
        locations: [],
        segments: [],
        mapStyle: DEFAULT_MAP_STYLE,
        segmentTimingOverrides: {},
        projects,
      });
      lastSavedProjectJson = "";

      // Reset history to prevent cross-project undo/redo
      useHistoryStore.getState().resetHistory();

      if (data) {
        await get().loadRouteData(data);
      }
    } else {
      // No projects left — create a fresh one
      skipNextPersist = true;
      set({
        currentProjectId: null,
        currentProjectName: DEFAULT_ROUTE_NAME,
        locations: [],
        segments: [],
        mapStyle: DEFAULT_MAP_STYLE,
        segmentTimingOverrides: {},
        projects: [],
      });
      lastSavedProjectJson = "";

      // Reset history to prevent cross-project undo/redo
      useHistoryStore.getState().resetHistory();
      await get().createNewProject();
    }
  },

  deleteProjectById: async (projectId) => {
    const { currentProjectId } = get();

    if (projectId === currentProjectId) {
      await get().deleteCurrentProject();
      return;
    }

    await deleteProjectFromDB(projectId);
    const projects = await listProjectsFromDB();
    set({ projects });
  },

  renameCurrentProject: async (name) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    await renameProjectInDB(currentProjectId, name);
    set({ currentProjectName: name });

    const projects = await listProjectsFromDB();
    set({ projects });
  },

  renameProjectById: async (projectId, name) => {
    await renameProjectInDB(projectId, name);

    const { currentProjectId } = get();
    if (projectId === currentProjectId) {
      set({ currentProjectName: name });
    }

    const projects = await listProjectsFromDB();
    set({ projects });
  },

  duplicateProjectById: async (projectId) => {
    const newId = crypto.randomUUID();
    const projects = get().projects;
    const source = projects.find((p) => p.id === projectId);
    const newName = source ? `${source.name} (copy)` : "Copy";

    const newMeta = await duplicateProjectInDB(projectId, newId, newName);
    if (!newMeta) return null;

    const refreshed = await listProjectsFromDB();
    set({ projects: refreshed });
    return newMeta;
  },

  refreshProjectList: async () => {
    const projects = await listProjectsFromDB();
    set({ projects });
  },
}));

// ---------------------------------------------------------------------------
// Helper: persist current in-memory project to IndexedDB
// ---------------------------------------------------------------------------

async function persistCurrentProject(state: ProjectState): Promise<void> {
  const { currentProjectId, currentProjectName, locations, segments, mapStyle, segmentTimingOverrides } = state;
  if (!currentProjectId) return;

  const data = await serializeProjectState(locations, segments, mapStyle, segmentTimingOverrides, currentProjectName);
  const meta = buildProjectMeta(currentProjectId, currentProjectName, locations);

  await saveProject(meta, data);
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
    if (skipNextPersist) {
      skipNextPersist = false;
      return;
    }

    if (!state.currentProjectId) return;

    if (persistTimeout) {
      clearTimeout(persistTimeout);
    }

    persistTimeout = setTimeout(async () => {
      const projectId = state.currentProjectId;
      if (!projectId) return;

      const nextProjectJson = JSON.stringify(
        await serializeProjectState(
          state.locations,
          state.segments,
          state.mapStyle,
          state.segmentTimingOverrides,
          state.currentProjectName,
        ),
      );

      if (nextProjectJson === lastSavedProjectJson) {
        return;
      }

      const data = await serializeProjectState(
        state.locations,
        state.segments,
        state.mapStyle,
        state.segmentTimingOverrides,
        state.currentProjectName,
      );

      const meta = buildProjectMeta(
        projectId,
        state.currentProjectName,
        state.locations,
      );

      void saveProject(meta, data).then(() => {
        lastSavedProjectJson = nextProjectJson;
        // Refresh the project list metadata in the store
        void listProjectsFromDB().then((projects) => {
          // Only update if we still have same projectId to avoid races
          if (useProjectStore.getState().currentProjectId === projectId) {
            useProjectStore.setState({ projects });
          }
        });
      });
    }, PROJECT_SAVE_DEBOUNCE_MS);
  });

  if (!options.skipRestore) {
    void useProjectStore.getState().restorePersistedProject();
  }
}
