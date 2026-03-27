import { create } from "zustand";
import type { PlaybackState, Photo, SegmentTiming } from "@/types";

interface AnimationState {
  playbackState: PlaybackState;
  currentTime: number;
  totalDuration: number;
  currentSegmentIndex: number;
  currentPhase: string | null;
  currentCityLabel: string | null;
  visiblePhotos: Photo[];
  showPhotoOverlay: boolean;
  timeline: SegmentTiming[];

  setPlaybackState: (state: PlaybackState) => void;
  setCurrentTime: (time: number) => void;
  setTotalDuration: (duration: number) => void;
  setCurrentSegmentIndex: (index: number) => void;
  setCurrentPhase: (phase: string | null) => void;
  setCurrentCityLabel: (label: string | null) => void;
  setVisiblePhotos: (photos: Photo[]) => void;
  setShowPhotoOverlay: (show: boolean) => void;
  setTimeline: (timeline: SegmentTiming[]) => void;
  reset: () => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  playbackState: "idle",
  currentTime: 0,
  totalDuration: 0,
  currentSegmentIndex: 0,
  currentPhase: null,
  currentCityLabel: null,
  visiblePhotos: [],
  showPhotoOverlay: false,
  timeline: [],

  setPlaybackState: (playbackState) => set({ playbackState }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setTotalDuration: (totalDuration) => set({ totalDuration }),
  setCurrentSegmentIndex: (currentSegmentIndex) => set({ currentSegmentIndex }),
  setCurrentPhase: (currentPhase) => set({ currentPhase }),
  setCurrentCityLabel: (currentCityLabel) => set({ currentCityLabel }),
  setVisiblePhotos: (visiblePhotos) => set({ visiblePhotos }),
  setShowPhotoOverlay: (showPhotoOverlay) => set({ showPhotoOverlay }),
  setTimeline: (timeline) => set({ timeline }),
  reset: () =>
    set({
      playbackState: "idle",
      currentTime: 0,
      currentSegmentIndex: 0,
      currentPhase: null,
      currentCityLabel: null,
      visiblePhotos: [],
      showPhotoOverlay: false,
    }),
}));
