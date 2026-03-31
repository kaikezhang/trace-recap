"use client";

import { AnimatePresence, motion } from "framer-motion";
import MapCanvas from "./MapCanvas";
import PlaybackControls from "./PlaybackControls";
import PhotoOverlay from "./PhotoOverlay";
import PhotoLayoutEditor from "./PhotoLayoutEditor";
import MapEmptyState from "./MapEmptyState";
import ChapterPinsOverlay from "./ChapterPinsOverlay";
import { useAnimationStore } from "@/stores/animationStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Location, Photo, PhotoLayout } from "@/types";
import { resolveSceneTransition } from "@/lib/sceneTransition";

interface MapStageProps {
  cityLabelSize: number;
  currentCityLabel?: string | null;
  editingLocation: Location | null;
  hasSegments: boolean;
  bloomOrigin: { x: number; y: number } | null;
  bloomElapsedTime: number;
  photos: Photo[];
  photoLayout?: PhotoLayout;
  photoLocationId?: string | null;
  photoOverlayOpacity: number;
  playHintMessage?: string;
  showPhotoOverlay: boolean;
  onFocusSearch: () => void;
  onHintDismiss: () => void;
  onLoadDemo: () => void;
  onPause: () => void;
  onPlay: () => void;
  onReset: () => void;
  onSeek: (progress: number) => void;
  onStopEditingLayout: () => void;
  showEmptyState: boolean;
}

function CityLabelOverlay({
  cityLabel,
  cityLabelSize,
  cityLabelTopPercent,
}: {
  cityLabel: string;
  cityLabelSize: number;
  cityLabelTopPercent: number;
}) {
  return (
    <motion.div
      key={cityLabel}
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
      className="absolute left-1/2 z-10 -translate-x-1/2 rounded-lg border bg-background/90 px-5 py-2 shadow-lg backdrop-blur-sm"
      style={{
        top: `${cityLabelTopPercent}%`,
        textShadow:
          "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
      }}
    >
      <p
        className="flex items-center gap-2 font-semibold"
        style={{ fontSize: `${cityLabelSize}px` }}
      >
        <svg
          className="h-4 w-4 shrink-0 text-indigo-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
            clipRule="evenodd"
          />
        </svg>
        {cityLabel}
      </p>
    </motion.div>
  );
}

export default function MapStage({
  bloomOrigin,
  bloomElapsedTime,
  cityLabelSize,
  currentCityLabel,
  editingLocation,
  hasSegments,
  photos,
  photoLayout,
  photoLocationId,
  photoOverlayOpacity,
  playHintMessage,
  showPhotoOverlay,
  onFocusSearch,
  onHintDismiss,
  onLoadDemo,
  onPause,
  onPlay,
  onReset,
  onSeek,
  onStopEditingLayout,
  showEmptyState,
}: MapStageProps) {
  const showPhotoLayoutEditor = Boolean(
    editingLocation && editingLocation.photos.length > 0,
  );

  const playbackState = useAnimationStore((s) => s.playbackState);
  const currentSegmentIndex = useAnimationStore((s) => s.currentSegmentIndex);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const segmentColors = useProjectStore((s) => s.segmentColors);
  const cityLabelTopPercent = useUIStore((s) => s.cityLabelTopPercent);
  const routeLabelBottomPercent = useUIStore((s) => s.routeLabelBottomPercent);
  const routeLabelSize = useUIStore((s) => s.routeLabelSize);
  const globalSceneTransition = useUIStore((s) => s.sceneTransition);
  const moodColorsEnabled = useUIStore((s) => s.moodColorsEnabled);

  // Scene transition state
  const sceneTransitionProgress = useAnimationStore((s) => s.sceneTransitionProgress);
  const incomingPhotos = useAnimationStore((s) => s.incomingPhotos);
  const incomingPhotoLocationId = useAnimationStore((s) => s.incomingPhotoLocationId);
  const transitionBearing = useAnimationStore((s) => s.transitionBearing);
  const visiblePhotoLocation = locations.find((location) => location.id === photoLocationId);
  const incomingLocation = locations.find((location) => location.id === incomingPhotoLocationId);
  const effectiveTransition = resolveSceneTransition(photoLayout, globalSceneTransition);
  const isTransitioning = effectiveTransition !== "cut" && sceneTransitionProgress !== undefined;

  const getPortalAccentColor = (locationId: string | null | undefined): string => {
    if (!locationId || !moodColorsEnabled) return "#ffffff";
    const segmentIndex = segments.findIndex((segment) => segment.toId === locationId);
    return segmentIndex >= 0 ? segmentColors[segmentIndex] ?? "#ffffff" : "#ffffff";
  };

  const isPlaying = playbackState === "playing";
  const currentSegment = segments[currentSegmentIndex];
  const fromCity = currentSegment
    ? locations.find((l) => l.id === currentSegment.fromId)?.name
    : null;
  const toCity = currentSegment
    ? locations.find((l) => l.id === currentSegment.toId)?.name
    : null;

  return (
    <div className="relative h-full w-full">
      <MapCanvas />
      <ChapterPinsOverlay />
      {showEmptyState && (
        <MapEmptyState
          onSearchClick={onFocusSearch}
          onLoadDemo={onLoadDemo}
        />
      )}
      <AnimatePresence>
        {currentCityLabel && (
          <CityLabelOverlay
            cityLabel={currentCityLabel}
            cityLabelSize={cityLabelSize}
            cityLabelTopPercent={cityLabelTopPercent}
          />
        )}
      </AnimatePresence>
      {/* Route segment indicator — inside the map container */}
      <AnimatePresence>
        {(isPlaying || playbackState === "paused") && !showPhotoOverlay && !currentCityLabel && fromCity && toCity && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-1/2 z-10 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg font-medium text-gray-700"
            style={{ bottom: `max(80px, ${routeLabelBottomPercent}%)`, fontSize: `${routeLabelSize}px` }}
          >
            {fromCity} → {toCity}
          </motion.div>
        )}
      </AnimatePresence>
      <PhotoOverlay
        photos={photos}
        visible={showPhotoOverlay}
        photoLayout={photoLayout}
        opacity={photoOverlayOpacity}
        bloomOrigin={bloomOrigin}
        bloomElapsedTime={bloomElapsedTime}
        sceneTransition={effectiveTransition}
        sceneTransitionProgress={isTransitioning ? sceneTransitionProgress : undefined}
        incomingPhotos={isTransitioning ? incomingPhotos : undefined}
        incomingPhotoLayout={isTransitioning ? incomingLocation?.photoLayout : undefined}
        transitionBearing={isTransitioning ? transitionBearing : undefined}
        originCoordinates={visiblePhotoLocation?.coordinates}
        incomingOriginCoordinates={isTransitioning ? incomingLocation?.coordinates : undefined}
        portalAccentColor={getPortalAccentColor(photoLocationId)}
        incomingPortalAccentColor={isTransitioning ? getPortalAccentColor(incomingPhotoLocationId) : undefined}
      />
      {showPhotoLayoutEditor && editingLocation && (
        <PhotoLayoutEditor
          location={editingLocation}
          onClose={onStopEditingLayout}
        />
      )}
      {hasSegments && !showPhotoLayoutEditor && (
        <PlaybackControls
          onPlay={onPlay}
          onPause={onPause}
          onReset={onReset}
          onSeek={onSeek}
          hintMessage={playHintMessage}
          onHintDismiss={onHintDismiss}
        />
      )}
    </div>
  );
}
