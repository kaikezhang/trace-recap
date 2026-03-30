"use client";

import { AnimatePresence, motion } from "framer-motion";
import MapCanvas from "./MapCanvas";
import PlaybackControls from "./PlaybackControls";
import PhotoOverlay from "./PhotoOverlay";
import PhotoLayoutEditor from "./PhotoLayoutEditor";
import MapEmptyState from "./MapEmptyState";
import { useAnimationStore } from "@/stores/animationStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Location, Photo, PhotoLayout } from "@/types";

interface MapStageProps {
  cityLabelSize: number;
  currentCityLabel?: string | null;
  editingLocation: Location | null;
  hasSegments: boolean;
  photos: Photo[];
  photoLayout?: PhotoLayout;
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
}: {
  cityLabel: string;
  cityLabelSize: number;
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
      className="absolute top-6 left-1/2 z-10 -translate-x-1/2 rounded-lg border bg-background/90 px-5 py-2 shadow-lg backdrop-blur-sm"
      style={{
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
  cityLabelSize,
  currentCityLabel,
  editingLocation,
  hasSegments,
  photos,
  photoLayout,
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
          />
        )}
      </AnimatePresence>
      {/* Route segment indicator — inside the map container */}
      <AnimatePresence>
        {isPlaying && fromCity && toCity && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg text-xs font-medium text-gray-700"
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
