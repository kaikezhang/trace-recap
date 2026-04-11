"use client";

import { memo, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
import { useSegmentEndpoints } from "@/stores/selectors";
import { useAnimationStore } from "@/stores/animationStore";
import { TRANSPORT_MODES } from "@/lib/constants";
import {
  TRANSPORT_ICON_STYLES,
  ICON_VARIANTS,
  resolveIconVariant,
} from "@/lib/transportIcons";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import { track } from "@/lib/analytics";
import type { Segment, TransportIconStyle, TransportMode, IconVariant } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plane,
  Car,
  TrainFront,
  Bus,
  Ship,
  Footprints,
  Bike,
  Clock,
  type LucideIcon,
} from "lucide-react";

interface TransportSelectorProps {
  segment: Segment;
}

const MODE_ICONS: Record<TransportMode, LucideIcon> = {
  flight: Plane,
  car: Car,
  train: TrainFront,
  bus: Bus,
  ferry: Ship,
  walk: Footprints,
  bicycle: Bike,
};

const MODE_COLORS: Record<TransportMode, string> = {
  flight: "bg-indigo-100 text-indigo-700 border-indigo-300",
  car: "bg-amber-100 text-amber-700 border-amber-300",
  train: "bg-emerald-100 text-emerald-700 border-emerald-300",
  bus: "bg-violet-100 text-violet-700 border-violet-300",
  ferry: "bg-cyan-100 text-cyan-700 border-cyan-300",
  walk: "bg-pink-100 text-pink-700 border-pink-300",
  bicycle: "bg-teal-100 text-teal-700 border-teal-300",
};

const MODE_ACCENTS: Record<
  TransportMode,
  { solid: string; soft: string }
> = {
  flight: { solid: "#4f7df5", soft: "#dbe8ff" },
  car: { solid: "#d97706", soft: "#fce7bf" },
  train: { solid: "#059669", soft: "#d4f4e6" },
  bus: { solid: "#8b5cf6", soft: "#ede4ff" },
  ferry: { solid: "#0891b2", soft: "#d2f4fb" },
  walk: { solid: "#db2777", soft: "#fbd7e8" },
  bicycle: { solid: "#0f766e", soft: "#d3f3ee" },
};

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function StylePreview({
  mode,
  iconStyle,
}: {
  mode: TransportMode;
  iconStyle: TransportIconStyle;
}) {
  const accent = MODE_ACCENTS[mode];

  if (iconStyle === "outline") {
    return (
      <span
        className="block h-3.5 w-3.5 rounded-full border-2 bg-white"
        style={{ borderColor: accent.solid }}
      />
    );
  }

  if (iconStyle === "soft") {
    return (
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
        style={{ backgroundColor: accent.soft }}
      >
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accent.solid }}
        />
      </span>
    );
  }

  return (
    <span
      className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
      style={{ backgroundColor: accent.solid }}
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-white" />
    </span>
  );
}

