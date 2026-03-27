"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapProvider, useMap } from "./MapContext";
import TopToolbar from "./TopToolbar";
import LeftPanel from "./LeftPanel";
import MapCanvas from "./MapCanvas";
import PlaybackControls from "./PlaybackControls";
import PhotoOverlay from "./PhotoOverlay";
import { AnimationEngine } from "@/engine/AnimationEngine";
import { useProjectStore } from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";

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

    // Only build engine if all segments have geometry
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
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-background/90 backdrop-blur-sm border shadow-lg px-5 py-2"
              >
                <p className="text-lg font-semibold">{currentCityLabel}</p>
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
    </MapProvider>
  );
}
