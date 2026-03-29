import { create } from "zustand";
import { useProjectStore } from "./projectStore";
import type { Location, Segment, MapStyle } from "@/types";

interface HistorySnapshot {
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
  pushState: () => void;
  undo: () => void;
  redo: () => void;
}

function captureSnapshot(): HistorySnapshot {
  const { locations, segments, mapStyle, segmentTimingOverrides } =
    useProjectStore.getState();
  return {
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
      const redoStack = [...state.redoStack, current];

      restoreSnapshot(snapshot);

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
      const undoStack = [...state.undoStack, current];

      restoreSnapshot(snapshot);

      return {
        undoStack,
        redoStack,
        canUndo: true,
        canRedo: redoStack.length > 0,
      };
    });
  },
}));
