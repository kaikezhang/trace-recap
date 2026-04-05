import type { ReactNode } from "react";
import { create } from "zustand";
import type {
  AlbumStyle,
  AspectRatio,
  LocalLanguageCode,
  PhotoAnimation,
  PhotoFrameStyle,
  PhotoStyle,
  SceneTransition,
} from "@/types";

export type BottomSheetState = "collapsed" | "half" | "full";

const UI_SETTINGS_KEY = "trace-recap-ui-settings";

interface PersistedUISettings {
  cityLabelSize: number;
  cityLabelLang: "en" | "local" | "zh";
  localLanguage: LocalLanguageCode;
  cityLabelTopPercent: number;
  routeLabelBottomPercent: number;
  routeLabelSize: number;
  viewportRatio: AspectRatio;
  speedMultiplier: number;
  photoAnimation: PhotoAnimation;
  photoStyle: PhotoStyle;
  sceneTransition: SceneTransition;
  albumStyle: AlbumStyle;
  photoFrameStyle: PhotoFrameStyle;
  albumCaptionsEnabled: boolean;
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

const MIN_SPEED_MULTIPLIER = 0.5;
const MAX_SPEED_MULTIPLIER = 2;

function normalizeSpeedMultiplier(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(
    MAX_SPEED_MULTIPLIER,
    Math.max(MIN_SPEED_MULTIPLIER, Math.round(value * 10) / 10),
  );
}

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "info" | "warning" | "error";
  action?: ReactNode;
}

