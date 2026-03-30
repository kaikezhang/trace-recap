import { create } from "zustand";
import type { AspectRatio, PhotoAnimation } from "@/types";

export type BottomSheetState = "collapsed" | "half" | "full";

interface UIState {
  leftPanelOpen: boolean;
  exportDialogOpen: boolean;
  aiPanelOpen: boolean;
  projectListOpen: boolean;
  searchQuery: string;
  bottomSheetState: BottomSheetState;
  cityLabelSize: number; // CSS font size in px (default 18)
  cityLabelLang: "en" | "zh"; // City label language
  cityLabelTopPercent: number; // City label top position as % of container (default 5)
  routeLabelBottomPercent: number; // Route label bottom position as % of container (default 15)
  routeLabelSize: number; // Route label font size in px (default 14)
  viewportRatio: AspectRatio; // WYSIWYG viewport aspect ratio
  photoAnimation: PhotoAnimation; // Photo enter/exit animation style

  setLeftPanelOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setAIPanelOpen: (open: boolean) => void;
  setProjectListOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setBottomSheetState: (state: BottomSheetState) => void;
  setCityLabelSize: (size: number) => void;
  setCityLabelLang: (lang: "en" | "zh") => void;
  setCityLabelTopPercent: (percent: number) => void;
  setRouteLabelBottomPercent: (percent: number) => void;
  setRouteLabelSize: (size: number) => void;
  setViewportRatio: (ratio: AspectRatio) => void;
  setPhotoAnimation: (animation: PhotoAnimation) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  exportDialogOpen: false,
  aiPanelOpen: false,
  projectListOpen: false,
  searchQuery: "",
  bottomSheetState: "collapsed",
  cityLabelSize: 18,
  cityLabelLang: "en",
  cityLabelTopPercent: 5,
  routeLabelBottomPercent: 15,
  routeLabelSize: 14,
  viewportRatio: "free",
  photoAnimation: "scale",

  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setExportDialogOpen: (exportDialogOpen) => set({ exportDialogOpen }),
  setAIPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
  setProjectListOpen: (projectListOpen) => set({ projectListOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setBottomSheetState: (bottomSheetState) => set({ bottomSheetState }),
  setCityLabelSize: (cityLabelSize) => set({ cityLabelSize }),
  setCityLabelLang: (cityLabelLang) => set({ cityLabelLang }),
  setCityLabelTopPercent: (cityLabelTopPercent) => set({ cityLabelTopPercent }),
  setRouteLabelBottomPercent: (routeLabelBottomPercent) => set({ routeLabelBottomPercent }),
  setRouteLabelSize: (routeLabelSize) => set({ routeLabelSize }),
  setViewportRatio: (viewportRatio) => set({ viewportRatio }),
  setPhotoAnimation: (photoAnimation) => set({ photoAnimation }),
}));
