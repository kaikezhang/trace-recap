"use client";

import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { ChevronLeft, ChevronRight } from "lucide-react";
import mapboxgl from "mapbox-gl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { brand } from "@/lib/brand";
import { MapProvider, useMap } from "./MapContext";
import TopToolbar from "./TopToolbar";
import QuickStyleBar from "./QuickStyleBar";
import LeftPanel from "./LeftPanel";
import BottomSheet from "./BottomSheet";
import ExportDialog from "./ExportDialog";
import ProjectListDialog from "./ProjectListDialog";
import MapStage from "./MapStage";
import type { CitySearchHandle } from "./CitySearch";
import {
  SEGMENT_LAYER_PREFIX,
  SEGMENT_GLOW_LAYER_PREFIX,
  SEGMENT_SOURCE_PREFIX,
  setSegmentSourceData,
} from "./routeSegmentSources";
import { SUPPORTED_LOCAL_LANGUAGES } from "@/types";
import { AnimationEngine } from "@/engine/AnimationEngine";
import { demoProject } from "@/lib/demoProject";
import {
  initializeProjectPersistence,
  useProjectStore,
} from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";
import { useAuthStore } from "@/stores/authStore";
import { initSyncRepository } from "@/lib/sync/syncRepository";
import { useUIStore } from "@/stores/uiStore";
import { useHistoryStore } from "@/stores/historyStore";
import { ToastViewport } from "@/components/ui/toast";
import { computeContainedViewportSize } from "@/lib/viewportRatio";

const ONBOARDING_STORAGE_KEY = "trace-recap-onboarded";
const ALBUM_VISITED_HOLD_MS = 300;
const CONSTRAINED_STAGE_PLAYBACK_RESERVE_PX = 72;

type OnboardingHintKey =
  | "searchStart"
  | "searchSecondStop"
  | "playPreview";

type OnboardingState = Record<OnboardingHintKey, boolean>;

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  searchStart: false,
  searchSecondStop: false,
  playPreview: false,
};

function readOnboardingState(): OnboardingState {
  if (typeof window === "undefined") {
    return DEFAULT_ONBOARDING_STATE;
  }

  const saved = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (!saved) {
    return DEFAULT_ONBOARDING_STATE;
  }

  if (saved === "true") {
    return {
      searchStart: true,
      searchSecondStop: true,
      playPreview: true,
    };
  }

  try {
    return {
      ...DEFAULT_ONBOARDING_STATE,
      ...(JSON.parse(saved) as Partial<OnboardingState>),
    };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

function persistOnboardingState(state: OnboardingState): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    ONBOARDING_STORAGE_KEY,
    Object.values(state).every(Boolean) ? "true" : JSON.stringify(state),
  );
}

