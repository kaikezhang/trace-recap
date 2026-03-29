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
  const bottomSheetExpanded = useUIStore((s) => s.bottomSheetExpanded);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isPlaying = playbackState === "playing";

  return (
    <div
      className={[
        "flex items-center gap-2 md:gap-3 bg-background/90 backdrop-blur-sm border shadow-lg px-3 md:px-4 py-2",
        // Mobile: fixed full-width bar, z above BottomSheet (z-50)
        "fixed left-0 right-0 z-[60] rounded-none transition-[bottom] duration-300 ease-out",
        bottomSheetExpanded ? "bottom-[60vh]" : "bottom-14",
        // Desktop: override to absolute, centered floating pill
        "md:absolute md:z-10 md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:rounded-2xl md:w-auto",
      ].join(" ")}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 md:h-8 md:w-8 min-w-[44px] md:min-w-0"
        onClick={onReset}
        aria-label="Reset playback"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 md:h-8 md:w-8 min-w-[44px] md:min-w-0"
          onClick={isPlaying ? onPause : onPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
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
  );
}
