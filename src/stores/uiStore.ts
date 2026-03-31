import { create } from "zustand";
import type { AspectRatio, PhotoAnimation, PhotoStyle, SceneTransition } from "@/types";

export type BottomSheetState = "collapsed" | "half" | "full";

const UI_SETTINGS_KEY = "trace-recap-ui-settings";

interface PersistedUISettings {
  cityLabelSize: number;
  cityLabelLang: "en" | "zh";
  cityLabelTopPercent: number;
  routeLabelBottomPercent: number;
  routeLabelSize: number;
  viewportRatio: AspectRatio;
  photoAnimation: PhotoAnimation;
  photoStyle: PhotoStyle;
  sceneTransition: SceneTransition;
  moodColorsEnabled: boolean;
  chapterPinsEnabled: boolean;
}

function loadPersistedSettings(): Partial<PersistedUISettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedUISettings>;
  } catch {
    return {};
  }
}

function persistSettings(state: PersistedUISettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
}

const saved = loadPersistedSettings();

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
  photoStyle: PhotoStyle; // Photo display style
  sceneTransition: SceneTransition; // Scene transition style between locations
  moodColorsEnabled: boolean; // Use photo-extracted colors for route lines
  chapterPinsEnabled: boolean; // Show chapter pins at visited cities

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
  setPhotoStyle: (style: PhotoStyle) => void;
  setSceneTransition: (transition: SceneTransition) => void;
  setMoodColorsEnabled: (enabled: boolean) => void;
  setChapterPinsEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  exportDialogOpen: false,
  aiPanelOpen: false,
  projectListOpen: false,
  searchQuery: "",
  bottomSheetState: "collapsed",
  cityLabelSize: saved.cityLabelSize ?? 18,
  cityLabelLang: saved.cityLabelLang ?? "en",
  cityLabelTopPercent: saved.cityLabelTopPercent ?? 5,
  routeLabelBottomPercent: saved.routeLabelBottomPercent ?? 15,
  routeLabelSize: saved.routeLabelSize ?? 14,
  viewportRatio: saved.viewportRatio ?? "free",
  photoAnimation: saved.photoAnimation ?? "scale",
  photoStyle: saved.photoStyle ?? "classic",
  sceneTransition: saved.sceneTransition ?? "dissolve",
  moodColorsEnabled: saved.moodColorsEnabled ?? true,
  chapterPinsEnabled: saved.chapterPinsEnabled ?? true,

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
  setPhotoStyle: (photoStyle) => set({ photoStyle }),
  setSceneTransition: (sceneTransition) => set({ sceneTransition }),
  setMoodColorsEnabled: (moodColorsEnabled) => set({ moodColorsEnabled }),
  setChapterPinsEnabled: (chapterPinsEnabled) => set({ chapterPinsEnabled }),
}));

// Persist user settings on change (debounced)
let uiPersistTimeout: ReturnType<typeof setTimeout> | null = null;
useUIStore.subscribe((state) => {
  if (uiPersistTimeout) clearTimeout(uiPersistTimeout);
  uiPersistTimeout = setTimeout(() => {
    persistSettings({
      cityLabelSize: state.cityLabelSize,
      cityLabelLang: state.cityLabelLang,
      cityLabelTopPercent: state.cityLabelTopPercent,
      routeLabelBottomPercent: state.routeLabelBottomPercent,
      routeLabelSize: state.routeLabelSize,
      viewportRatio: state.viewportRatio,
      photoAnimation: state.photoAnimation,
      photoStyle: state.photoStyle,
      sceneTransition: state.sceneTransition,
      moodColorsEnabled: state.moodColorsEnabled,
      chapterPinsEnabled: state.chapterPinsEnabled,
    });
  }, 500);
});