function measureStageSize(element: HTMLDivElement): {
  width: number;
  height: number;
} {
  const styles = window.getComputedStyle(element);
  const paddingX =
    parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const paddingY =
    parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

  return {
    width: element.clientWidth - paddingX,
    height: element.clientHeight - paddingY,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function EditorContent() {
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const replaceCurrentProject = useProjectStore((s) => s.replaceCurrentProject);
  const loadRouteData = useProjectStore((s) => s.loadRouteData);
  const segmentTimingOverrides = useProjectStore(
    (s) => s.segmentTimingOverrides,
  );
  const engineRef = useRef<AnimationEngine | null>(null);
  const demoLoadedRef = useRef(false);
  const prevShowPhotosRef = useRef(false);
  const prevPhotoLocationIdRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const activeAlbumSequenceLocationIdRef = useRef<string | null>(null);
  const completedAlbumLocationIdsRef = useRef<Set<string>>(new Set());
  const pendingAlbumCloseLocationIdRef = useRef<string | null>(null);
  const albumVisitedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const startAlbumSequenceRef = useRef<(locationId: string) => void>(() => {});
  const completeAlbumSequenceRef = useRef<(locationId: string) => void>(
    () => {},
  );
  const resetAlbumSequenceStateRef = useRef<() => void>(() => {});
  const clearAlbumSequenceTimersRef = useRef<() => void>(() => {});

  const playbackState = useAnimationStore((s) => s.playbackState);
  const setPlaybackState = useAnimationStore((s) => s.setPlaybackState);
  const setCurrentTime = useAnimationStore((s) => s.setCurrentTime);
  const setTotalDuration = useAnimationStore((s) => s.setTotalDuration);
  const setCurrentPhase = useAnimationStore((s) => s.setCurrentPhase);
  const setCurrentCityLabel = useAnimationStore((s) => s.setCurrentCityLabel);
  const setCurrentCityLabelLocal = useAnimationStore(
    (s) => s.setCurrentCityLabelLocal,
  );
  const setVisiblePhotos = useAnimationStore((s) => s.setVisiblePhotos);
  const setShowPhotoOverlay = useAnimationStore((s) => s.setShowPhotoOverlay);
  const setPhotoOverlayOpacity = useAnimationStore(
    (s) => s.setPhotoOverlayOpacity,
  );
  const setCurrentSegmentIndex = useAnimationStore(
    (s) => s.setCurrentSegmentIndex,
  );
  const setCurrentGroupSegmentIndices = useAnimationStore(
    (s) => s.setCurrentGroupSegmentIndices,
  );
  const setTimeline = useAnimationStore((s) => s.setTimeline);
  const setSceneTransitionProgress = useAnimationStore(
    (s) => s.setSceneTransitionProgress,
  );
  const setIncomingPhotos = useAnimationStore((s) => s.setIncomingPhotos);
  const setIncomingPhotoLocationId = useAnimationStore(
    (s) => s.setIncomingPhotoLocationId,
  );
  const setTransitionBearing = useAnimationStore(
    (s) => s.setTransitionBearing,
  );
  const setAlbumCollectingLocationId = useAnimationStore(
    (s) => s.setAlbumCollectingLocationId,
  );
  const addBreadcrumb = useAnimationStore((s) => s.addBreadcrumb);
  const setBreadcrumbs = useAnimationStore((s) => s.setBreadcrumbs);
  const reset = useAnimationStore((s) => s.reset);

  // Moved up: used by completeAlbumSequence / startAlbumSequence callbacks below
  const [visiblePhotoLocationId, setVisiblePhotoLocationId] = useState<
    string | null
  >(null);

  const cityLabelSize = useUIStore((s) => s.cityLabelSize);
  const cityLabelLang = useUIStore((s) => s.cityLabelLang);
  const localLanguage = useUIStore((s) => s.localLanguage);
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const speedMultiplier = useUIStore((s) => s.speedMultiplier);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const immersiveMode = useUIStore((s) => s.immersiveMode);
  const setBottomSheetState = useUIStore((s) => s.setBottomSheetState);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);
  const setImmersiveMode = useUIStore((s) => s.setImmersiveMode);

  const stageViewportRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const previousPlaybackStateRef = useRef(playbackState);
  const previousTabletViewportRef = useRef(false);
  const [availableStageSize, setAvailableStageSize] = useState({
    width: 0,
    height: 0,
  });
  const [stageViewportBottomInsetPx, setStageViewportBottomInsetPx] = useState(0);
  const [isTabletViewport, setIsTabletViewport] = useState(false);

  const constrainedMapSize = useMemo(
    () =>
      computeContainedViewportSize(
        availableStageSize.width,
        availableStageSize.height,
        viewportRatio,
        viewportRatio !== "free" && segments.length > 0
          ? CONSTRAINED_STAGE_PLAYBACK_RESERVE_PX
          : 0,
      ),
    [availableStageSize.height, availableStageSize.width, segments.length, viewportRatio],
  );

  const clearAlbumSequenceTimers = useCallback(() => {
    if (albumVisitedTimerRef.current) {
      clearTimeout(albumVisitedTimerRef.current);
      albumVisitedTimerRef.current = null;
    }
  }, []);

  const resetAlbumSequenceState = useCallback(() => {
    clearAlbumSequenceTimers();
    activeAlbumSequenceLocationIdRef.current = null;
    pendingAlbumCloseLocationIdRef.current = null;
    completedAlbumLocationIdsRef.current.clear();
    setAlbumCollectingLocationId(null);
  }, [clearAlbumSequenceTimers, setAlbumCollectingLocationId]);

  const completeAlbumSequence = useCallback(
    (locationId: string) => {
      if (activeAlbumSequenceLocationIdRef.current !== locationId) return;

      if (useAnimationStore.getState().playbackState !== "playing") {
        pendingAlbumCloseLocationIdRef.current = locationId;
        return;
      }

      pendingAlbumCloseLocationIdRef.current = null;
      setShowPhotoOverlay(false);
      setVisiblePhotoLocationId(null);
      clearAlbumSequenceTimers();
      albumVisitedTimerRef.current = setTimeout(() => {
        completedAlbumLocationIdsRef.current.add(locationId);
        activeAlbumSequenceLocationIdRef.current = null;
        setAlbumCollectingLocationId(null);

        const { currentArrivalLocationId, visitedLocationIds } =
          useAnimationStore.getState();

        useAnimationStore.setState({
          currentArrivalLocationId:
            currentArrivalLocationId === locationId
              ? null
              : currentArrivalLocationId,
          visitedLocationIds: visitedLocationIds.includes(locationId)
            ? visitedLocationIds
            : [...visitedLocationIds, locationId],
        });

        albumVisitedTimerRef.current = null;
      }, ALBUM_VISITED_HOLD_MS);
    },
    [clearAlbumSequenceTimers, setAlbumCollectingLocationId, setShowPhotoOverlay],
  );

  const startAlbumSequence = useCallback(
    (locationId: string) => {
      clearAlbumSequenceTimers();
      pendingAlbumCloseLocationIdRef.current = null;
      activeAlbumSequenceLocationIdRef.current = locationId;
      setAlbumCollectingLocationId(locationId);
      setVisiblePhotoLocationId(locationId);
      setShowPhotoOverlay(true);
      setPhotoOverlayOpacity(0);
    },
    [
      clearAlbumSequenceTimers,
      setAlbumCollectingLocationId,
      setPhotoOverlayOpacity,
      setShowPhotoOverlay,
    ],
  );

  useEffect(() => {
    startAlbumSequenceRef.current = startAlbumSequence;
    completeAlbumSequenceRef.current = completeAlbumSequence;
    resetAlbumSequenceStateRef.current = resetAlbumSequenceState;
    clearAlbumSequenceTimersRef.current = clearAlbumSequenceTimers;
  }, [
    clearAlbumSequenceTimers,
    completeAlbumSequence,
    resetAlbumSequenceState,
    startAlbumSequence,
  ]);

  useEffect(() => {
    const stageViewport = stageViewportRef.current;
    if (!stageViewport) return;

    const updateStageSize = (width: number, height: number) => {
      const nextWidth = Math.round(width);
      const nextHeight = Math.round(height);
      setAvailableStageSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    const measuredStageSize = measureStageSize(stageViewport);
    updateStageSize(measuredStageSize.width, measuredStageSize.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateStageSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(stageViewport);

    return () => observer.disconnect();
  }, [map, viewportRatio]);

  useEffect(() => {
    if (viewportRatio !== "free") {
      setStageViewportBottomInsetPx(0);
      return;
    }

    const stageViewport = stageViewportRef.current;
    if (!stageViewport || typeof window === "undefined") return;

    const updateStageInset = () => {
      const rect = stageViewport.getBoundingClientRect();
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight;
      const visibleBottom = Math.min(rect.bottom, viewportHeight);
      const nextInset = Math.max(0, Math.round(rect.bottom - visibleBottom));

      setStageViewportBottomInsetPx((current) =>
        current === nextInset ? current : nextInset,
      );
    };

    updateStageInset();

    const observer = new ResizeObserver(() => {
      updateStageInset();
    });
    observer.observe(stageViewport);

    const visualViewport = window.visualViewport;
    window.addEventListener("resize", updateStageInset);
    visualViewport?.addEventListener("resize", updateStageInset);
    visualViewport?.addEventListener("scroll", updateStageInset);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStageInset);
      visualViewport?.removeEventListener("resize", updateStageInset);
      visualViewport?.removeEventListener("scroll", updateStageInset);
    };
  }, [viewportRatio]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsTabletViewport(event.matches);
    };

    setIsTabletViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const enteredPlayback =
      playbackState === "playing" && previousPlaybackStateRef.current !== "playing";
    const enteredTabletViewport =
      isTabletViewport && !previousTabletViewportRef.current;

    if (enteredPlayback || (enteredTabletViewport && playbackState === "playing")) {
      setImmersiveMode(true);
    }

    previousPlaybackStateRef.current = playbackState;
    previousTabletViewportRef.current = isTabletViewport;
  }, [isTabletViewport, playbackState, setImmersiveMode]);

  useEffect(() => {
    if (!map || !mapContainerRef.current) return;

    map.resize();

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [constrainedMapSize?.height, constrainedMapSize?.width, map, viewportRatio]);
  // Apply language to Mapbox base map labels when cityLabelLang changes
  // Also re-apply after style reloads (e.g. map style switch)
  useEffect(() => {
    if (!map) return;

    // Check whether a layer's text-field expression references a 'name' property
    // (e.g. "name", "name_en", "name_zh-Hans"). Shields, transit refs, and highway
    // markers use properties like "ref", "shield_text", "house_num" — skip those.
    const textFieldReferencesName = (textField: unknown): boolean => {
      if (textField == null) return false;
      const str = JSON.stringify(textField);
      return /\bname/.test(str);
    };

    const applyMapLanguage = () => {
      const style = map.getStyle();
      if (!style?.layers) return;

      let textFieldExpr: mapboxgl.ExpressionSpecification;
      if (cityLabelLang === "local") {
        const langConfig = SUPPORTED_LOCAL_LANGUAGES.find((l) => l.code === localLanguage);
        const fields: mapboxgl.ExpressionSpecification[] = [];
        if (langConfig) {
          fields.push(["get", langConfig.mapboxField]);
          for (const fb of langConfig.fallbackFields) fields.push(["get", fb]);
        }
        fields.push(["get", "name"]);
        textFieldExpr = ["coalesce", ...fields] as mapboxgl.ExpressionSpecification;
      } else {
        textFieldExpr = ["coalesce", ["get", "name_en"], ["get", "name"]] as mapboxgl.ExpressionSpecification;
      }

      for (const layer of style.layers) {
        if (layer.type !== "symbol") continue;
        const textField = map.getLayoutProperty(layer.id, "text-field");
        if (!textFieldReferencesName(textField)) continue;
        map.setLayoutProperty(layer.id, "text-field", textFieldExpr);
      }
    };

    if (map.isStyleLoaded()) {
      applyMapLanguage();
    }
    // Re-apply on every style reload (map style change)
    map.on("style.load", applyMapLanguage);
    return () => {
      map.off("style.load", applyMapLanguage);
    };
  }, [map, cityLabelLang, localLanguage]);

  const currentCityLabelEn = useAnimationStore((s) => s.currentCityLabel);
  const currentCityLabelLocal = useAnimationStore((s) => s.currentCityLabelLocal);
  const currentCityLabel =
    cityLabelLang === "local"
      ? currentCityLabelLocal || currentCityLabelEn
      : currentCityLabelEn;
  const currentCityEmoji = currentCityLabelEn
    ? locations.find((l) => l.name === currentCityLabelEn)?.chapterEmoji ?? null
    : null;
  const visiblePhotos = useAnimationStore((s) => s.visiblePhotos);
  const showPhotoOverlay = useAnimationStore((s) => s.showPhotoOverlay);
  const photoOverlayOpacity = useAnimationStore((s) => s.photoOverlayOpacity);
  const searchRef = useRef<CitySearchHandle>(null);

  const [editingLocationId, setEditingLocationId] = useState<string | null>(
    null,
  );
  const [selectedLocationIndex, setSelectedLocationIndex] = useState<number | null>(null);
  const [goToStopOpen, setGoToStopOpen] = useState(false);
  const [goToStopQuery, setGoToStopQuery] = useState("");
  const [goToStopError, setGoToStopError] = useState<string | null>(null);
  const goToStopInputRef = useRef<HTMLInputElement>(null);
  const editingLocation =
    locations.find((l) => l.id === editingLocationId) ?? null;
  const visiblePhotoLocation =
    locations.find((l) => l.id === visiblePhotoLocationId) ?? null;

  const [shouldLoadDemo, setShouldLoadDemo] = useState(false);
  const [demoQueryChecked, setDemoQueryChecked] = useState(false);
  const [onboardingState, setOnboardingState] =
    useState<OnboardingState | null>(null);

  useEffect(() => {
    const nextShouldLoadDemo =
      new URL(window.location.href).searchParams.get("demo") === "true";
    setShouldLoadDemo(nextShouldLoadDemo);
    setDemoQueryChecked(true);
    initializeProjectPersistence({ skipRestore: nextShouldLoadDemo });
    void useAuthStore.getState().initialize();
    initSyncRepository();
    track("editor_opened");
  }, []);

  useEffect(() => {
    setOnboardingState(readOnboardingState());
  }, []);

  useEffect(() => {
    setSelectedLocationIndex((current) => {
      if (current === null) {
        return current;
      }

      if (locations.length === 0) {
        return null;
      }

      return current < locations.length ? current : locations.length - 1;
    });
  }, [locations.length]);

  useEffect(() => {
    if (!goToStopOpen) {
      setGoToStopError(null);
      return;
    }

    goToStopInputRef.current?.focus();
    goToStopInputRef.current?.select();
  }, [goToStopOpen]);

  useEffect(() => {
    if (!demoQueryChecked || !shouldLoadDemo || demoLoadedRef.current) return;

    demoLoadedRef.current = true;

    const loadDemoProject = async () => {
      try {
        // Demo always replaces the current project without confirmation
        await replaceCurrentProject(demoProject.name);
        await loadRouteData(demoProject);
        track("demo_loaded", { is_demo: true });
      } catch (error) {
        console.error("Failed to load demo project.", error);
        demoLoadedRef.current = false;
        return;
      }

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("demo");
      window.history.replaceState(
        {},
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
      );
    };

    void loadDemoProject();
  }, [replaceCurrentProject, demoQueryChecked, loadRouteData, shouldLoadDemo]);

  // Rebuild engine when project changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    reset();
    resetAlbumSequenceStateRef.current();
    prevPhaseRef.current = null;
    prevShowPhotosRef.current = false;
    prevPhotoLocationIdRef.current = null;
    setVisiblePhotoLocationId(null);

    if (!map || segments.length === 0) return;

    const allReady = segments.every((s) => s.geometry !== null);
    if (!allReady) return;

    const engine = new AnimationEngine(
      map,
      locations,
      segments,
      segmentTimingOverrides,
      speedMultiplier,
    );
    engineRef.current = engine;
    setTotalDuration(engine.getTotalDuration());
    setTimeline(engine.getTimeline());

    engine.on("progress", (e) => {
      const seg = segments[e.segmentIndex];
      const currentArrivalLocation =
        seg?.toId != null
          ? locations.find((location) => location.id === seg.toId) ?? null
          : null;
      const currentArrivalHasPhotos =
        (currentArrivalLocation?.photos.length ?? 0) > 0;
      const previousPhase = prevPhaseRef.current;
      prevPhaseRef.current = e.phase;
      const wasShowingPhotos = prevShowPhotosRef.current;
      prevShowPhotosRef.current = e.showPhotos;
      const previousPhotoLocationId = prevPhotoLocationIdRef.current;
      if (e.phase === "ARRIVE") {
        prevPhotoLocationIdRef.current =
          e.showPhotos && currentArrivalHasPhotos
            ? currentArrivalLocation?.id ?? null
            : null;
      } else if (!e.showPhotos) {
        prevPhotoLocationIdRef.current = null;
      }
      const previousPhotoLocation =
        previousPhotoLocationId != null
          ? locations.find((location) => location.id === previousPhotoLocationId) ??
            null
          : null;
      const shouldStartAlbumSequence =
        previousPhase === "ARRIVE" &&
        e.phase !== "ARRIVE" &&
        previousPhotoLocationId !== null &&
        (previousPhotoLocation?.photos.length ?? 0) > 0 &&
        activeAlbumSequenceLocationIdRef.current !== previousPhotoLocationId &&
        !completedAlbumLocationIdsRef.current.has(previousPhotoLocationId);

      setCurrentTime(e.time);
      setCurrentSegmentIndex(e.segmentIndex);
      setCurrentGroupSegmentIndices(e.groupSegmentIndices);
      setCurrentPhase(e.phase);
      setCurrentCityLabel(e.cityLabel);
      setCurrentCityLabelLocal(e.cityLabelLocal);

      if (e.showPhotos && e.phase === "ARRIVE") {
        setShowPhotoOverlay(true);
        setPhotoOverlayOpacity(1);
      } else if (e.showPhotos && e.phase === "HOVER" && e.groupIndex === 0) {
        // First city: show photos during HOVER
        const firstLoc = locations[0];
        if (firstLoc && firstLoc.photos.length > 0) {
          setShowPhotoOverlay(true);
          setPhotoOverlayOpacity(1);
          setVisiblePhotos(firstLoc.photos);
          setVisiblePhotoLocationId(firstLoc.id);
        }
      } else if (shouldStartAlbumSequence) {
        startAlbumSequenceRef.current(previousPhotoLocationId);
      } else if (
        !e.showPhotos &&
        activeAlbumSequenceLocationIdRef.current === null &&
        pendingAlbumCloseLocationIdRef.current === null
      ) {
        setShowPhotoOverlay(false);
        setPhotoOverlayOpacity(0);
      }

      // Chapter pin tracking: derive visited/arrival state from current time
      // (recomputed from scratch so seek/scrub always produces correct state)
      {
        const groups = engine.getGroups();
        const tl = engine.getTimeline();
        const t = e.time;
        const newVisited: string[] = [];
        let newArrival: string | null = null;

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const entry = tl[i];
          if (!entry) continue;

          // First location: shown as arrival during HOVER of group 0
          if (i === 0 && !group.fromLoc.isWaypoint) {
            const hover = entry.phases.find(
              (p: { phase: string }) => p.phase === "HOVER",
            );
            if (hover) {
              const hoverEnd = hover.startTime + hover.duration;
              if (t >= hover.startTime && t < hoverEnd) {
                newArrival = group.fromLoc.id;
              } else if (t >= hoverEnd) {
                newVisited.push(group.fromLoc.id);
              }
            }
          }

          // toLoc: arriving during ARRIVE phase, stays as arrival while
          // photos are still fading out (next group's HOVER + ZOOM_OUT),
          // becomes visited only after photos fully disappear.
          if (!group.toLoc.isWaypoint) {
            const arrive = entry.phases.find(
              (p: { phase: string }) => p.phase === "ARRIVE",
            );
            if (arrive) {
              const arriveEnd = arrive.startTime + arrive.duration;
              // Only show album pin in the last 20% of ARRIVE phase
              // (when photos are about to start fading out), not at the start
              const albumAppearTime = arrive.startTime + arrive.duration * 0.8;
              if (t >= albumAppearTime && t < arriveEnd) {
                newArrival = group.toLoc.id;
              } else if (t >= arriveEnd) {
                if (completedAlbumLocationIdsRef.current.has(group.toLoc.id)) {
                  newVisited.push(group.toLoc.id);
                  continue;
                }

                // Photos fade out during the next group's HOVER + ZOOM_OUT.
                // Keep pin as "arrival" until photos are fully gone.
                const hasPhotos = group.toLoc.photos.length > 0;
                const nextEntry = tl[i + 1];
                let photosStillVisible = false;

                if (hasPhotos && nextEntry) {
                  const nextHover = nextEntry.phases.find(
                    (p: { phase: string }) => p.phase === "HOVER",
                  );
                  const nextZoomOut = nextEntry.phases.find(
                    (p: { phase: string }) => p.phase === "ZOOM_OUT",
                  );
                  // Photos fade through HOVER and ZOOM_OUT of next group
                  const fadeEnd = nextZoomOut
                    ? nextZoomOut.startTime + nextZoomOut.duration
                    : nextHover
                      ? nextHover.startTime + nextHover.duration
                      : arriveEnd;
                  if (t < fadeEnd) {
                    photosStillVisible = true;
                  }
                }

                if (photosStillVisible) {
                  newArrival = group.toLoc.id;
                } else {
                  newVisited.push(group.toLoc.id);
                }
              }
            }
          }
        }

        useAnimationStore.setState({
          visitedLocationIds: [...new Set(newVisited)],
          currentArrivalLocationId: newArrival,
        });
      }

      // Album state machine: once the 300ms hold finishes we clear collecting
      // directly, so later playback phases don't need to force a closed state.
      {
        const currentCollecting = useAnimationStore.getState().albumCollectingLocationId;
        const hasActiveSequence = activeAlbumSequenceLocationIdRef.current !== null;

        if (
          (e.phase === "ZOOM_OUT" || e.phase === "FLY") &&
          currentCollecting !== null &&
          !hasActiveSequence
        ) {
          setAlbumCollectingLocationId(null);
        }
      }

      if (e.showPhotos) {
        if (e.phase === "ARRIVE") {
          // During ARRIVE: set current destination's photos
          setVisiblePhotos(currentArrivalLocation?.photos ?? []);
          setVisiblePhotoLocationId(currentArrivalLocation?.id ?? null);
        }
        // During HOVER/ZOOM_OUT fade-out: keep previous photos (don't update)
      } else {
        // Don't clear outgoing photos/location when a scene transition is active —
        // the outgoing location's photoLayout must persist for correct transition resolution
        if (
          e.sceneTransitionProgress === undefined &&
          activeAlbumSequenceLocationIdRef.current === null &&
          pendingAlbumCloseLocationIdRef.current === null
        ) {
          setVisiblePhotos([]);
          setVisiblePhotoLocationId(null);
        }
      }

      // Breadcrumb: when photos stop showing, drop a breadcrumb for the location that was just visited
      const prevLocId = previousPhotoLocationId;
      if (wasShowingPhotos && !e.showPhotos && prevLocId) {
        const loc = locations.find((l) => l.id === prevLocId);
        if (loc && loc.photos.length > 0) {
          addBreadcrumb({
            locationId: loc.id,
            coordinates: loc.coordinates,
            heroPhotoUrl: loc.photos[0].url,
            cityName: loc.name,
            visitedAtSegment: e.segmentIndex,
          });
        }
      }

      // Scene transition metadata
      setSceneTransitionProgress(e.sceneTransitionProgress);
      setTransitionBearing(e.transitionBearing);
      if (e.sceneTransitionProgress !== undefined && e.incomingGroupIndex !== undefined) {
        const groups = engine.getGroups();
        const incomingGroup = groups[e.incomingGroupIndex];
        if (incomingGroup) {
          setIncomingPhotos(incomingGroup.toLoc.photos);
          setIncomingPhotoLocationId(incomingGroup.toLoc.id);
        }
      } else {
        setIncomingPhotos([]);
        setIncomingPhotoLocationId(null);
      }

    });

    // Progressive route drawing updates each segment's own source directly.
    // With animation groups, we need to draw all segments in the group together.
    engine.on("routeDrawProgress", (e) => {
      if (!map) return;
      const fraction = e.routeDrawFraction ?? 0;
      const groupSegIndices = e.groupSegmentIndices;

      // Show all segments from past groups (fully drawn)
      const firstGroupSegIdx = groupSegIndices[0];
      for (let i = 0; i < firstGroupSegIdx; i++) {
        const pastSeg = segments[i];
        const pastLid = SEGMENT_LAYER_PREFIX + pastSeg.id;
        const pastGlid = SEGMENT_GLOW_LAYER_PREFIX + pastSeg.id;
        if (map.getLayer(pastLid))
          map.setLayoutProperty(pastLid, "visibility", "visible");
        if (map.getLayer(pastGlid))
          map.setLayoutProperty(pastGlid, "visibility", "visible");
        setSegmentSourceData(map, pastSeg.id, pastSeg.geometry);
      }

      // For the current group, compute how the merged fraction maps to individual segments
      const group = engine.getGroups()[e.groupIndex];
      if (!group) return;
      const mergedGeom = group.mergedGeometry;
      const mergedLength =
        mergedGeom && mergedGeom.coordinates.length > 1
          ? length(lineString(mergedGeom.coordinates))
          : 0;

      let accumulatedLength = 0;
      const drawnDistance = fraction * mergedLength;

      for (let gi = 0; gi < groupSegIndices.length; gi++) {
        const segIdx = groupSegIndices[gi];
        const seg = segments[segIdx];
        if (!seg?.geometry || seg.geometry.coordinates.length < 2) continue;
        if (!map.getSource(`${SEGMENT_SOURCE_PREFIX}${seg.id}`)) continue;

        const segLength = length(lineString(seg.geometry.coordinates));
        const segStart = accumulatedLength;
        const segEnd = accumulatedLength + segLength;
        accumulatedLength = segEnd;

        // Make layers visible
        const layerId = SEGMENT_LAYER_PREFIX + seg.id;
        const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
        if (map.getLayer(layerId))
          map.setLayoutProperty(layerId, "visibility", "visible");
        if (map.getLayer(glowLayerId))
          map.setLayoutProperty(glowLayerId, "visibility", "visible");

        if (drawnDistance >= segEnd) {
          // This segment is fully drawn
          setSegmentSourceData(map, seg.id, seg.geometry);
        } else if (drawnDistance > segStart) {
          // Partially drawn
          const segFraction = (drawnDistance - segStart) / segLength;
          setSegmentSourceData(map, seg.id, seg.geometry, segFraction);
        } else {
          // Not yet drawn
          setSegmentSourceData(map, seg.id, seg.geometry, 0);
        }
      }
    });

    engine.on("complete", () => {
      setPlaybackState("idle");
      setCurrentSegmentIndex(0);
    });

    return () => {
      engine.destroy();
      clearAlbumSequenceTimersRef.current();
    };
  }, [map, locations, segmentTimingOverrides, segments, speedMultiplier]);

  const handlePlay = useCallback(() => {
    track("playback_started", {
      stop_count: locations.length,
      photo_count: locations.reduce((sum, l) => sum + l.photos.length, 0),
      segment_count: segments.length,
    });
    // Immediately hide all future segment layers on the map
    if (map) {
      const style = map.getStyle();
      if (style?.layers) {
        style.layers.forEach((layer: { id: string }) => {
          if (
            layer.id.startsWith("segment-") ||
            layer.id.startsWith("segment-glow-")
          ) {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        });
      }
    }
    engineRef.current?.play();
    setPlaybackState("playing");
    const pendingAlbumCloseLocationId = pendingAlbumCloseLocationIdRef.current;
    if (pendingAlbumCloseLocationId) {
      completeAlbumSequenceRef.current(pendingAlbumCloseLocationId);
    }
  }, [map, setPlaybackState]);

  const handlePause = useCallback(() => {
    if (
      albumVisitedTimerRef.current &&
      activeAlbumSequenceLocationIdRef.current !== null
    ) {
      pendingAlbumCloseLocationIdRef.current =
        activeAlbumSequenceLocationIdRef.current;
    }
    clearAlbumSequenceTimersRef.current();
    engineRef.current?.pause();
    setPlaybackState("paused");
  }, [setPlaybackState]);

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    resetAlbumSequenceStateRef.current();
    reset();
    prevShowPhotosRef.current = false;
    prevPhotoLocationIdRef.current = null;
    prevPhaseRef.current = null;
    setVisiblePhotoLocationId(null);
  }, [reset]);

  const handleSeek = useCallback((progress: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    resetAlbumSequenceStateRef.current();
    engine.seekTo(progress);

    // Rebuild breadcrumb state for the seek position
    const seekTime = progress * engine.getTotalDuration();
    const timeline = engine.getTimeline();
    const groups = engine.getGroups();

    const newBreadcrumbs: import("@/stores/animationStore").Breadcrumb[] = [];
    for (let i = 0; i < groups.length; i++) {
      const entry = timeline[i];
      if (!entry) continue;
      // A breadcrumb appears after the group's phases complete (photos dismissed)
      if (seekTime >= entry.startTime + entry.duration) {
        const toLoc = groups[i].toLoc;
        if (toLoc.photos.length > 0) {
          completedAlbumLocationIdsRef.current.add(toLoc.id);
          newBreadcrumbs.push({
            locationId: toLoc.id,
            coordinates: toLoc.coordinates,
            heroPhotoUrl: toLoc.photos[0].url,
            cityName: toLoc.name,
            visitedAtSegment: i,
          });
        }
      }
    }

    setBreadcrumbs(newBreadcrumbs);

    // Reset transition tracking refs to match seek state
    prevShowPhotosRef.current = false;
    prevPhotoLocationIdRef.current = null;
    prevPhaseRef.current = null;

    // Derive the correct visible photo location from the seek position.
    // Previously this unconditionally cleared visiblePhotoLocationId, which
    // detached photos from their photoLayout (losing free transforms, captions,
    // and manual positioning) while photos remained visible on screen.
    const { groupIndex: seekGroup, phase: seekPhase } = engine.resolveTimePosition(seekTime);
    if (seekGroup >= 0) {
      const seekGroupData = groups[seekGroup];
      if (seekPhase === "ARRIVE" && seekGroupData?.toLoc.photos.length) {
        setVisiblePhotos(seekGroupData.toLoc.photos);
        setVisiblePhotoLocationId(seekGroupData.toLoc.id);
        setShowPhotoOverlay(true);
        setPhotoOverlayOpacity(1);
      } else if (seekPhase === "HOVER" && seekGroup === 0 && seekGroupData?.fromLoc.photos.length) {
        setVisiblePhotos(seekGroupData.fromLoc.photos);
        setVisiblePhotoLocationId(seekGroupData.fromLoc.id);
        setShowPhotoOverlay(true);
        setPhotoOverlayOpacity(1);
      } else if (
        (seekPhase === "HOVER" || seekPhase === "ZOOM_OUT") &&
        seekGroup > 0
      ) {
        // Previous group's photos may still be fading out
        const prevGroup = groups[seekGroup - 1];
        if (prevGroup?.toLoc.photos.length) {
          setVisiblePhotos(prevGroup.toLoc.photos);
          setVisiblePhotoLocationId(prevGroup.toLoc.id);
          setShowPhotoOverlay(true);
          setPhotoOverlayOpacity(seekPhase === "HOVER" ? 1 : 0.3);
        } else {
          setVisiblePhotos([]);
          setVisiblePhotoLocationId(null);
          setShowPhotoOverlay(false);
          setPhotoOverlayOpacity(0);
        }
      } else {
        setVisiblePhotos([]);
        setVisiblePhotoLocationId(null);
        setShowPhotoOverlay(false);
        setPhotoOverlayOpacity(0);
      }
    } else {
      setVisiblePhotos([]);
      setVisiblePhotoLocationId(null);
      setShowPhotoOverlay(false);
      setPhotoOverlayOpacity(0);
    }
  }, [locations, setBreadcrumbs, setShowPhotoOverlay, setPhotoOverlayOpacity, setVisiblePhotos]);

  useEffect(() => () => clearAlbumSequenceTimersRef.current(), []);

  const handleFlyToAlbumComplete = useCallback((locationId: string) => {
    completeAlbumSequenceRef.current(locationId);
  }, []);

  const handleEditLayout = useCallback((locationId: string) => {
    setEditingLocationId(locationId);
  }, []);

  const handleLocationClick = useCallback(
    (index: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const totalDuration = engine.getTotalDuration();
      if (totalDuration <= 0) return;

      const timeline = engine.getTimeline();
      const groups = engine.getGroups();

      let seekTime = 0;

      if (index === 0) {
        // First location: seek to HOVER phase start of first group
        if (timeline.length > 0) {
          const hoverPhase = timeline[0].phases.find(
            (p) => p.phase === "HOVER",
          );
          seekTime = hoverPhase ? hoverPhase.startTime : timeline[0].startTime;
        }
      } else {
        // Find the group whose toLoc or allLocations contains this location
        const targetLoc = locations[index];
        if (targetLoc) {
          for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi];
            if (group.toLoc.id === targetLoc.id) {
              // Exact match on toLoc — seek to ARRIVE phase
              const arrivePhase = timeline[gi]?.phases.find(
                (p) => p.phase === "ARRIVE",
              );
              if (arrivePhase) {
                seekTime = arrivePhase.startTime;
              } else if (timeline[gi]) {
                seekTime = timeline[gi].startTime + timeline[gi].duration;
              }
              break;
            }
            // Check if this is an intermediate waypoint within the group
            const locIdx = group.allLocations.findIndex(
              (l) => l.id === targetLoc.id,
            );
            if (locIdx > 0 && locIdx < group.allLocations.length - 1) {
              // Waypoint found — seek proportionally by accumulated route distance within FLY phase
              const flyPhase = timeline[gi]?.phases.find(
                (p) => p.phase === "FLY",
              );
              if (
                flyPhase &&
                group.mergedGeometry &&
                group.mergedGeometry.coordinates.length >= 2
              ) {
                // Compute accumulated segment lengths to find distance-based fraction
                let accumulatedDist = 0;
                let totalDist = 0;
                try {
                  const mergedLine = lineString(group.mergedGeometry.coordinates);
                  totalDist = length(mergedLine);
                  // Sum segment distances up to the waypoint (locIdx segments from start)
                  for (let si = 0; si < group.segments.length; si++) {
                    const seg = group.segments[si];
                    if (seg.geometry && seg.geometry.coordinates.length >= 2) {
                      const segLen = length(lineString(seg.geometry.coordinates));
                      if (si < locIdx) {
                        accumulatedDist += segLen;
                      }
                    }
                  }
                } catch {
                  // Fallback to ordinal fraction
                  totalDist = 1;
                  accumulatedDist = locIdx / (group.allLocations.length - 1);
                }
                const fraction =
                  totalDist > 0
                    ? accumulatedDist / totalDist
                    : locIdx / (group.allLocations.length - 1);
                seekTime = flyPhase.startTime + flyPhase.duration * fraction;
              } else if (flyPhase) {
                const fraction = locIdx / (group.allLocations.length - 1);
                seekTime = flyPhase.startTime + flyPhase.duration * fraction;
              }
              break;
            }
          }
        }
      }

      engine.seekTo(seekTime / totalDuration);
      engine.pause();
      setPlaybackState("paused");
    },
    [locations, setPlaybackState],
  );

  const jumpToLocation = useCallback((index: number) => {
    setSelectedLocationIndex(index);
    handleLocationClick(index);
  }, [handleLocationClick]);

  const openGoToStopDialog = useCallback(() => {
    setGoToStopQuery("");
    setGoToStopError(null);
    setGoToStopOpen(true);
  }, []);

  const closeGoToStopDialog = useCallback((nextOpen: boolean) => {
    setGoToStopOpen(nextOpen);
    if (!nextOpen) {
      setGoToStopError(null);
      setGoToStopQuery("");
    }
  }, []);

  const goToStopPreview = useMemo(() => {
    const query = goToStopQuery.trim();
    if (!query) {
      return null;
    }

    if (/^\d+$/.test(query)) {
      const targetIndex = Number.parseInt(query, 10) - 1;
      const targetLocation = locations[targetIndex];
      if (!targetLocation) {
        return null;
      }

      return `${targetIndex + 1}. ${targetLocation.name || "Untitled stop"}`;
    }

    const normalizedQuery = query.toLocaleLowerCase();
    const targetIndex = locations.findIndex((location) =>
      location.name.toLocaleLowerCase().includes(normalizedQuery) ||
      (location.nameLocal?.toLocaleLowerCase() ?? "").includes(normalizedQuery),
    );

    if (targetIndex === -1) {
      return null;
    }

    const targetLocation = locations[targetIndex];
    return `${targetIndex + 1}. ${targetLocation.name || "Untitled stop"}`;
  }, [goToStopQuery, locations]);

  const handleGoToStopSubmit = useCallback(() => {
    const query = goToStopQuery.trim();
    if (!query) {
      setGoToStopError("Enter a stop number or name.");
      return;
    }

    let targetIndex = -1;
    if (/^\d+$/.test(query)) {
      targetIndex = Number.parseInt(query, 10) - 1;
    } else {
      const normalizedQuery = query.toLocaleLowerCase();
      targetIndex = locations.findIndex((location) =>
        location.name.toLocaleLowerCase().includes(normalizedQuery) ||
        (location.nameLocal?.toLocaleLowerCase() ?? "").includes(normalizedQuery),
      );
    }

    if (targetIndex < 0 || targetIndex >= locations.length) {
      setGoToStopError(`No stop matches "${query}".`);
      return;
    }

    jumpToLocation(targetIndex);
    setGoToStopOpen(false);
    setGoToStopQuery("");
    setGoToStopError(null);
  }, [goToStopQuery, jumpToLocation, locations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const editableTarget = isEditableTarget(e.target);

      if (goToStopOpen && e.code === "Escape") {
        setGoToStopOpen(false);
        setGoToStopError(null);
        return;
      }

      if (editableTarget) return;

      if (mod && key === "g") {
        e.preventDefault();
        openGoToStopDialog();
        return;
      }

      if (!mod && !e.altKey && !e.shiftKey && e.key === "/") {
        e.preventDefault();
        openGoToStopDialog();
        return;
      }

      if (goToStopOpen) {
        return;
      }

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        const { canUndo, undo } = useHistoryStore.getState();
        if (canUndo) {
          undo();
        }
        return;
      }
      if (mod && key === "z" && e.shiftKey) {
        e.preventDefault();
        const { canRedo, redo } = useHistoryStore.getState();
        if (canRedo) {
          redo();
        }
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        const state = useAnimationStore.getState().playbackState;
        if (state === "playing") handlePause();
        else handlePlay();
        return;
      }
      if (e.code === "KeyR") {
        handleReset();
        return;
      }
      // Number keys 1-9: jump to stop
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && locations[num - 1]) {
        e.preventDefault();
        jumpToLocation(num - 1);
        return;
      }
      if (e.code === "Escape") {
        setSelectedLocationIndex(null);
        setEditingLocationId(null);
        return;
      }
      if (e.code === "Backspace" || e.code === "Delete") {
        if (selectedLocationIndex !== null && locations[selectedLocationIndex]) {
          e.preventDefault();
          const loc = locations[selectedLocationIndex];
          useProjectStore.getState().removeLocation(loc.id);
          useUIStore.getState().addToast({ title: `Removed ${loc.name}`, variant: "info" });
          setSelectedLocationIndex(null);
        }
        return;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    goToStopOpen,
    handlePause,
    handlePlay,
    handleReset,
    jumpToLocation,
    locations,
    openGoToStopDialog,
    selectedLocationIndex,
  ]);

  const isPlaying = playbackState === "playing";
  const isPlaybackActive =
    playbackState === "playing" || playbackState === "paused";
  const hasSegments = segments.length > 0;
  const showDesktopSidebar = leftPanelOpen && !immersiveMode;
  const showImmersiveToggle = isPlaybackActive || immersiveMode;
  const immersiveExpandLocked = isTabletViewport && playbackState === "playing";

  const handleImmersiveToggle = useCallback(() => {
    if (!showDesktopSidebar && immersiveExpandLocked) {
      return;
    }

    if (showDesktopSidebar) {
      setImmersiveMode(true);
      return;
    }

    setLeftPanelOpen(true);
    setImmersiveMode(false);
  }, [
    immersiveExpandLocked,
    setImmersiveMode,
    setLeftPanelOpen,
    showDesktopSidebar,
  ]);

  const dismissHint = useCallback((hintKey: OnboardingHintKey) => {
    setOnboardingState((current) => {
      if (!current || current[hintKey]) {
        return current;
      }

      const nextState = {
        ...current,
        [hintKey]: true,
      };
      persistOnboardingState(nextState);
      return nextState;
    });
  }, []);

  const searchHintMessage =
    onboardingState && !onboardingState.searchStart && locations.length === 0
      ? "Search for a city above to start building your route"
      : onboardingState &&
          !onboardingState.searchSecondStop &&
          locations.length === 1
        ? "Add one more city above to create your first route segment"
        : undefined;

  const handleSearchHintDismiss = useCallback(() => {
    if (!onboardingState) return;

    if (!onboardingState.searchStart && locations.length === 0) {
      dismissHint("searchStart");
      return;
    }

    if (!onboardingState.searchSecondStop && locations.length === 1) {
      dismissHint("searchSecondStop");
    }
  }, [dismissHint, locations.length, onboardingState]);

  const playHintMessage =
    onboardingState &&
    !onboardingState.playPreview &&
    locations.length >= 2 &&
    hasSegments
      ? "Press Play to preview your route animation"
      : undefined;

  useEffect(() => {
    if (
      searchHintMessage &&
      typeof window !== "undefined" &&
      window.innerWidth < 768
    ) {
      setBottomSheetState("half");
    }
  }, [searchHintMessage, setBottomSheetState]);

  const handleFocusSearch = useCallback(() => {
    searchRef.current?.focus();
  }, []);

  const handleLoadDemo = useCallback(() => {
    window.location.href = "?demo=true";
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#FAFAFA]">
      {!isPlaying && <TopToolbar />}
      {!isPlaying && <QuickStyleBar />}
      <div className="relative flex flex-1 overflow-hidden">
        <div
          className={`hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out md:block ${
            showDesktopSidebar ? "w-[400px]" : "w-0"
          }`}
        >
          <div
            className={`h-full w-[400px] transition-transform duration-300 ease-in-out ${
              showDesktopSidebar ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <LeftPanel
              onLocationClick={jumpToLocation}
              onEditLayout={handleEditLayout}
              selectedLocationIndex={selectedLocationIndex}
              onSelectedLocationIndexChange={setSelectedLocationIndex}
              searchHintMessage={searchHintMessage}
              onDismissSearchHint={handleSearchHintDismiss}
              searchRef={searchRef}
            />
          </div>
        </div>
        {showImmersiveToggle && (
          <button
            type="button"
            onClick={handleImmersiveToggle}
            className="absolute top-1/2 z-30 hidden h-11 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-950/65 text-white/80 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.9)] backdrop-blur-sm transition-all duration-300 ease-in-out hover:border-white/30 hover:bg-slate-900/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/15 disabled:hover:bg-slate-950/65 disabled:hover:text-white/80 md:flex"
            style={{
              left: showDesktopSidebar ? "372px" : "12px",
            }}
            aria-label={showDesktopSidebar ? "Collapse sidebar" : "Expand sidebar"}
            aria-pressed={showDesktopSidebar}
            disabled={!showDesktopSidebar && immersiveExpandLocked}
          >
            {showDesktopSidebar ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        <div className="relative flex-1 min-w-0 overflow-hidden bg-slate-950">
          {viewportRatio === "free" ? (
            <div ref={stageViewportRef} className="absolute inset-0">
              <div ref={mapContainerRef} className="relative h-full w-full">
                <MapStage
                  cityLabelSize={cityLabelSize}
                  currentCityLabel={currentCityLabel}
                  currentCityEmoji={currentCityEmoji}
                  editingLocation={editingLocation}
                  hasSegments={hasSegments}
                  photos={visiblePhotos}
                  photoLayout={visiblePhotoLocation?.photoLayout}
                  photoLocationId={visiblePhotoLocation?.id ?? null}
                  photoOverlayOpacity={photoOverlayOpacity}
                  playHintMessage={playHintMessage}
                  showPhotoOverlay={showPhotoOverlay}
                  showEmptyState={locations.length === 0}
                  stageBottomInsetPx={stageViewportBottomInsetPx}
                  onFocusSearch={handleFocusSearch}
                  onHintDismiss={() => dismissHint("playPreview")}
                  onLoadDemo={handleLoadDemo}
                  onPause={handlePause}
                  onPlay={handlePlay}
                  onReset={handleReset}
                  onSeek={handleSeek}
                  onFlyToAlbumComplete={handleFlyToAlbumComplete}
                  onStopEditingLayout={() => setEditingLocationId(null)}
                />
              </div>
            </div>
          ) : (
            <div
              ref={stageViewportRef}
              className="flex h-full w-full items-center justify-center p-1 md:p-6"
            >
              {constrainedMapSize && (
                <div
                  ref={mapContainerRef}
                  className={`relative rounded-lg border border-white/10 bg-background shadow-2xl ${locations.length === 0 ? "" : "overflow-hidden"}`}
                  style={{
                    width: constrainedMapSize.width,
                    height: constrainedMapSize.height,
                  }}
                >
                  <MapStage
                    cityLabelSize={cityLabelSize}
                    currentCityLabel={currentCityLabel}
                    currentCityEmoji={currentCityEmoji}
                    editingLocation={editingLocation}
                    hasSegments={hasSegments}
                    photos={visiblePhotos}
                    photoLayout={visiblePhotoLocation?.photoLayout}
                    photoLocationId={visiblePhotoLocation?.id ?? null}
                    photoOverlayOpacity={photoOverlayOpacity}
                    playHintMessage={playHintMessage}
                    showPhotoOverlay={showPhotoOverlay}
                    showEmptyState={locations.length === 0}
                    stageBottomInsetPx={0}
                    onFocusSearch={handleFocusSearch}
                    onHintDismiss={() => dismissHint("playPreview")}
                    onLoadDemo={handleLoadDemo}
                    onPause={handlePause}
                    onPlay={handlePlay}
                    onReset={handleReset}
                    onSeek={handleSeek}
                    onFlyToAlbumComplete={handleFlyToAlbumComplete}
                    onStopEditingLayout={() => setEditingLocationId(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Mobile bottom sheet — hidden during playback */}
      {!isPlaying && (
        <div className="md:hidden">
          <BottomSheet
            onLocationClick={jumpToLocation}
            onEditLayout={handleEditLayout}
            selectedLocationIndex={selectedLocationIndex}
            onSelectedLocationIndexChange={setSelectedLocationIndex}
            searchHintMessage={searchHintMessage}
            onDismissSearchHint={handleSearchHintDismiss}
          />
        </div>
      )}
      <Dialog open={goToStopOpen} onOpenChange={closeGoToStopDialog}>
        <DialogContent
          className="touch-target-mobile-scope sm:max-w-sm"
          showCloseButton={false}
        >
          <DialogHeader className="pr-10">
            <DialogTitle style={{ color: brand.colors.warm[900] }}>
              Go to stop
            </DialogTitle>
            <DialogDescription style={{ color: brand.colors.warm[600] }}>
              Type a stop number or name. Shortcuts: `1-9`, `Ctrl+G`, or `/`.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              ref={goToStopInputRef}
              value={goToStopQuery}
              onChange={(event) => {
                setGoToStopQuery(event.target.value);
                if (goToStopError) {
                  setGoToStopError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleGoToStopSubmit();
                }
              }}
              placeholder="12 or Kyoto"
              className="h-11 rounded-2xl border-[#fed7aa] bg-white/90 px-3 text-sm focus-visible:border-[#f97316] focus-visible:ring-[#f97316]/15"
              aria-label="Go to stop"
            />

            {goToStopPreview && !goToStopError && (
              <p className="text-xs font-medium" style={{ color: brand.colors.warm[500] }}>
                Jumping to {goToStopPreview}
              </p>
            )}

            {goToStopError && (
              <p className="text-xs font-medium text-[#b91c1c]">
                {goToStopError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-full border px-3 py-1.5 text-xs font-medium"
                onClick={() => closeGoToStopDialog(false)}
                style={{
                  borderColor: brand.colors.warm[200],
                  color: brand.colors.warm[600],
                  backgroundColor: "rgba(255,255,255,0.8)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white"
                onClick={handleGoToStopSubmit}
                style={{
                  backgroundColor: brand.colors.primary[500],
                  boxShadow: brand.shadows.sm,
                }}
              >
                Jump
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EditorLayout() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  return (
    <MapProvider>
      <EditorContent />
      <ExportDialog />
      <ProjectListDialog />
      <ToastViewport toasts={toasts} onDismiss={removeToast} dismissAfterMs={2500} />
    </MapProvider>
  );
}
