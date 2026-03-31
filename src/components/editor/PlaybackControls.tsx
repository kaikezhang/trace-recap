"use client";

import { memo } from "react";
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

export default memo(function PlaybackControls({
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
  const exportDialogOpen = useUIStore((s) => s.exportDialogOpen);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isPlaying = playbackState === "playing";

  // Hide controls when export dialog is open
  if (exportDialogOpen) return null;

  // During playback, BottomSheet is hidden → controls go to bottom
  // Otherwise, position above the BottomSheet
  const controlsBottomClass = isPlaying
    ? "bottom-0"
    : bottomSheetState === "half" ? "bottom-[50vh]" : "bottom-[132px]";
  const hideOnMobile = !isPlaying && bottomSheetState === "full";
  const containerClassName = [
    hideOnMobile ? "hidden md:flex" : "flex",
    "fixed left-0 right-0 z-[60] items-center justify-center transition-all duration-300 ease-in-out",
    controlsBottomClass,
    isPlaying
      ? "md:absolute md:bottom-2 md:left-1/2 md:right-auto md:w-[90%] md:max-w-2xl md:-translate-x-1/2"
      : "md:absolute md:bottom-4 md:left-1/2 md:right-auto md:w-auto md:-translate-x-1/2 md:z-10",
  ].join(" ");
  const barClassName = [
    "flex items-center overflow-hidden rounded-none border border-white/50 shadow-xl transition-all duration-300 ease-in-out md:rounded-2xl",
    isPlaying
      ? "w-full gap-2 bg-white/30 px-3 py-1 backdrop-blur-sm md:gap-3 md:px-4"
      : "w-full gap-2 bg-white/90 px-3 py-2 backdrop-blur-xl md:w-auto md:gap-3 md:px-4",
  ].join(" ");
  const resetContainerClassName = [
    "overflow-hidden transition-all duration-300 ease-in-out",
    isPlaying
      ? "pointer-events-none w-0 -mr-2 opacity-0 md:-mr-3"
      : "w-8 opacity-100",
  ].join(" ");
  const timeContainerClassName = [
    "overflow-hidden whitespace-nowrap text-right transition-all duration-300 ease-in-out",
    isPlaying
      ? "pointer-events-none w-0 -ml-2 opacity-0 md:-ml-3"
      : "w-[70px] opacity-100",
  ].join(" ");
  const playButtonClassName = [
    "flex items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 ease-in-out hover:scale-105 hover:bg-indigo-600 active:scale-95",
    isPlaying ? "h-10 w-10 md:h-7 md:w-7" : "h-14 w-14 md:h-12 md:w-12",
  ].join(" ");
  const sliderContainerClassName = [
    "min-w-0 transition-all duration-300 ease-in-out",
    isPlaying ? "flex-1" : "flex-1 md:w-96 md:flex-none",
  ].join(" ");
  const sliderClassName = isPlaying
    ? "h-4 [&>div:first-child]:h-1 md:[&>div:first-child]:h-1"
    : "h-5 [&>div:first-child]:h-2 md:[&>div:first-child]:h-1.5";

  return (
    <div className={containerClassName}>
      {/* Controls bar */}
      <div className={barClassName}>
        <div className={resetContainerClassName} aria-hidden={isPlaying}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onReset}
            aria-label="Reset playback"
            disabled={isPlaying}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <button
            className={playButtonClassName}
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="ml-0.5 h-5 w-5" />
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
        <div className={sliderContainerClassName}>
          <Slider
            className={sliderClassName}
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
        <div className={timeContainerClassName} aria-hidden={isPlaying}>
          <span className="text-sm text-muted-foreground md:text-xs">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );
});
