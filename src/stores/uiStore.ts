import { create } from "zustand";
import type {
  AlbumStyle,
  AspectRatio,
  PhotoAnimation,
  PhotoFrameStyle,
  PhotoStyle,
  SceneTransition,
} from "@/types";

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
  albumStyle: AlbumStyle;
  photoFrameStyle: PhotoFrameStyle;
  moodColorsEnabled: boolean;
  chapterPinsEnabled: boolean;
  breadcrumbsEnabled: boolean;
  tripStatsEnabled: boolean;
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

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UIState {
  leftPanelOpen: boolean;
  exportDialogOpen: boolean;
  aiPanelOpen: boolean;
  projectListOpen: boolean;
  searchQuery: string;
  bottomSheetState: BottomSheetState;
  saveStatus: SaveStatus;
  cityLabelSize: number; // CSS font size in px (default 18)
  cityLabelLang: "en" | "zh"; // City label language
  cityLabelTopPercent: number; // City label top position as % of container (default 5)
  routeLabelBottomPercent: number; // Route label bottom position as % of container (default 15)
  routeLabelSize: number; // Route label font size in px (default 14)
  viewportRatio: AspectRatio; // WYSIWYG viewport aspect ratio
  photoAnimation: PhotoAnimation; // Photo enter/exit animation style
  photoStyle: PhotoStyle; // Photo display style
  sceneTransition: SceneTransition; // Scene transition style between locations
  albumStyle: AlbumStyle; // Album visual style for chapter pins
  photoFrameStyle: PhotoFrameStyle; // Phase 2 photo frame style selection
  moodColorsEnabled: boolean; // Use photo-extracted colors for route lines
  chapterPinsEnabled: boolean; // Show chapter pins at visited cities
  breadcrumbsEnabled: boolean; // Show breadcrumb thumbnails at visited locations
  tripStatsEnabled: boolean; // Show trip stats bar during playback

  setSaveStatus: (status: SaveStatus) => void;
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
  setAlbumStyle: (style: AlbumStyle) => void;
  setPhotoFrameStyle: (style: PhotoFrameStyle) => void;
  setMoodColorsEnabled: (enabled: boolean) => void;
  setChapterPinsEnabled: (enabled: boolean) => void;
  setBreadcrumbsEnabled: (enabled: boolean) => void;
  setTripStatsEnabled: (enabled: boolean) => void;
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
  albumStyle: saved.albumStyle ?? "vintage-leather",
  photoFrameStyle: saved.photoFrameStyle ?? "polaroid",
  moodColorsEnabled: saved.moodColorsEnabled ?? true,
  chapterPinsEnabled: saved.chapterPinsEnabled ?? true,
  breadcrumbsEnabled: saved.breadcrumbsEnabled ?? true,
  tripStatsEnabled: saved.tripStatsEnabled ?? true,
  saveStatus: "idle" as SaveStatus,

  setSaveStatus: (saveStatus) => set({ saveStatus }),
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
  setAlbumStyle: (albumStyle) => set({ albumStyle }),
  setPhotoFrameStyle: (photoFrameStyle) => set({ photoFrameStyle }),
  setMoodColorsEnabled: (moodColorsEnabled) => set({ moodColorsEnabled }),
  setChapterPinsEnabled: (chapterPinsEnabled) => set({ chapterPinsEnabled }),
  setBreadcrumbsEnabled: (breadcrumbsEnabled) => set({ breadcrumbsEnabled }),
  setTripStatsEnabled: (tripStatsEnabled) => set({ tripStatsEnabled }),
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
      albumStyle: state.albumStyle,
      photoFrameStyle: state.photoFrameStyle,
      moodColorsEnabled: state.moodColorsEnabled,
      chapterPinsEnabled: state.chapterPinsEnabled,
      breadcrumbsEnabled: state.breadcrumbsEnabled,
      tripStatsEnabled: state.tripStatsEnabled,
    });
  }, 500);
});
