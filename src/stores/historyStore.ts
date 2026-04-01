import { create } from "zustand";
import { useProjectStore, invalidateSerializationCache } from "./projectStore";
import type { Location, Segment, MapStyle, Photo } from "@/types";

/**
 * Lightweight photo shape that excludes the heavy `url` field.
 * Photo URLs (data: or blob:) can be megabytes each; cloning them into
 * every undo snapshot was the #1 cause of renderer-process OOM crashes
 * in Free-mode editing (Error code: 5).
 *
 * On restore we re-attach URLs from a shared registry that the project
 * store maintains — the binary data only exists once in memory.
 */
interface LightPhoto {
  id: string;
  locationId: string;
  caption?: string;
  focalPoint?: { x: number; y: number };
}

interface LightLocation {
  id: string;
  name: string;
  nameZh?: string;
  coordinates: [number, number];
  photos: LightPhoto[];
  isWaypoint: boolean;
  photoLayout?: Location["photoLayout"];
  chapterTitle?: string;
  chapterNote?: string;
  chapterDate?: string;
  chapterEmoji?: string;
}

interface HistorySnapshot {
  projectId: string | null;
  locations: LightLocation[];
  segments: Segment[];
  mapStyle: MapStyle;
  segmentTimingOverrides: Record<string, number>;
}

const MAX_HISTORY = 30;

interface HistoryState {
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: () => void;
  pushState: () => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Global registry mapping photo id → url.  Populated whenever photos are
 * loaded, added, or compressed.  Because photo URLs are immutable references
 * (blob: or data: strings), we never need to clone them — just keep the
 * latest pointer.  This lets undo/redo restore photos without duplicating
 * the heavy URL payload.
 */
const photoUrlRegistry = new Map<string, string>();

/** Call whenever photo URLs become known (load, add, compress-swap). */
export function registerPhotoUrl(photoId: string, url: string): void {
  photoUrlRegistry.set(photoId, url);
}

/** Bulk-register from a full locations array. */
export function registerPhotoUrls(locations: Location[]): void {
  for (const loc of locations) {
    for (const photo of loc.photos) {
      photoUrlRegistry.set(photo.id, photo.url);
    }
  }
}

/** Strip the heavy url field from a photo. */
function stripPhoto(photo: Photo): LightPhoto {
  return {
    id: photo.id,
    locationId: photo.locationId,
    ...(photo.caption != null ? { caption: photo.caption } : {}),
    ...(photo.focalPoint ? { focalPoint: { ...photo.focalPoint } } : {}),
  };
}

/** Strip photos from a location (shallow clone metadata, strip photo urls). */
function stripLocation(loc: Location): LightLocation {
  return {
    id: loc.id,
    name: loc.name,
    ...(loc.nameZh != null ? { nameZh: loc.nameZh } : {}),
    coordinates: [...loc.coordinates] as [number, number],
    photos: loc.photos.map(stripPhoto),
    isWaypoint: loc.isWaypoint,
    ...(loc.photoLayout ? { photoLayout: structuredClone(loc.photoLayout) } : {}),
    ...(loc.chapterTitle != null ? { chapterTitle: loc.chapterTitle } : {}),
    ...(loc.chapterNote != null ? { chapterNote: loc.chapterNote } : {}),
    ...(loc.chapterDate != null ? { chapterDate: loc.chapterDate } : {}),
    ...(loc.chapterEmoji != null ? { chapterEmoji: loc.chapterEmoji } : {}),
  };
}

/** Rehydrate a light location back into a full Location by restoring photo URLs. */
function rehydrateLocation(light: LightLocation): Location {
  return {
    ...light,
    photos: light.photos.map((lp) => ({
      ...lp,
      url: photoUrlRegistry.get(lp.id) ?? "",
    })),
  } as Location;
}

function captureSnapshot(): HistorySnapshot {
  const { currentProjectId, locations, segments, mapStyle, segmentTimingOverrides } =
    useProjectStore.getState();

  // Ensure the registry is up-to-date before snapshotting
  registerPhotoUrls(locations);

  return {
    projectId: currentProjectId,
    locations: locations.map(stripLocation),
    segments: structuredClone(segments),
    mapStyle,
    segmentTimingOverrides: { ...segmentTimingOverrides },
  };
}

function restoreSnapshot(snapshot: HistorySnapshot): void {
  useProjectStore.setState({
    locations: snapshot.locations.map(rehydrateLocation),
    segments: snapshot.segments,
    mapStyle: snapshot.mapStyle,
    segmentTimingOverrides: snapshot.segmentTimingOverrides,
  });
}

export const useHistoryStore = create<HistoryState>((set) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  resetHistory: () => {
    set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false });
  },

  pushState: () => {
    const snapshot = captureSnapshot();
    set((state) => {
      const undoStack = [...state.undoStack, snapshot].slice(-MAX_HISTORY);
      return { undoStack, redoStack: [], canUndo: true, canRedo: false };
    });
  },

  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return state;

      const current = captureSnapshot();
      const undoStack = [...state.undoStack];
      const snapshot = undoStack.pop()!;

      // Guard against cross-project corruption
      if (snapshot.projectId !== current.projectId) {
        return { undoStack: [], redoStack: [], canUndo: false, canRedo: false };
      }

      const redoStack = [...state.redoStack, current];

      restoreSnapshot(snapshot);
      invalidateSerializationCache();

      return {
        undoStack,
        redoStack,
        canUndo: undoStack.length > 0,
        canRedo: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.redoStack.length === 0) return state;

      const current = captureSnapshot();
      const redoStack = [...state.redoStack];
      const snapshot = redoStack.pop()!;

      // Guard against cross-project corruption
      if (snapshot.projectId !== current.projectId) {
        return { undoStack: [], redoStack: [], canUndo: false, canRedo: false };
      }

      const undoStack = [...state.undoStack, current];

      restoreSnapshot(snapshot);
      invalidateSerializationCache();

      return {
        undoStack,
        redoStack,
        canUndo: true,
        canRedo: redoStack.length > 0,
      };
    });
  },
}));