interface UIState {
  leftPanelOpen: boolean;
  headerCollapsed: boolean;
  immersiveMode: boolean;
  exportDialogOpen: boolean;
  aiPanelOpen: boolean;
  projectListOpen: boolean;
  searchQuery: string;
  bottomSheetState: BottomSheetState;
  saveStatus: SaveStatus;
  toasts: ToastItem[];
  cityLabelSize: number; // CSS font size in px (default 18)
  cityLabelLang: "en" | "local"; // City label language toggle
  localLanguage: LocalLanguageCode; // User's chosen local language
  cityLabelTopPercent: number; // City label top position as % of container (default 5)
  routeLabelBottomPercent: number; // Route label bottom position as % of container (default 15)
  routeLabelSize: number; // Route label font size in px (default 14)
  viewportRatio: AspectRatio; // WYSIWYG viewport aspect ratio
  speedMultiplier: number; // Global animation speed multiplier (0.5x - 2x)
  photoAnimation: PhotoAnimation; // Photo enter/exit animation style
  photoStyle: PhotoStyle; // Photo display style
  sceneTransition: SceneTransition; // Scene transition style between locations
  albumStyle: AlbumStyle; // Album visual style for chapter pins
  photoFrameStyle: PhotoFrameStyle; // Phase 2 photo frame style selection
  albumCaptionsEnabled: boolean; // Show captions on photos inside album
  moodColorsEnabled: boolean; // Use photo-extracted colors for route lines
  chapterPinsEnabled: boolean; // Show chapter pins at visited cities
  breadcrumbsEnabled: boolean; // Show breadcrumb thumbnails at visited locations
  tripStatsEnabled: boolean; // Show trip stats bar during playback

  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setHeaderCollapsed: (collapsed: boolean) => void;
  toggleHeaderCollapsed: () => void;
  setImmersiveMode: (immersive: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setAIPanelOpen: (open: boolean) => void;
  setProjectListOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setBottomSheetState: (state: BottomSheetState) => void;
  setCityLabelSize: (size: number) => void;
  setCityLabelLang: (lang: "en" | "local") => void;
  setLocalLanguage: (lang: LocalLanguageCode) => void;
  setCityLabelTopPercent: (percent: number) => void;
  setRouteLabelBottomPercent: (percent: number) => void;
  setRouteLabelSize: (size: number) => void;
  setViewportRatio: (ratio: AspectRatio) => void;
  setSpeedMultiplier: (multiplier: number) => void;
  setPhotoAnimation: (animation: PhotoAnimation) => void;
  setPhotoStyle: (style: PhotoStyle) => void;
  setSceneTransition: (transition: SceneTransition) => void;
  setAlbumStyle: (style: AlbumStyle) => void;
  setPhotoFrameStyle: (style: PhotoFrameStyle) => void;
  setAlbumCaptionsEnabled: (enabled: boolean) => void;
  setMoodColorsEnabled: (enabled: boolean) => void;
  setChapterPinsEnabled: (enabled: boolean) => void;
  setBreadcrumbsEnabled: (enabled: boolean) => void;
  setTripStatsEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  headerCollapsed: true,
  immersiveMode: false,
  exportDialogOpen: false,
  aiPanelOpen: false,
  projectListOpen: false,
  searchQuery: "",
  bottomSheetState: "collapsed",
  cityLabelSize: saved.cityLabelSize ?? 18,
  cityLabelLang: (saved.cityLabelLang === "zh" ? "local" : saved.cityLabelLang) ?? "en",
  localLanguage: saved.localLanguage ?? "zh-Hans",
  cityLabelTopPercent: saved.cityLabelTopPercent ?? 5,
  routeLabelBottomPercent: saved.routeLabelBottomPercent ?? 15,
  routeLabelSize: saved.routeLabelSize ?? 14,
  viewportRatio: saved.viewportRatio ?? "free",
  speedMultiplier: normalizeSpeedMultiplier(saved.speedMultiplier),
  photoAnimation: saved.photoAnimation ?? "scale",
  photoStyle: saved.photoStyle ?? "classic",
  sceneTransition: saved.sceneTransition ?? "dissolve",
  albumStyle: saved.albumStyle ?? "vintage-leather",
  photoFrameStyle: saved.photoFrameStyle ?? "polaroid",
  albumCaptionsEnabled: saved.albumCaptionsEnabled ?? false,
  moodColorsEnabled: saved.moodColorsEnabled ?? true,
  chapterPinsEnabled: saved.chapterPinsEnabled ?? true,
  breadcrumbsEnabled: saved.breadcrumbsEnabled ?? true,
  tripStatsEnabled: saved.tripStatsEnabled ?? true,
  saveStatus: "idle" as SaveStatus,
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setHeaderCollapsed: (headerCollapsed) => set({ headerCollapsed }),
  toggleHeaderCollapsed: () =>
    set((state) => ({ headerCollapsed: !state.headerCollapsed })),
  setImmersiveMode: (immersiveMode) => set({ immersiveMode }),
  setExportDialogOpen: (exportDialogOpen) => set({ exportDialogOpen }),
  setAIPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
  setProjectListOpen: (projectListOpen) => set({ projectListOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setBottomSheetState: (bottomSheetState) => set({ bottomSheetState }),
  setCityLabelSize: (cityLabelSize) => set({ cityLabelSize }),
  setCityLabelLang: (cityLabelLang) => set({ cityLabelLang }),
  setLocalLanguage: (localLanguage) => set({ localLanguage }),
  setCityLabelTopPercent: (cityLabelTopPercent) => set({ cityLabelTopPercent }),
  setRouteLabelBottomPercent: (routeLabelBottomPercent) => set({ routeLabelBottomPercent }),
  setRouteLabelSize: (routeLabelSize) => set({ routeLabelSize }),
  setViewportRatio: (viewportRatio) => set({ viewportRatio }),
  setSpeedMultiplier: (speedMultiplier) =>
    set({ speedMultiplier: normalizeSpeedMultiplier(speedMultiplier) }),
  setPhotoAnimation: (photoAnimation) => set({ photoAnimation }),
  setPhotoStyle: (photoStyle) => set({ photoStyle }),
  setSceneTransition: (sceneTransition) => set({ sceneTransition }),
  setAlbumStyle: (albumStyle) => set({ albumStyle }),
  setPhotoFrameStyle: (photoFrameStyle) => set({ photoFrameStyle }),
  setAlbumCaptionsEnabled: (albumCaptionsEnabled) => set({ albumCaptionsEnabled }),
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
      localLanguage: state.localLanguage,
      cityLabelTopPercent: state.cityLabelTopPercent,
      routeLabelBottomPercent: state.routeLabelBottomPercent,
      routeLabelSize: state.routeLabelSize,
      viewportRatio: state.viewportRatio,
      speedMultiplier: state.speedMultiplier,
      photoAnimation: state.photoAnimation,
      photoStyle: state.photoStyle,
      sceneTransition: state.sceneTransition,
      albumStyle: state.albumStyle,
      photoFrameStyle: state.photoFrameStyle,
      albumCaptionsEnabled: state.albumCaptionsEnabled,
      moodColorsEnabled: state.moodColorsEnabled,
      chapterPinsEnabled: state.chapterPinsEnabled,
      breadcrumbsEnabled: state.breadcrumbsEnabled,
      tripStatsEnabled: state.tripStatsEnabled,
    });
  }, 500);
});
