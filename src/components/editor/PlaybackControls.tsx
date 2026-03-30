"use client";

import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAnimationStore } from "@/stores/animationStore";
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
  const bottomSheetState = useUIStore((s) => s.bottomSheetState);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isPlaying = playbackState === "playing";

  // During playback, BottomSheet is hidden → controls go to bottom
  // Otherwise, position above the BottomSheet
  const controlsBottomClass = isPlaying
    ? "bottom-0"
    : bottomSheetState === "half" ? "bottom-[50vh]" : "bottom-[132px]";
  const hideOnMobile = !isPlaying && bottomSheetState === "full";

  return (
    <div
      className={[
        hideOnMobile ? "hidden md:flex" : "flex",
        "flex flex-col items-center",
        // Mobile: fixed full-width, z above BottomSheet (z-50)
        "fixed left-0 right-0 z-[60] transition-[bottom] duration-300 ease-out",
        controlsBottomClass,
        // Desktop: override to absolute, centered floating pill
        "md:absolute md:z-10 md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:right-auto",
      ].join(" ")}
    >
      {/* Controls bar */}
      <div
        className={[
          `flex items-center gap-2 md:gap-3 ${isPlaying ? "bg-white/40 backdrop-blur-sm" : "bg-white/90 backdrop-blur-xl"} border border-white/50 shadow-xl px-3 md:px-4 py-2`,
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
            className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 hover:bg-indigo-600 active:scale-95 md:h-12 md:w-12"
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
            className="h-5 [&>div:first-child]:h-2 md:[&>div:first-child]:h-1.5"
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
        <span className="min-w-[70px] text-right text-sm text-muted-foreground md:text-xs">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}
