"use client";

import { Play, Pause, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAnimationStore } from "@/stores/animationStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import OnboardingHint from "./OnboardingHint";

interface PlaybackControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSeek: (progress: number) => void;
  hintMessage?: string;
  onHintDismiss?: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export default function PlaybackControls({
  onPlay,
  onPause,
  onReset,
  onSeek,
  hintMessage,
  onHintDismiss,
}: PlaybackControlsProps) {
  const playbackState = useAnimationStore((s) => s.playbackState);
  const currentTime = useAnimationStore((s) => s.currentTime);
  const totalDuration = useAnimationStore((s) => s.totalDuration);
  const currentSegmentIndex = useAnimationStore((s) => s.currentSegmentIndex);
  const bottomSheetExpanded = useUIStore((s) => s.bottomSheetExpanded);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isPlaying = playbackState === "playing";

  // Get current segment info for the pill
  const currentSegment = segments[currentSegmentIndex];
  const fromCity = currentSegment
    ? locations.find((l) => l.id === currentSegment.fromId)?.name
    : null;
  const toCity = currentSegment
    ? locations.find((l) => l.id === currentSegment.toId)?.name
    : null;

  return (
    <div
      className={[
        "flex flex-col items-center",
        // Mobile: fixed full-width, z above BottomSheet (z-50)
        "fixed left-0 right-0 z-[60] transition-[bottom] duration-300 ease-out",
        bottomSheetExpanded ? "bottom-[60vh]" : "bottom-14",
        // Desktop: override to absolute, centered floating pill
        "md:absolute md:z-10 md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:right-auto",
      ].join(" ")}
    >
      {/* Segment info pill — shown when playing */}
      <AnimatePresence>
        {isPlaying && fromCity && toCity && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-2 bg-white/90 backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg text-xs font-medium text-gray-700"
          >
            {fromCity} → {toCity}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls bar */}
      <div
        className={[
          "flex items-center gap-2 md:gap-3 bg-white/90 backdrop-blur-xl border border-white/50 shadow-xl px-3 md:px-4 py-2",
          "rounded-none md:rounded-2xl w-full md:w-auto",
        ].join(" ")}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onReset}
          aria-label="Reset playback"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="relative">
          <button
            className="h-12 w-12 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </button>
          {hintMessage && onHintDismiss && (
            <OnboardingHint
              message={hintMessage}
              onDismiss={onHintDismiss}
              className="bottom-[calc(100%+0.75rem)] left-1/2 w-56 -translate-x-1/2"
              arrowClassName="left-1/2 -bottom-[7px] -translate-x-1/2 border-l-0 border-t-0"
            />
          )}
        </div>
        <div className="flex-1 md:flex-none md:w-48">
          <Slider
            value={[progress]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={(v) => {
              const val = Array.isArray(v) ? v[0] : v;
              onSeek(val / 100);
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground min-w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}
