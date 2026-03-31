"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MapProvider, useMap } from "./MapContext";
import TopToolbar from "./TopToolbar";
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
import * as turf from "@turf/turf";
import { AnimationEngine } from "@/engine/AnimationEngine";
import { demoProject } from "@/lib/demoProject";
import {
  initializeProjectPersistence,
  useProjectStore,
} from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";
import { useUIStore } from "@/stores/uiStore";
import { useHistoryStore } from "@/stores/historyStore";
import { computeContainedViewportSize } from "@/lib/viewportRatio";

const ONBOARDING_STORAGE_KEY = "trace-recap-onboarded";

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

function EditorContent() {
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const loadRouteData = useProjectStore((s) => s.loadRouteData);
  const segmentTimingOverrides = useProjectStore(
    (s) => s.segmentTimingOverrides,
  );
  const engineRef = useRef<AnimationEngine | null>(null);
  const demoLoadedRef = useRef(false);

  const setPlaybackState = useAnimationStore((s) => s.setPlaybackState);
  const setCurrentTime = useAnimationStore((s) => s.setCurrentTime);
  const setTotalDuration = useAnimationStore((s) => s.setTotalDuration);
  const setCurrentCityLabel = useAnimationStore((s) => s.setCurrentCityLabel);
  const setCurrentCityLabelZh = useAnimationStore(
    (s) => s.setCurrentCityLabelZh,
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
  const setBloomOrigin = useAnimationStore((s) => s.setBloomOrigin);
  const setBloomElapsedTime = useAnimationStore((s) => s.setBloomElapsedTime);

  const setVisitedLocationIds = useAnimationStore((s) => s.setVisitedLocationIds);
  const setCurrentArrivalLocationId = useAnimationStore((s) => s.setCurrentArrivalLocationId);
  const reset = useAnimationStore((s) => s.reset);

  const cityLabelSize = useUIStore((s) => s.cityLabelSize);
  const cityLabelLang = useUIStore((s) => s.cityLabelLang);
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const setBottomSheetState = useUIStore((s) => s.setBottomSheetState);

  const stageViewportRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [availableStageSize, setAvailableStageSize] = useState({
    width: 0,
    height: 0,
  });

  const constrainedMapSize = useMemo(
    () =>
      computeContainedViewportSize(
        availableStageSize.width,
        availableStageSize.height,
        viewportRatio,
      ),
    [availableStageSize.height, availableStageSize.width, viewportRatio],
  );

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

      const textFieldExpr =
        cityLabelLang === "zh"
          ? (["coalesce", ["get", "name_zh-Hans"], ["get", "name_zh-Hant"], ["get", "name"]] as mapboxgl.ExpressionSpecification)
          : (["coalesce", ["get", "name_en"], ["get", "name"]] as mapboxgl.ExpressionSpecification);

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
  }, [map, cityLabelLang]);

  const currentCityLabelEn = useAnimationStore((s) => s.currentCityLabel);
  const currentCityLabelZh = useAnimationStore((s) => s.currentCityLabelZh);
  const currentCityLabel =
    cityLabelLang === "zh"
      ? currentCityLabelZh || currentCityLabelEn
      : currentCityLabelEn;
  const visiblePhotos = useAnimationStore((s) => s.visiblePhotos);
  const showPhotoOverlay = useAnimationStore((s) => s.showPhotoOverlay);
  const photoOverlayOpacity = useAnimationStore((s) => s.photoOverlayOpacity);
  const bloomOrigin = useAnimationStore((s) => s.bloomOrigin);
  const bloomElapsedTime = useAnimationStore((s) => s.bloomElapsedTime);

  const searchRef = useRef<CitySearchHandle>(null);

  const [editingLocationId, setEditingLocationId] = useState<string | null>(
    null,
  );
  const editingLocation =
    locations.find((l) => l.id === editingLocationId) ?? null;
  const [visiblePhotoLocationId, setVisiblePhotoLocationId] = useState<
    string | null
  >(null);
  const visiblePhotoLocation =
    locations.find((l) => l.id === visiblePhotoLocationId) ?? null;

  // Bloom origin tracking: project city coords to screen space
  useEffect(() => {
    if (!map) return;

    const updateBloomOrigin = () => {
      const locId = useAnimationStore.getState().showPhotoOverlay
        ? visiblePhotoLocationId
        : null;
      const loc = locId ? locations.find((l) => l.id === locId) : null;
      if (!loc) {
        setBloomOrigin(null);
        return;
      }
      const point = map.project(loc.coordinates as [number, number]);
      
      // Pass raw pixel coordinates; PhotoOverlay converts to its own local space
      setBloomOrigin({ x: point.x, y: point.y });
    };

    updateBloomOrigin();
    map.on("move", updateBloomOrigin);
    return () => {
      map.off("move", updateBloomOrigin);
    };
  }, [map, visiblePhotoLocationId, locations, setBloomOrigin]);

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
  }, []);

  useEffect(() => {
    setOnboardingState(readOnboardingState());
  }, []);

  useEffect(() => {
    if (!demoQueryChecked || !shouldLoadDemo || demoLoadedRef.current) return;

    demoLoadedRef.current = true;

    const loadDemoProject = async () => {
      try {
        await createNewProject(demoProject.name);
        await loadRouteData(demoProject);
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
  }, [createNewProject, demoQueryChecked, loadRouteData, shouldLoadDemo]);

  // Rebuild engine when project changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    reset();

    if (!map || segments.length === 0) return;

    const allReady = segments.every((s) => s.geometry !== null);
    if (!allReady) return;

    const engine = new AnimationEngine(
      map,
      locations,
      segments,
      segmentTimingOverrides,
    );
    engineRef.current = engine;
    setTotalDuration(engine.getTotalDuration());
    setTimeline(engine.getTimeline());

    engine.on("progress", (e) => {
      setCurrentTime(e.time);
      setCurrentSegmentIndex(e.segmentIndex);
      setCurrentGroupSegmentIndices(e.groupSegmentIndices);
      setCurrentCityLabel(e.cityLabel);
      setCurrentCityLabelZh(e.cityLabelZh);
      setShowPhotoOverlay(e.showPhotos);
      setPhotoOverlayOpacity(e.photoOpacity);
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

          // toLoc: arriving during ARRIVE phase, visited after
          if (!group.toLoc.isWaypoint) {
            const arrive = entry.phases.find(
              (p: { phase: string }) => p.phase === "ARRIVE",
            );
            if (arrive) {
              const arriveEnd = arrive.startTime + arrive.duration;
              if (t >= arrive.startTime && t < arriveEnd) {
                newArrival = group.toLoc.id;
              } else if (t >= arriveEnd) {
                newVisited.push(group.toLoc.id);
              }
            }
          }
        }

        setVisitedLocationIds(newVisited);
        setCurrentArrivalLocationId(newArrival);
      }

      // Drive bloom elapsed time from engine timeline (not wall-clock)
      if (e.showPhotos && e.phase === "ARRIVE") {
        const tl = engine.getTimeline();
        const entry = tl[e.segmentIndex];
        const arrivePhase = entry?.phases.find(
          (p: { phase: string }) => p.phase === "ARRIVE",
        );
        if (arrivePhase) {
          setBloomElapsedTime(Math.max(0, e.time - arrivePhase.startTime));
        }
      }

      if (e.showPhotos) {
        if (e.phase === "ARRIVE") {
          // During ARRIVE: set current destination's photos
          const seg = segments[e.segmentIndex];
          const toLoc = locations.find((l) => l.id === seg?.toId);
          setVisiblePhotos(toLoc?.photos || []);
          setVisiblePhotoLocationId(toLoc?.id ?? null);
        }
        // During HOVER/ZOOM_OUT fade-out: keep previous photos (don't update)
      } else {
        // Don't clear outgoing photos/location when a scene transition is active —
        // the outgoing location's photoLayout must persist for correct transition resolution
        if (e.sceneTransitionProgress === undefined) {
          setVisiblePhotos([]);
          setVisiblePhotoLocationId(null);
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

      // Bloom elapsed time: compute from timeline so preview matches export
      if (e.showPhotos && e.phase === "ARRIVE") {
        const tl = engine.getTimeline();
        const entry = tl[e.groupIndex];
        if (entry) {
          const arrivePhase = entry.phases.find((p) => p.phase === "ARRIVE");
          if (arrivePhase) {
            setBloomElapsedTime(Math.max(0, e.time - arrivePhase.startTime));
          }
        }
      } else if (!e.showPhotos) {
        setBloomElapsedTime(0);
      }
      // During HOVER/ZOOM_OUT fade-out: keep last ARRIVE value (bloom fully expanded)
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
          ? turf.length(turf.lineString(mergedGeom.coordinates))
          : 0;

      let accumulatedLength = 0;
      const drawnDistance = fraction * mergedLength;

      for (let gi = 0; gi < groupSegIndices.length; gi++) {
        const segIdx = groupSegIndices[gi];
        const seg = segments[segIdx];
        if (!seg?.geometry || seg.geometry.coordinates.length < 2) continue;
        if (!map.getSource(`${SEGMENT_SOURCE_PREFIX}${seg.id}`)) continue;

        const segLength = turf.length(
          turf.lineString(seg.geometry.coordinates),
        );
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
    };
  }, [map, locations, segments, segmentTimingOverrides]);

  const handlePlay = useCallback(() => {
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

  }, [map, setPlaybackState]);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
    setPlaybackState("paused");
  }, [setPlaybackState]);

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    reset();
  }, [reset]);

  const handleSeek = useCallback((progress: number) => {
    engineRef.current?.seekTo(progress);
  }, []);

  const handleEditLayout = useCallback((locationId: string) => {
    setEditingLocationId(locationId);
  }, []);

  const handleLocationClick = useCallback(
    (index: number) => {
      const targetLoc = locations[index];
      if (targetLoc) {
        setEditingLocationId(targetLoc.id);
      }

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
                  const mergedLine = turf.lineString(
                    group.mergedGeometry.coordinates,
                  );
                  totalDist = turf.length(mergedLine);
                  // Sum segment distances up to the waypoint (locIdx segments from start)
                  for (let si = 0; si < group.segments.length; si++) {
                    const seg = group.segments[si];
                    if (seg.geometry && seg.geometry.coordinates.length >= 2) {
                      const segLen = turf.length(
                        turf.lineString(seg.geometry.coordinates),
                      );
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }
      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        const state = useAnimationStore.getState().playbackState;
        if (state === "playing") handlePause();
        else handlePlay();
      } else if (e.code === "KeyR") {
        handleReset();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePlay, handlePause, handleReset]);

  const playbackState = useAnimationStore((s) => s.playbackState);
  const isPlaying = playbackState === "playing";
  const hasSegments = segments.length > 0;

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
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          onLocationClick={handleLocationClick}
          onEditLayout={handleEditLayout}
          searchHintMessage={searchHintMessage}
          onDismissSearchHint={handleSearchHintDismiss}
          searchRef={searchRef}
        />
        <div className="relative flex-1 min-w-0 overflow-hidden bg-slate-950">
          {viewportRatio === "free" ? (
            <div ref={stageViewportRef} className="absolute inset-0">
              <div ref={mapContainerRef} className="relative h-full w-full">
                <MapStage
                  cityLabelSize={cityLabelSize}
                  currentCityLabel={currentCityLabel}
                  editingLocation={editingLocation}
                  hasSegments={hasSegments}
                  photos={visiblePhotos}
                  photoLayout={visiblePhotoLocation?.photoLayout}
                  photoLocationId={visiblePhotoLocation?.id ?? null}
                  bloomOrigin={bloomOrigin}
                  bloomElapsedTime={bloomElapsedTime}
                  photoOverlayOpacity={photoOverlayOpacity}
                  playHintMessage={playHintMessage}
                  showPhotoOverlay={showPhotoOverlay}
                  showEmptyState={locations.length === 0}
                  onFocusSearch={handleFocusSearch}
                  onHintDismiss={() => dismissHint("playPreview")}
                  onLoadDemo={handleLoadDemo}
                  onPause={handlePause}
                  onPlay={handlePlay}
                  onReset={handleReset}
                  onSeek={handleSeek}
                  onStopEditingLayout={() => setEditingLocationId(null)}
                />
              </div>
            </div>
          ) : (
            <div
              ref={stageViewportRef}
              className="flex h-full w-full items-start justify-center p-1 md:items-center md:p-6"
            >
              {constrainedMapSize && (
                <div
                  ref={mapContainerRef}
                  className="relative overflow-hidden rounded-lg border border-white/10 bg-background shadow-2xl"
                  style={{
                    width: constrainedMapSize.width,
                    height: constrainedMapSize.height,
                  }}
                >
                  <MapStage
                    cityLabelSize={cityLabelSize}
                    currentCityLabel={currentCityLabel}
                    editingLocation={editingLocation}
                    hasSegments={hasSegments}
                    photos={visiblePhotos}
                    photoLayout={visiblePhotoLocation?.photoLayout}
                    photoLocationId={visiblePhotoLocation?.id ?? null}
                    bloomOrigin={bloomOrigin}
                    bloomElapsedTime={bloomElapsedTime}
                    photoOverlayOpacity={photoOverlayOpacity}
                    playHintMessage={playHintMessage}
                    showPhotoOverlay={showPhotoOverlay}
                    showEmptyState={locations.length === 0}
                    onFocusSearch={handleFocusSearch}
                    onHintDismiss={() => dismissHint("playPreview")}
                    onLoadDemo={handleLoadDemo}
                    onPause={handlePause}
                    onPlay={handlePlay}
                    onReset={handleReset}
                    onSeek={handleSeek}
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
            onLocationClick={handleLocationClick}
            onEditLayout={handleEditLayout}
            searchHintMessage={searchHintMessage}
            onDismissSearchHint={handleSearchHintDismiss}
          />
        </div>
      )}
    </div>
  );
}

export default function EditorLayout() {
  return (
    <MapProvider>
      <EditorContent />
      <ExportDialog />
      <ProjectListDialog />
    </MapProvider>
  );
}
