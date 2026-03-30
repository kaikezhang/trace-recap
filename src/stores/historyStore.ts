import { create } from "zustand";
import { useProjectStore, invalidateSerializationCache } from "./projectStore";
import type { Location, Segment, MapStyle } from "@/types";

interface HistorySnapshot {
  projectId: string | null;
  locations: Location[];
  segments: Segment[];
  mapStyle: MapStyle;
  segmentTimingOverrides: Record<string, number>;
}

const MAX_HISTORY = 50;

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

function captureSnapshot(): HistorySnapshot {
  const { currentProjectId, locations, segments, mapStyle, segmentTimingOverrides } =
    useProjectStore.getState();
  return {
    projectId: currentProjectId,
    locations: structuredClone(locations),
    segments: structuredClone(segments),
    mapStyle,
    segmentTimingOverrides: { ...segmentTimingOverrides },
  };
}

function restoreSnapshot(snapshot: HistorySnapshot): void {
  useProjectStore.setState({
    locations: snapshot.locations,
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
