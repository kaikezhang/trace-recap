"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapProvider, useMap } from "./MapContext";
import TopToolbar from "./TopToolbar";
import LeftPanel from "./LeftPanel";
import BottomSheet from "./BottomSheet";
import MapCanvas from "./MapCanvas";
import PlaybackControls from "./PlaybackControls";
import PhotoOverlay from "./PhotoOverlay";
import PhotoLayoutEditor from "./PhotoLayoutEditor";
import ExportDialog from "./ExportDialog";
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

function EditorContent() {
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const importRoute = useProjectStore((s) => s.importRoute);
  const regenerateSegmentGeometries = useProjectStore(
    (s) => s.regenerateSegmentGeometries,
  );
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
  const reset = useAnimationStore((s) => s.reset);

  const cityLabelSize = useUIStore((s) => s.cityLabelSize);
  const cityLabelLang = useUIStore((s) => s.cityLabelLang);
  const setBottomSheetExpanded = useUIStore((s) => s.setBottomSheetExpanded);
  const currentCityLabelEn = useAnimationStore((s) => s.currentCityLabel);
  const currentCityLabelZh = useAnimationStore((s) => s.currentCityLabelZh);
  const currentCityLabel =
    cityLabelLang === "zh"
      ? currentCityLabelZh || currentCityLabelEn
      : currentCityLabelEn;
  const visiblePhotos = useAnimationStore((s) => s.visiblePhotos);
  const showPhotoOverlay = useAnimationStore((s) => s.showPhotoOverlay);
  const photoOverlayOpacity = useAnimationStore((s) => s.photoOverlayOpacity);

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
      importRoute(demoProject);
      await regenerateSegmentGeometries();

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("demo");
      window.history.replaceState(
        {},
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
      );
    };

    void loadDemoProject();
  }, [demoQueryChecked, importRoute, regenerateSegmentGeometries, shouldLoadDemo]);

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
        setVisiblePhotos([]);
        setVisiblePhotoLocationId(null);
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
      setBottomSheetExpanded(true);
    }
  }, [searchHintMessage, setBottomSheetExpanded]);

  return (
    <div className="flex h-screen flex-col">
      <TopToolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          onLocationClick={handleLocationClick}
          onEditLayout={handleEditLayout}
          searchHintMessage={searchHintMessage}
          onDismissSearchHint={handleSearchHintDismiss}
        />
        {/* Map area: full width on mobile, flex-1 on desktop */}
        <div className="flex-1 relative">
          <MapCanvas />
          {/* City label overlay */}
          <AnimatePresence>
            {currentCityLabel && (
              <motion.div
                key={currentCityLabel}
                initial={{
                  opacity: 0,
                  y: 20,
                  scale: 0.8,
                  filter: "blur(8px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                  scale: 0.95,
                  filter: "blur(4px)",
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-background/90 backdrop-blur-sm border shadow-lg px-5 py-2"
                style={{
                  textShadow:
                    "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
                }}
              >
                <p
                  className="font-semibold flex items-center gap-2"
                  style={{ fontSize: `${cityLabelSize}px` }}
                >
                  <svg
                    className="w-4 h-4 text-indigo-500 flex-shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {currentCityLabel}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Photo overlay */}
          <PhotoOverlay
            photos={visiblePhotos}
            visible={showPhotoOverlay}
            photoLayout={visiblePhotoLocation?.photoLayout}
            opacity={photoOverlayOpacity}
          />
          {/* Photo layout editor */}
          {editingLocation && editingLocation.photos.length > 0 && (
            <PhotoLayoutEditor
              location={editingLocation}
              onClose={() => setEditingLocationId(null)}
            />
          )}
          {/* Playback controls — hidden when layout editor is open */}
          {hasSegments && !editingLocation && (
            <PlaybackControls
              onPlay={handlePlay}
              onPause={handlePause}
              onReset={handleReset}
              onSeek={handleSeek}
              hintMessage={playHintMessage}
              onHintDismiss={() => dismissHint("playPreview")}
            />
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
    </MapProvider>
  );
}
