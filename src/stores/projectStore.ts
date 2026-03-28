import { create } from "zustand";
import type {
  Location,
  Segment,
  Photo,
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
    photos?: { url: string; caption?: string }[];
  }[];
  segments: { fromIndex: number; toIndex: number; transportMode: TransportMode }[];
}

interface ProjectState {
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;

  addLocation: (location: Omit<Location, "id" | "photos" | "isWaypoint">) => void;
  removeLocation: (id: string) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;
  updateLocation: (id: string, updates: Partial<Pick<Location, "name" | "coordinates">>) => void;
  toggleWaypoint: (locationId: string) => void;

  setTransportMode: (segmentId: string, mode: TransportMode) => void;
  setSegmentGeometry: (segmentId: string, geometry: GeoJSON.LineString) => void;

  addPhoto: (locationId: string, photo: Omit<Photo, "id" | "locationId">) => void;
  removePhoto: (locationId: string, photoId: string) => void;

  setMapStyle: (style: MapStyle) => void;
  clearRoute: () => void;
  importRoute: (data: ImportRouteData) => void;
  enrichChineseNames: () => Promise<void>;
  exportRoute: () => Promise<ImportRouteData>;
}

let nextId = 1;
const generateId = () => String(nextId++);

function rebuildSegments(
  locations: Location[],
  oldSegments: Segment[]
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
  mapStyle: "light",

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
        l.id === id ? { ...l, ...updates } : l
      ),
    })),

  toggleWaypoint: (locationId) =>
    set((state) => {
      const idx = state.locations.findIndex((l) => l.id === locationId);
      // First and last locations can never be waypoints
      if (idx <= 0 || idx >= state.locations.length - 1) return state;
      return {
        locations: state.locations.map((l) =>
          l.id === locationId ? { ...l, isWaypoint: !l.isWaypoint } : l
        ),
      };
    }),

  setTransportMode: (segmentId, mode) =>
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === segmentId
          ? { ...s, transportMode: mode, geometry: null }
          : s
      ),
    })),

  setSegmentGeometry: (segmentId, geometry) =>
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, geometry } : s
      ),
    })),

  addPhoto: (locationId, photo) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              photos: [
                ...l.photos,
                { ...photo, id: generateId(), locationId },
              ],
            }
          : l
      ),
    })),

  removePhoto: (locationId, photoId) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === locationId
          ? { ...l, photos: l.photos.filter((p) => p.id !== photoId) }
          : l
      ),
    })),

  setMapStyle: (style) => set({ mapStyle: style }),

  clearRoute: () => set({ locations: [], segments: [] }),

  exportRoute: async () => {
    const { locations, segments } = get();

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
          }))
        );
        return {
          name: loc.name,
          nameZh: loc.nameZh,
          coordinates: loc.coordinates as [number, number],
          isWaypoint: loc.isWaypoint ?? false,
          ...(photos.length > 0 ? { photos } : {}),
        };
      })
    );

    return {
      name: "My Trip",
      locations: exportedLocations,
      segments: segments.map((seg) => ({
        fromIndex: locations.findIndex((l) => l.id === seg.fromId),
        toIndex: locations.findIndex((l) => l.id === seg.toId),
        transportMode: seg.transportMode,
      })),
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
        }));
        return {
          id: locId,
          name: loc.name,
          nameZh: loc.nameZh,
          coordinates: loc.coordinates,
          photos,
          isWaypoint: i > 0 && i < data.locations.length - 1 && (loc.isWaypoint ?? false),
        };
      });

      const segments: Segment[] = data.segments.map((seg) => ({
        id: generateId(),
        fromId: locations[seg.fromIndex].id,
        toId: locations[seg.toIndex].id,
        transportMode: seg.transportMode,
        geometry: null,
      }));

      return { locations, segments };
    }),

  enrichChineseNames: async () => {
    const { locations } = get();
    const needsZh = locations.filter((l) => !l.nameZh && !l.isWaypoint);
    if (needsZh.length === 0) return;

    const updates = await Promise.all(
      needsZh.map(async (loc) => {
        try {
          // Forward geocode English name → Chinese: more reliable than reverse geocode
          // which returns the nearest place at a finer granularity (e.g. district instead of city)
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(loc.name)}&language=zh`);
          const data = await res.json();
          const nameZh = data.features?.[0]?.text || data.features?.[0]?.place_name || undefined;
          return { id: loc.id, nameZh };
        } catch {
          return { id: loc.id, nameZh: undefined };
        }
      })
    );

    set((state) => ({
      locations: state.locations.map((loc) => {
        const update = updates.find((u) => u.id === loc.id);
        return update?.nameZh ? { ...loc, nameZh: update.nameZh } : loc;
      }),
    }));
  },
}));
