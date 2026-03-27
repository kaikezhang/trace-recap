"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as turf from "@turf/turf";
import mapboxgl from "mapbox-gl";
import { MapProvider, useMap } from "./MapContext";
import TopToolbar from "./TopToolbar";
import LeftPanel from "./LeftPanel";
import MapCanvas from "./MapCanvas";
import PlaybackControls from "./PlaybackControls";
import PhotoOverlay from "./PhotoOverlay";
import ExportDialog from "./ExportDialog";
import { AnimationEngine } from "@/engine/AnimationEngine";
import { useProjectStore } from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";

const ANIM_ROUTE_SOURCE = "anim-route-src";

function EditorContent() {
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const engineRef = useRef<AnimationEngine | null>(null);

  const setPlaybackState = useAnimationStore((s) => s.setPlaybackState);
  const setCurrentTime = useAnimationStore((s) => s.setCurrentTime);
  const setTotalDuration = useAnimationStore((s) => s.setTotalDuration);
  const setCurrentCityLabel = useAnimationStore((s) => s.setCurrentCityLabel);
  const setVisiblePhotos = useAnimationStore((s) => s.setVisiblePhotos);
  const setShowPhotoOverlay = useAnimationStore((s) => s.setShowPhotoOverlay);
  const reset = useAnimationStore((s) => s.reset);

  const currentCityLabel = useAnimationStore((s) => s.currentCityLabel);
  const visiblePhotos = useAnimationStore((s) => s.visiblePhotos);
  const showPhotoOverlay = useAnimationStore((s) => s.showPhotoOverlay);

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

    const engine = new AnimationEngine(map, locations, segments);
    engineRef.current = engine;
    setTotalDuration(engine.getTotalDuration());

    engine.on("progress", (e) => {
      setCurrentTime(e.time);
      setCurrentCityLabel(e.cityLabel);
      setShowPhotoOverlay(e.showPhotos);
      if (e.showPhotos) {
        const seg = segments[e.segmentIndex];
        const toLoc = locations.find((l) => l.id === seg?.toId);
        setVisiblePhotos(toLoc?.photos || []);
      } else {
        setVisiblePhotos([]);
      }
    });

    // Progressive route drawing
    engine.on("routeDrawProgress", (e) => {
      if (!map) return;
      const seg = segments[e.segmentIndex];
      if (!seg?.geometry || seg.geometry.coordinates.length < 2) return;

      const src = map.getSource(ANIM_ROUTE_SOURCE) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!src) return;

      const fraction = e.routeDrawFraction ?? 0;
      if (fraction <= 0) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      const line = turf.lineString(seg.geometry.coordinates);
      const totalLength = turf.length(line);
      const sliceLength = fraction * totalLength;

      const sliced = turf.lineSliceAlong(line, 0, sliceLength);

      src.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: sliced.geometry,
          },
        ],
      });
    });

    engine.on("complete", () => {
      setPlaybackState("idle");
    });

    return () => {
      engine.destroy();
    };
  }, [map, locations, segments]);

  const handlePlay = useCallback(() => {
    engineRef.current?.play();
    setPlaybackState("playing");
  }, [setPlaybackState]);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
    setPlaybackState("paused");
  }, [setPlaybackState]);

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    reset();
  }, [reset]);

  const handleSeek = useCallback(
    (progress: number) => {
      engineRef.current?.seekTo(progress);
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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

  const hasSegments = segments.length > 0;

  return (
    <div className="flex h-screen flex-col">
      <TopToolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
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
                <p className="text-lg font-semibold flex items-center gap-2">
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
          <PhotoOverlay photos={visiblePhotos} visible={showPhotoOverlay} />
          {/* Playback controls */}
          {hasSegments && (
            <PlaybackControls
              onPlay={handlePlay}
              onPause={handlePause}
              onReset={handleReset}
              onSeek={handleSeek}
            />
          )}
        </div>
      </div>
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
