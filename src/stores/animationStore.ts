import { create } from "zustand";
import type { PlaybackState, Photo, SegmentTiming } from "@/types";

export interface Breadcrumb {
  locationId: string;
  coordinates: [number, number]; // [lng, lat]
  heroPhotoUrl: string;          // URL of the hero/first photo
  cityName: string;
  visitedAtSegment: number;      // segment index when this was visited
}

export interface ScreenPoint {
  x: number;
  y: number;
}

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
  /** IDs of locations that have been visited (ARRIVE completed) during playback */
  visitedLocationIds: string[];
  /** ID of the location currently arriving at (active chapter pin) */
  currentArrivalLocationId: string | null;
  /** ID of the location whose album is currently collecting flying photos */
  albumCollectingLocationId: string | null;
  /** Screen-space positions for chapter pins that the photo overlay can target */
  chapterPinPositions: Record<string, ScreenPoint>;
  /** Breadcrumb thumbnails left at visited locations */
  breadcrumbs: Breadcrumb[];

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
  setVisitedLocationIds: (ids: string[]) => void;
  addVisitedLocationId: (id: string) => void;
  setCurrentArrivalLocationId: (id: string | null) => void;
  setAlbumCollectingLocationId: (id: string | null) => void;
  setChapterPinPositions: (positions: Record<string, ScreenPoint>) => void;
  addBreadcrumb: (b: Breadcrumb) => void;
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
  clearBreadcrumbs: () => void;
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
  visitedLocationIds: [],
  currentArrivalLocationId: null,
  albumCollectingLocationId: null,
  chapterPinPositions: {},
  breadcrumbs: [],

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
  setVisitedLocationIds: (visitedLocationIds) => set({ visitedLocationIds }),
  addVisitedLocationId: (id) =>
    set((state) => ({
      visitedLocationIds: state.visitedLocationIds.includes(id)
        ? state.visitedLocationIds
        : [...state.visitedLocationIds, id],
    })),
  setCurrentArrivalLocationId: (currentArrivalLocationId) => set({ currentArrivalLocationId }),
  setAlbumCollectingLocationId: (albumCollectingLocationId) =>
    set({ albumCollectingLocationId }),
  setChapterPinPositions: (chapterPinPositions) => set({ chapterPinPositions }),
  addBreadcrumb: (b) =>
    set((state) => {
      // Don't add duplicate breadcrumbs for the same location
      if (state.breadcrumbs.some((bc) => bc.locationId === b.locationId)) return state;
      return { breadcrumbs: [...state.breadcrumbs, b] };
    }),
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
  clearBreadcrumbs: () => set({ breadcrumbs: [] }),
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
      visitedLocationIds: [],
      currentArrivalLocationId: null,
      albumCollectingLocationId: null,
      chapterPinPositions: {},
      breadcrumbs: [],
    }),
}));
