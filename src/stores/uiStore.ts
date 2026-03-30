import { create } from "zustand";
import type { AspectRatio } from "@/types";

export type BottomSheetState = "collapsed" | "half" | "full";

interface UIState {
  leftPanelOpen: boolean;
  exportDialogOpen: boolean;
  aiPanelOpen: boolean;
  searchQuery: string;
  bottomSheetState: BottomSheetState;
  cityLabelSize: number; // CSS font size in px (default 18)
  cityLabelLang: "en" | "zh"; // City label language
  viewportRatio: AspectRatio; // WYSIWYG viewport aspect ratio

  setLeftPanelOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setAIPanelOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setBottomSheetState: (state: BottomSheetState) => void;
  setCityLabelSize: (size: number) => void;
  setCityLabelLang: (lang: "en" | "zh") => void;
  setViewportRatio: (ratio: AspectRatio) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  exportDialogOpen: false,
  aiPanelOpen: false,
  searchQuery: "",
  bottomSheetState: "collapsed",
  cityLabelSize: 18,
  cityLabelLang: "en",
  viewportRatio: "free",

  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setExportDialogOpen: (exportDialogOpen) => set({ exportDialogOpen }),
  setAIPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setBottomSheetState: (bottomSheetState) => set({ bottomSheetState }),
  setCityLabelSize: (cityLabelSize) => set({ cityLabelSize }),
  setCityLabelLang: (cityLabelLang) => set({ cityLabelLang }),
  setViewportRatio: (viewportRatio) => set({ viewportRatio }),
}));
