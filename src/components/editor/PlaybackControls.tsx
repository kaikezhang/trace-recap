"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Bike,
  Bus,
  Car,
  Footprints,
  Pause,
  Plane,
  Play,
  RotateCcw,
  Ship,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnimationStore } from "@/stores/animationStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { brand } from "@/lib/brand";
import type { TransportMode } from "@/types";
import OnboardingHint from "./OnboardingHint";

interface PlaybackControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSeek: (progress: number) => void;
  hintMessage?: string;
  onHintDismiss?: () => void;
  onPlayingMobileInsetChange?: (insetPx: number) => void;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function formatSegmentDuration(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

const MODE_VISUALS: Record<
  TransportMode,
  { color: string; glow: string; Icon: LucideIcon }
> = {
  flight: { color: "#f97316", glow: "#fb923c", Icon: Plane },
  car: { color: "#f59e0b", glow: "#fbbf24", Icon: Car },
  train: { color: "#06b6d4", glow: "#22d3ee", Icon: TrainFront },
  bus: { color: "#a855f7", glow: "#c084fc", Icon: Bus },
  ferry: { color: "#14b8a6", glow: "#2dd4bf", Icon: Ship },
  walk: { color: "#92400e", glow: "#b45309", Icon: Footprints },
  bicycle: { color: "#0f766e", glow: "#14b8a6", Icon: Bike },
};

interface ScrubberTick {
  id: string;
  duration: number;
  fromCity: string;
  left: number;
  mode: TransportMode;
  toCity: string;
}

export default memo(function PlaybackControls({
  onPlay,
  onPause,
  onReset,
  onSeek,
  hintMessage,
  onHintDismiss,
  onPlayingMobileInsetChange,
}: PlaybackControlsProps) {
  const playbackState = useAnimationStore((s) => s.playbackState);
  const currentTime = useAnimationStore((s) => s.currentTime);
  const totalDuration = useAnimationStore((s) => s.totalDuration);
  const currentSegmentIndex = useAnimationStore((s) => s.currentSegmentIndex);
  const timeline = useAnimationStore((s) => s.timeline);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const bottomSheetState = useUIStore((s) => s.bottomSheetState);
  const exportDialogOpen = useUIStore((s) => s.exportDialogOpen);
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [hoveredTickId, setHoveredTickId] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isPlaying = playbackState === "playing";
  const isMobileViewport = typeof window !== "undefined" && window.innerWidth < 768;
  const shouldAutoHide = isPlaying && viewportRatio === "9:16" && !isHovered && !isMobileViewport;
  const showPlaybackHint = Boolean(hintMessage && onHintDismiss);
  const thumbLeft = Math.min(Math.max(progress, 0.5), 99.5);
  const activeTimelineEntry = timeline[currentSegmentIndex];
  const activeSegment =
    (activeTimelineEntry
      ? segments.find((segment) => segment.id === activeTimelineEntry.segmentId)
      : null) ?? segments[currentSegmentIndex] ?? null;
  const activeModeVisual = activeSegment
    ? MODE_VISUALS[activeSegment.transportMode]
    : null;
  const scrubberTicks = useMemo<ScrubberTick[]>(() => {
    if (timeline.length === 0 || totalDuration <= 0) return [];

    const locationById = new Map(locations.map((location) => [location.id, location]));
    const segmentById = new Map(segments.map((segment) => [segment.id, segment]));

    return timeline.reduce<ScrubberTick[]>((ticks, entry, index) => {
      const segment = segmentById.get(entry.segmentId) ?? segments[index];
      if (!segment) return ticks;

      const fromCity = locationById.get(segment.fromId)?.name;
      const toCity = locationById.get(segment.toId)?.name;
      if (!fromCity || !toCity) return ticks;

      const endTime = entry.startTime + entry.duration;
      const left = Math.min(Math.max((endTime / totalDuration) * 100, 0.5), 99.5);

      ticks.push({
        id: entry.segmentId,
        duration: entry.duration,
        fromCity,
        left,
        mode: segment.transportMode,
        toCity,
      });
      return ticks;
    }, []);
  }, [locations, segments, timeline, totalDuration]);

  const updateHoveredTick = (clientX: number) => {
    const scrubber = scrubberRef.current;
    if (!scrubber || scrubberTicks.length === 0) {
      setHoveredTickId(null);
      return;
    }

    const rect = scrubber.getBoundingClientRect();
    const localX = clientX - rect.left;
    const thresholdPx = Math.max(8, Math.min(14, rect.width * 0.02));
    let closestTickId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const tick of scrubberTicks) {
      const tickX = (tick.left / 100) * rect.width;
      const distance = Math.abs(localX - tickX);
      if (distance <= thresholdPx && distance < closestDistance) {
        closestTickId = tick.id;
        closestDistance = distance;
      }
    }

    setHoveredTickId(closestTickId);
  };

  const handleScrubberPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType !== "mouse") return;
    updateHoveredTick(event.clientX);
  };

  useEffect(() => {
    if (!onPlayingMobileInsetChange || typeof window === "undefined") return;

    const updateInset = () => {
      const isMobile = window.innerWidth < 768;
      const container = containerRef.current;

      const isPlaybackActive = playbackState === "playing" || playbackState === "paused";
      if (!isPlaybackActive || exportDialogOpen || !isMobile || !container) {
        onPlayingMobileInsetChange(0);
        return;
      }

      const rect = container.getBoundingClientRect();
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight;
      const nextInset = Math.max(0, Math.round(viewportHeight - rect.top));
      onPlayingMobileInsetChange(nextInset);
    };

    updateInset();

    const container = containerRef.current;
    const observer = container ? new ResizeObserver(updateInset) : null;
    if (container && observer) {
      observer.observe(container);
    }
    container?.addEventListener("transitionend", updateInset);

    const visualViewport = window.visualViewport;
    const settleTimeout = window.setTimeout(updateInset, 350);
    const settleAnimationFrame = window.requestAnimationFrame(updateInset);
    window.addEventListener("resize", updateInset);
    visualViewport?.addEventListener("resize", updateInset);
    visualViewport?.addEventListener("scroll", updateInset);

    return () => {
      observer?.disconnect();
      container?.removeEventListener("transitionend", updateInset);
      window.clearTimeout(settleTimeout);
      window.cancelAnimationFrame(settleAnimationFrame);
      window.removeEventListener("resize", updateInset);
      visualViewport?.removeEventListener("resize", updateInset);
      visualViewport?.removeEventListener("scroll", updateInset);
      onPlayingMobileInsetChange(0);
    };
  }, [exportDialogOpen, playbackState, onPlayingMobileInsetChange]);

  useEffect(() => {
    if (!hoveredTickId) return;
    if (!scrubberTicks.some((tick) => tick.id === hoveredTickId)) {
      setHoveredTickId(null);
    }
  }, [hoveredTickId, scrubberTicks]);

  useEffect(() => {
    if (!showPlaybackHint || typeof window === "undefined" || !onHintDismiss) {
      return;
    }

    const dismissHint = () => {
      onHintDismiss();
    };

    const timeoutId = window.setTimeout(dismissHint, 3000);
    window.addEventListener("pointerdown", dismissHint, true);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", dismissHint, true);
    };
  }, [onHintDismiss, showPlaybackHint]);

  // Hide controls when export dialog is open
  if (exportDialogOpen) return null;

  // During playback, BottomSheet is hidden → controls go to bottom
  // Otherwise, position above the BottomSheet
  const controlsBottomClass = isPlaying
    ? "bottom-0"
    : bottomSheetState === "half" ? "bottom-[50vh]" : "bottom-[68px]";
  // 68px = 60px collapsed bottom sheet + 8px gap
  const hideOnMobile = !isPlaying && bottomSheetState === "full";
  const containerClassName = [
    hideOnMobile ? "hidden md:flex" : "flex",
    "fixed left-0 right-0 z-[45] items-center justify-center transition-all duration-300 ease-in-out",
    controlsBottomClass,
    isPlaying
      ? "md:absolute md:bottom-2 md:left-1/2 md:right-auto md:w-[90%] md:max-w-2xl md:-translate-x-1/2"
      : "md:absolute md:bottom-4 md:left-1/2 md:right-auto md:w-auto md:-translate-x-1/2 md:z-10",
  ].join(" ");
  const barClassName = [
    "flex items-center overflow-hidden border shadow-xl transition-all duration-300 ease-in-out rounded-none md:rounded-2xl",
    isPlaying
      ? "w-full gap-2 px-3 py-1.5 backdrop-blur-md md:gap-3 md:px-4"
      : "w-full gap-2 px-3 py-2.5 backdrop-blur-xl md:w-auto md:gap-3 md:px-5",
    isPlaying
      ? "bg-stone-900/70 border-white/20"
      : "bg-white/95 border-stone-200/80",
  ].join(" ");
  const resetContainerClassName = [
    "overflow-hidden transition-all duration-300 ease-in-out",
    isPlaying
      ? "pointer-events-none w-0 -mr-2 opacity-0 md:-mr-3"
      : "w-11 opacity-100 md:w-8",
  ].join(" ");
  const timeContainerClassName = [
    "overflow-hidden whitespace-nowrap text-right transition-all duration-300 ease-in-out",
    isPlaying
      ? "pointer-events-none w-0 -ml-2 opacity-0 md:-ml-3"
      : "w-[82px] opacity-100",
  ].join(" ");

  // Use a portal so fixed positioning works inside overflow-hidden containers
  // (constrained 9:16 map viewport clips fixed elements on mobile)
  const controls = (
    <div
      ref={containerRef}
      className={`${containerClassName} ${shouldAutoHide ? "opacity-0" : "opacity-100"} transition-opacity`}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {/* Controls bar */}
      <div className={barClassName}>
        <div className={resetContainerClassName} aria-hidden={isPlaying}>
          <Button
            variant="ghost"
            size="icon"
            className="touch-target-mobile h-8 w-8 shrink-0 text-stone-500 hover:text-stone-700"
            onClick={onReset}
            aria-label="Reset playback"
            disabled={isPlaying}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <button
            className={[
              "touch-target-mobile flex items-center justify-center rounded-full text-white transition-all duration-200 ease-in-out",
              "hover:scale-105 active:scale-95",
              isPlaying ? "h-10 w-10 md:h-8 md:w-8" : "h-14 w-14 md:h-12 md:w-12",
            ].join(" ")}
            style={{
              background: `linear-gradient(135deg, ${brand.colors.primary[400]}, ${brand.colors.primary[600]})`,
              boxShadow: `0 4px 14px 0 rgba(249, 115, 22, 0.35)`,
            }}
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="ml-0.5 h-5 w-5" />
            )}
          </button>
          {showPlaybackHint && (
            <OnboardingHint
              message={hintMessage!}
              onDismiss={onHintDismiss!}
              interactive={false}
              dismissLabel="Dismisses after a moment"
              className="pointer-events-none bottom-[calc(100%+0.75rem)] left-1/2 w-56 -translate-x-1/2"
              arrowClassName="left-1/2 -bottom-[7px] -translate-x-1/2 border-l-0 border-t-0"
            />
          )}
        </div>
        <div
          className={[
            "min-w-0 transition-all duration-300 ease-in-out",
            isPlaying ? "flex-1" : "flex-1 md:w-96 md:flex-none",
          ].join(" ")}
        >
          <div
            ref={scrubberRef}
            className="relative"
            onPointerLeave={() => setHoveredTickId(null)}
            onPointerMove={handleScrubberPointerMove}
          >
            {activeModeVisual && totalDuration > 0 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 z-0 size-5 -translate-y-1/2 rounded-full"
                style={{
                  left: `calc(${thumbLeft}% - 10px)`,
                  background: `${activeModeVisual.glow}2b`,
                  boxShadow: `0 0 0 4px ${activeModeVisual.color}22, 0 0 20px ${activeModeVisual.glow}55`,
                }}
              />
            )}
            <Slider
              className={[
                "relative z-10",
                isPlaying
                  ? "h-4 [&>div:first-child]:h-1 md:[&>div:first-child]:h-1"
                  : "h-5 [&>div:first-child]:h-2 md:[&>div:first-child]:h-1.5",
                "[&_[data-slot=slider-range]]:bg-orange-500",
                "[&_[data-slot=slider-thumb]]:border-orange-500",
              ].join(" ")}
              value={[progress]}
              min={0}
              max={100}
              step={0.1}
              onValueChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                onSeek(val / 100);
              }}
            />
            {scrubberTicks.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-20">
                {scrubberTicks.map((tick) => {
                  const { Icon, color, glow } = MODE_VISUALS[tick.mode];

                  return (
                    <Tooltip key={tick.id} open={hoveredTickId === tick.id}>
                      <TooltipTrigger
                        render={
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 block h-6 w-4 -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${tick.left}%` }}
                          >
                            <span
                              className="absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                              style={{
                                backgroundColor: color,
                                boxShadow: `0 0 10px ${glow}66`,
                              }}
                            />
                          </span>
                        }
                      />
                      <TooltipContent
                        side="top"
                        sideOffset={10}
                        className="rounded-xl border border-white/10 bg-stone-950/95 px-3 py-2 text-stone-50 shadow-2xl backdrop-blur-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: `${color}24`,
                              color,
                            }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="leading-tight">
                            <p className="font-medium text-stone-50">
                              {tick.fromCity} {"\u2192"} {tick.toCity}
                            </p>
                            <p className="mt-1 text-[11px] text-stone-300">
                              Duration: {formatSegmentDuration(tick.duration)}
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className={timeContainerClassName} aria-hidden={isPlaying}>
          <span
            className="text-xs tabular-nums tracking-tight"
            style={{
              fontFamily: brand.fonts.mono,
              color: brand.colors.warm[500],
            }}
          >
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return controls;
  return createPortal(controls, document.body);
});
