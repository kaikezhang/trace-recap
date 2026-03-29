import { create } from "zustand";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import type {
  Location,
  Segment,
  Photo,
  PhotoLayout,
  TransportMode,
  MapStyle,
} from "@/types";

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
  }[];
  timingOverrides?: Record<string, number>;
  mapStyle?: MapStyle;
}

type PersistedProjectData = ImportRouteData;

const DEFAULT_ROUTE_NAME = "My Trip";
const DEFAULT_MAP_STYLE: MapStyle = "light";
const PROJECT_STORAGE_KEY = "trace-recap-project";
const PROJECT_SAVE_DEBOUNCE_MS = 500;

interface ProjectState {
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
  segmentTimingOverrides: Record<string, number>;

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

  setTransportMode: (segmentId: string, mode: TransportMode) => void;
  setSegmentGeometry: (segmentId: string, geometry: GeoJSON.LineString) => void;

  setSegmentTiming: (segmentId: string, duration: number | null) => void;
  clearAllTimingOverrides: () => void;

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

  setMapStyle: (style: MapStyle) => void;
  clearRoute: () => void;
  importRoute: (data: ImportRouteData) => void;
  loadRouteData: (data: ImportRouteData) => Promise<void>;
  regenerateSegmentGeometries: () => Promise<void>;
  restorePersistedProject: () => Promise<void>;
  enrichChineseNames: () => Promise<void>;
  exportRoute: () => Promise<ImportRouteData>;
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

function serializeProjectState(
  locations: Location[],
  segments: Segment[],
  mapStyle: MapStyle,
  segmentTimingOverrides: Record<string, number>,
): PersistedProjectData {
  const exportedLocations = locations.map((loc) => ({
    name: loc.name,
    nameZh: loc.nameZh,
    coordinates: loc.coordinates as [number, number],
    isWaypoint: loc.isWaypoint ?? false,
    ...(loc.photos.length > 0
      ? {
          photos: loc.photos.map((photo) => ({
            url: photo.url,
            caption: photo.caption,
            ...(photo.focalPoint ? { focalPoint: photo.focalPoint } : {}),
          })),
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
  }));

  return {
    name: DEFAULT_ROUTE_NAME,
    mapStyle,
    locations: exportedLocations,
    segments: segments.map((segment) => ({
      fromIndex: locations.findIndex(
        (location) => location.id === segment.fromId,
      ),
      toIndex: locations.findIndex((location) => location.id === segment.toId),
      transportMode: segment.transportMode,
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
        // Keep geometry only if direction unchanged; reversed needs re-fetch
        geometry: forward ? existing.geometry : null,
      });
    } else {
      segments.push({
        id: generateId(),
        fromId,
        toId,
        transportMode: "flight",
        geometry: null,
      });
    }
  }
  return segments;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  locations: [],
  segments: [],
  mapStyle: DEFAULT_MAP_STYLE,
  segmentTimingOverrides: {},

  addLocation: (loc) =>
    set((state) => {
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
    }),

  removeLocation: (id) =>
    set((state) => {
      const locations = state.locations.filter((l) => l.id !== id);
      // Ensure first and last locations are never waypoints
      if (locations.length > 0) {
        locations[0] = { ...locations[0], isWaypoint: false };
      }
      return {
        locations,
        segments: rebuildSegments(locations, state.segments),
      };
    }),

  reorderLocations: (fromIndex, toIndex) =>
    set((state) => {
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
    }),

  updateLocation: (id, updates) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === id ? { ...l, ...updates } : l,
      ),
    })),

  toggleWaypoint: (locationId) =>
    set((state) => {
      const idx = state.locations.findIndex((l) => l.id === locationId);
      // First and last locations can never be waypoints
      if (idx <= 0 || idx >= state.locations.length - 1) return state;
      return {
        locations: state.locations.map((l) =>
          l.id === locationId ? { ...l, isWaypoint: !l.isWaypoint } : l,
        ),
      };
    }),

  setTransportMode: (segmentId, mode) =>
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, transportMode: mode, geometry: null } : s,
      ),
    })),

  setSegmentGeometry: (segmentId, geometry) =>
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, geometry } : s,
      ),
    })),

  setSegmentTiming: (segmentId, duration) =>
    set((state) => {
      const overrides = { ...state.segmentTimingOverrides };
      if (duration === null) {
        delete overrides[segmentId];
      } else {
        overrides[segmentId] = duration;
      }
      return { segmentTimingOverrides: overrides };
    }),

  clearAllTimingOverrides: () => set({ segmentTimingOverrides: {} }),

  addPhoto: (locationId, photo) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              photos: [...l.photos, { ...photo, id: generateId(), locationId }],
            }
          : l,
      ),
    })),

  removePhoto: (locationId, photoId) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? { ...l, photos: l.photos.filter((p) => p.id !== photoId) }
          : l,
      ),
    })),

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
    if (isBrowser()) {
      if (persistTimeout) {
        clearTimeout(persistTimeout);
        persistTimeout = null;
      }
      skipNextPersist = true;
      window.localStorage.removeItem(PROJECT_STORAGE_KEY);
      lastSavedProjectJson = "";
    }

    set({
      locations: [],
      segments: [],
      mapStyle: DEFAULT_MAP_STYLE,
      segmentTimingOverrides: {},
    });
  },

  exportRoute: async () => {
    const { locations, segments, mapStyle, segmentTimingOverrides } = get();

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
      name: DEFAULT_ROUTE_NAME,
      mapStyle,
      locations: exportedLocations,
      segments: segments.map((seg) => ({
        fromIndex: locations.findIndex((l) => l.id === seg.fromId),
        toIndex: locations.findIndex((l) => l.id === seg.toId),
        transportMode: seg.transportMode,
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

  importRoute: (data) =>
    set(() => {
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
    }),

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

    const savedProject = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!savedProject) return;

    try {
      const data = JSON.parse(savedProject) as PersistedProjectData;
      await get().loadRouteData(data);
    } catch {
      window.localStorage.removeItem(PROJECT_STORAGE_KEY);
      lastSavedProjectJson = "";
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
            `/api/geocode?q=${encodeURIComponent(loc.name)}&language=zh`,
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
}));

export function initializeProjectPersistence(): void {
  if (!isBrowser() || persistenceInitialized) return;

  persistenceInitialized = true;
  lastSavedProjectJson = window.localStorage.getItem(PROJECT_STORAGE_KEY) ?? "";

  useProjectStore.subscribe((state) => {
    if (skipNextPersist) {
      skipNextPersist = false;
      return;
    }

    if (persistTimeout) {
      clearTimeout(persistTimeout);
    }

    persistTimeout = setTimeout(() => {
      const nextProjectJson = JSON.stringify(
        serializeProjectState(
          state.locations,
          state.segments,
          state.mapStyle,
          state.segmentTimingOverrides,
        ),
      );

      if (nextProjectJson === lastSavedProjectJson) {
        return;
      }

      window.localStorage.setItem(PROJECT_STORAGE_KEY, nextProjectJson);
      lastSavedProjectJson = nextProjectJson;
    }, PROJECT_SAVE_DEBOUNCE_MS);
  });

  void useProjectStore.getState().restorePersistedProject();
}
