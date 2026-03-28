import { create } from "zustand";

interface UIState {
  leftPanelOpen: boolean;
  exportDialogOpen: boolean;
  aiPanelOpen: boolean;
  searchQuery: string;
  bottomSheetExpanded: boolean;
  cityLabelSize: number; // CSS font size in px (default 18)

  setLeftPanelOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setAIPanelOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setBottomSheetExpanded: (expanded: boolean) => void;
  toggleBottomSheet: () => void;
  setCityLabelSize: (size: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  exportDialogOpen: false,
  aiPanelOpen: false,
  searchQuery: "",
  bottomSheetExpanded: false,
  cityLabelSize: 18,

  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setExportDialogOpen: (exportDialogOpen) => set({ exportDialogOpen }),
  setAIPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setBottomSheetExpanded: (bottomSheetExpanded) => set({ bottomSheetExpanded }),
  toggleBottomSheet: () => set((s) => ({ bottomSheetExpanded: !s.bottomSheetExpanded })),
  setCityLabelSize: (cityLabelSize) => set({ cityLabelSize }),
}));
