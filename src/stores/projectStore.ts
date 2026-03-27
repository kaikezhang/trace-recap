import { create } from "zustand";
import type {
  Location,
  Segment,
  Photo,
  TransportMode,
  MapStyle,
} from "@/types";

interface ProjectState {
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;

  addLocation: (location: Omit<Location, "id" | "photos">) => void;
  removeLocation: (id: string) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;
  updateLocation: (id: string, updates: Partial<Pick<Location, "name" | "coordinates">>) => void;

  setTransportMode: (segmentId: string, mode: TransportMode) => void;
  setSegmentGeometry: (segmentId: string, geometry: GeoJSON.LineString) => void;

  addPhoto: (locationId: string, photo: Omit<Photo, "id" | "locationId">) => void;
  removePhoto: (locationId: string, photoId: string) => void;

  setMapStyle: (style: MapStyle) => void;
  clearRoute: () => void;
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
    const existing = segmentMap.get(`${fromId}-${toId}`);
    if (existing) {
      segments.push(existing);
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

export const useProjectStore = create<ProjectState>((set) => ({
  locations: [],
  segments: [],
  mapStyle: "light",

  addLocation: (loc) =>
    set((state) => {
      const newLocation: Location = {
        id: generateId(),
        name: loc.name,
        coordinates: loc.coordinates,
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
}));
