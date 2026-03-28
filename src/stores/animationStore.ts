import { create } from "zustand";
import type { PlaybackState, Photo, SegmentTiming } from "@/types";

interface AnimationState {
  playbackState: PlaybackState;
  currentTime: number;
  totalDuration: number;
  currentSegmentIndex: number;
  currentGroupSegmentIndices: number[];
  currentPhase: string | null;
  currentCityLabel: string | null;
  currentCityLabelZh: string | null;
  visiblePhotos: Photo[];
  showPhotoOverlay: boolean;
  timeline: SegmentTiming[];

  setPlaybackState: (state: PlaybackState) => void;
  setCurrentTime: (time: number) => void;
  setTotalDuration: (duration: number) => void;
  setCurrentSegmentIndex: (index: number) => void;
  setCurrentGroupSegmentIndices: (indices: number[]) => void;
  setCurrentPhase: (phase: string | null) => void;
  setCurrentCityLabel: (label: string | null) => void;
  setCurrentCityLabelZh: (label: string | null) => void;
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
  currentGroupSegmentIndices: [],
  currentPhase: null,
  currentCityLabel: null,
  currentCityLabelZh: null,
  visiblePhotos: [],
  showPhotoOverlay: false,
  timeline: [],

  setPlaybackState: (playbackState) => set({ playbackState }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setTotalDuration: (totalDuration) => set({ totalDuration }),
  setCurrentSegmentIndex: (currentSegmentIndex) => set({ currentSegmentIndex }),
  setCurrentGroupSegmentIndices: (currentGroupSegmentIndices) => set({ currentGroupSegmentIndices }),
  setCurrentPhase: (currentPhase) => set({ currentPhase }),
  setCurrentCityLabel: (currentCityLabel) => set({ currentCityLabel }),
  setCurrentCityLabelZh: (currentCityLabelZh) => set({ currentCityLabelZh }),
  setVisiblePhotos: (visiblePhotos) => set({ visiblePhotos }),
  setShowPhotoOverlay: (showPhotoOverlay) => set({ showPhotoOverlay }),
  setTimeline: (timeline) => set({ timeline }),
  reset: () =>
    set({
      playbackState: "idle",
      currentTime: 0,
      currentSegmentIndex: 0,
      currentGroupSegmentIndices: [],
      currentPhase: null,
      currentCityLabel: null,
      currentCityLabelZh: null,
      visiblePhotos: [],
      showPhotoOverlay: false,
    }),
}));