export default memo(function TransportSelector({ segment }: TransportSelectorProps) {
  const shouldReduceMotion = useReducedMotion();
  const setTransportMode = useProjectStore((s) => s.setTransportMode);
  const setSegmentIconStyle = useProjectStore((s) => s.setSegmentIconStyle);
  const setSegmentIconVariant = useProjectStore((s) => s.setSegmentIconVariant);
  const setSegmentGeometry = useProjectStore((s) => s.setSegmentGeometry);
  const setSegmentTiming = useProjectStore((s) => s.setSegmentTiming);
  const endpoints = useSegmentEndpoints(segment.fromId, segment.toId);
  const timingOverrides = useProjectStore((s) => s.segmentTimingOverrides);
  const timeline = useAnimationStore((s) => s.timeline);
  const [expanded, setExpanded] = useState(false);
  const [showTiming, setShowTiming] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const timingRef = useRef<HTMLDivElement>(null);
  const timingBtnRef = useRef<HTMLButtonElement>(null);

  // Compute portal position from timing button
  const timingPanelStyle = useMemo(() => {
    if (!showTiming || !timingBtnRef.current) return {};
    const rect = timingBtnRef.current.getBoundingClientRect();
    return {
      position: "fixed" as const,
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2 - 112, // 112 = w-56 / 2
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTiming]);

  const fromLoc = endpoints.from;
  const toLoc = endpoints.to;

  // Show timing control for every segment (each segment is its own animation group now)
  const isGroupLeader = true;

  // Find auto-computed duration from timeline for this segment
  const timelineEntry = timeline.find((t) => t.segmentId === segment.id);
  const autoDuration = timelineEntry?.duration ?? null;
  const override = timingOverrides[segment.id];
  const hasOverride = override !== undefined;
  const displayDuration = hasOverride ? override : autoDuration;

  const minDuration = 1.5;
  const effectiveDuration = hasOverride && override < minDuration ? minDuration : null;

  // Close floating panel on outside click (check both panel and its trigger button)
  useEffect(() => {
    if (!showTiming) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        timingRef.current && !timingRef.current.contains(target) &&
        timingBtnRef.current && !timingBtnRef.current.contains(target)
      ) {
        setShowTiming(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTiming]);

  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  const fetchGeometry = useCallback(
    async (mode: TransportMode) => {
      if (!fromLoc || !toLoc) return;
      try {
        const geometry = await generateRouteGeometry(
          fromLoc.coordinates,
          toLoc.coordinates,
          mode
        );
        setSegmentGeometry(segment.id, geometry);
      } catch {
        // Geometry generation failed silently
      }
    },
    [fromLoc, toLoc, segment.id, setSegmentGeometry]
  );

  // Generate geometry on mount and when endpoints change
  useEffect(() => {
    if (!segment.geometry && fromLoc && toLoc) {
      fetchGeometry(segment.transportMode);
    }
  }, [segment.geometry, segment.transportMode, fromLoc, toLoc, fetchGeometry]);

  const handleModeChange = (mode: TransportMode) => {
    if (mode === segment.transportMode) return;
    setTransportMode(segment.id, mode);
    fetchGeometry(mode);
    track("transport_mode_changed", { mode });
  };

  const handleStyleChange = (iconStyle: TransportIconStyle) => {
    setSegmentIconStyle(segment.id, iconStyle);
  };

  const handleVariantChange = (variant: IconVariant) => {
    setSegmentIconVariant(segment.id, variant);
  };

  const activeVariant = resolveIconVariant(segment.transportMode, segment.iconVariant);
  const variants = ICON_VARIANTS[segment.transportMode];

  const ActiveIcon = MODE_ICONS[segment.transportMode];
  const activeColor = MODE_COLORS[segment.transportMode];

  // Compute distance from geometry
  const distance =
    segment.geometry && segment.geometry.coordinates.length > 1
      ? length(lineString(segment.geometry.coordinates))
      : null;

  return (
    <div className="flex flex-col items-center py-1" ref={selectorRef}>
      {/* Vertical connecting line + pill */}
      <div className="flex items-center gap-2 w-full px-2">
        {expanded ? (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="rounded-2xl border bg-card px-2 py-2 shadow-sm md:px-2 md:py-1.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {TRANSPORT_MODES.map((mode) => {
                  const isActive = segment.transportMode === mode.id;
                  const Icon = MODE_ICONS[mode.id];
                  return (
                    <Tooltip key={mode.id}>
                      <TooltipTrigger
                        className={`flex min-h-11 items-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-colors md:min-h-9 md:px-3 md:py-2 md:text-xs ${
                          isActive
                            ? MODE_COLORS[mode.id]
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                        onClick={() => handleModeChange(mode.id)}
                      >
                        <Icon className="h-5 w-5 md:h-4 md:w-4" />
                        <span>{mode.label}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{mode.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 border-t border-border/70 pt-1">
                {TRANSPORT_ICON_STYLES.map((style) => {
                  const isActive = segment.iconStyle === style.id;
                  return (
                    <Tooltip key={style.id}>
                      <TooltipTrigger
                        className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-2 transition-colors ${
                          isActive
                            ? "border-foreground/20 bg-accent text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-accent"
                        }`}
                        onClick={() => handleStyleChange(style.id)}
                      >
                        <StylePreview
                          mode={segment.transportMode}
                          iconStyle={style.id}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{style.label}</p>
                        <p className="max-w-40 text-[11px] text-muted-foreground">
                          {style.description}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              {variants.length > 1 && (
                <div className="mt-1 flex items-center justify-center gap-1 border-t border-border/70 pt-1">
                  {variants.map((v) => {
                    const isActive = activeVariant === v.id;
                    return (
                      <Tooltip key={v.id}>
                        <TooltipTrigger
                          className={`flex h-6 items-center justify-center rounded-full border px-2 text-[10px] font-medium transition-colors ${
                            isActive
                              ? "border-foreground/20 bg-accent text-foreground"
                              : "border-transparent text-muted-foreground hover:bg-accent"
                          }`}
                          onClick={() => handleVariantChange(v.id)}
                        >
                          {v.label}
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{v.label}</p>
                          <p className="max-w-40 text-[11px] text-muted-foreground">
                            {v.description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="w-px h-4 bg-border" />
          </>
        ) : (
          <>
            <div className="flex-1 h-px bg-border" />
            <button
              type="button"
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium transition-colors hover:shadow-sm md:min-h-9 md:px-3 md:py-2 md:text-xs ${activeColor}`}
              onClick={() => setExpanded(true)}
            >
              <ActiveIcon className="h-5 w-5 md:h-4 md:w-4" />
              <span>{TRANSPORT_MODES.find((mode) => mode.id === segment.transportMode)?.label}</span>
              {distance !== null && (
                <span className="tabular-nums">{formatDistance(distance)}</span>
              )}
              <StylePreview
                mode={segment.transportMode}
                iconStyle={segment.iconStyle}
              />
            </button>
            <div className="flex-1 h-px bg-border" />
          </>
        )}
      </div>

      {/* Timing control — only for group-leading segments */}
      {isGroupLeader && autoDuration !== null && (
        <div className="relative" ref={timingRef}>
          <button
            ref={timingBtnRef}
            className="flex items-center gap-1 text-[10px] tabular-nums hover:text-foreground transition-colors mt-0.5"
            onClick={() => setShowTiming((v) => !v)}
          >
            <Clock className="h-3 w-3 text-muted-foreground" />
            {hasOverride ? (
              <>
                <span className="text-foreground font-medium">{override.toFixed(1)}s</span>
                {effectiveDuration !== null && effectiveDuration > override && (
                  <span className="text-amber-500 text-[9px]">(min {effectiveDuration.toFixed(1)}s)</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Auto ({autoDuration.toFixed(1)}s)</span>
            )}
          </button>

          {/* Floating timing panel — portaled to body to escape overflow:hidden */}
          {showTiming && typeof document !== "undefined" && createPortal(
            <div ref={timingRef} className="transport-selector-panel w-56 rounded-xl border border-gray-100 bg-white p-4 shadow-xl" style={{ ...timingPanelStyle, zIndex: 50 }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-700">Duration</span>
                <button
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
                  onClick={() => {
                    setSegmentTiming(segment.id, null);
                    setShowTiming(false);
                  }}
                >
                  Auto
                </button>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={minDuration}
                max={30}
                step={0.5}
                value={displayDuration ?? 4}
                onChange={(e) => setSegmentTiming(segment.id, parseFloat(e.target.value))}
                className="w-full h-1.5 accent-indigo-500 cursor-pointer"
              />

              {/* Min / current / max labels */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-400">1.5s</span>
                <span className="text-xs font-medium text-indigo-600">
                  {(displayDuration ?? 4).toFixed(1)}s
                </span>
                <span className="text-[10px] text-gray-400">30s</span>
              </div>

              {/* Auto suggestion */}
              {hasOverride && autoDuration !== null && (
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  Auto would be {autoDuration.toFixed(1)}s
                </p>
              )}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
});
