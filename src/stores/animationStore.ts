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
  photoOverlayOpacity: number;
  timeline: SegmentTiming[];
  /** Scene transition progress (0-1), undefined when no transition active */
  sceneTransitionProgress: number | undefined;
  /** Photos from the incoming location during a scene transition */
  incomingPhotos: Photo[];
  /** PhotoLayout of the incoming location during a scene transition */
  incomingPhotoLocationId: string | null;
  /** Bearing for wipe direction */
  transitionBearing: number | undefined;
  /** Screen-space bloom origin for geo-anchored photo bloom */
  bloomOrigin: { x: number; y: number } | null;

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
  setPhotoOverlayOpacity: (opacity: number) => void;
  setTimeline: (timeline: SegmentTiming[]) => void;
  setSceneTransitionProgress: (progress: number | undefined) => void;
  setIncomingPhotos: (photos: Photo[]) => void;
  setIncomingPhotoLocationId: (id: string | null) => void;
  setTransitionBearing: (bearing: number | undefined) => void;
  setBloomOrigin: (origin: { x: number; y: number } | null) => void;
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
  photoOverlayOpacity: 1,
  timeline: [],
  sceneTransitionProgress: undefined,
  incomingPhotos: [],
  incomingPhotoLocationId: null,
  transitionBearing: undefined,
  bloomOrigin: null,

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
  setPhotoOverlayOpacity: (photoOverlayOpacity) => set({ photoOverlayOpacity }),
  setTimeline: (timeline) => set({ timeline }),
  setSceneTransitionProgress: (sceneTransitionProgress) => set({ sceneTransitionProgress }),
  setIncomingPhotos: (incomingPhotos) => set({ incomingPhotos }),
  setIncomingPhotoLocationId: (incomingPhotoLocationId) => set({ incomingPhotoLocationId }),
  setTransitionBearing: (transitionBearing) => set({ transitionBearing }),
  setBloomOrigin: (bloomOrigin) => set({ bloomOrigin }),
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
      photoOverlayOpacity: 0,
      sceneTransitionProgress: undefined,
      incomingPhotos: [],
      incomingPhotoLocationId: null,
      transitionBearing: undefined,
      bloomOrigin: null,
    }),
}));
