"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";
import { TRANSPORT_MODES } from "@/lib/constants";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import type { Segment, TransportMode } from "@/types";
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

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function TransportSelector({ segment }: TransportSelectorProps) {
  const setTransportMode = useProjectStore((s) => s.setTransportMode);
  const setSegmentGeometry = useProjectStore((s) => s.setSegmentGeometry);
  const setSegmentTiming = useProjectStore((s) => s.setSegmentTiming);
  const locations = useProjectStore((s) => s.locations);
  const timingOverrides = useProjectStore((s) => s.segmentTimingOverrides);
  const timeline = useAnimationStore((s) => s.timeline);
  const [expanded, setExpanded] = useState(false);
  const [showTiming, setShowTiming] = useState(false);
  const timingRef = useRef<HTMLDivElement>(null);

  const fromLoc = locations.find((l) => l.id === segment.fromId);
  const toLoc = locations.find((l) => l.id === segment.toId);

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

  // Close floating panel on outside click
  useEffect(() => {
    if (!showTiming) return;
    const handleClick = (e: MouseEvent) => {
      if (timingRef.current && !timingRef.current.contains(e.target as Node)) {
        setShowTiming(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTiming]);

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
    setTransportMode(segment.id, mode);
    fetchGeometry(mode);
    setExpanded(false);
  };

  const ActiveIcon = MODE_ICONS[segment.transportMode];
  const activeColor = MODE_COLORS[segment.transportMode];

  // Compute distance from geometry
  const distance =
    segment.geometry && segment.geometry.coordinates.length > 1
      ? turf.length(turf.lineString(segment.geometry.coordinates))
      : null;

  return (
    <div className="flex flex-col items-center py-1">
      {/* Vertical connecting line + pill */}
      <div className="flex items-center gap-2 w-full px-2">
        {expanded ? (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1 rounded-full border bg-card px-1.5 py-0.5 shadow-sm">
              {TRANSPORT_MODES.map((mode) => {
                const isActive = segment.transportMode === mode.id;
                const Icon = MODE_ICONS[mode.id];
                return (
                  <Tooltip key={mode.id}>
                    <TooltipTrigger
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        isActive
                          ? MODE_COLORS[mode.id]
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                      onClick={() => handleModeChange(mode.id)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{mode.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="w-px h-4 bg-border" />
          </>
        ) : (
          <>
            <div className="flex-1 h-px bg-border" />
            <button
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:shadow-sm ${activeColor}`}
              onClick={() => setExpanded(true)}
            >
              <ActiveIcon className="h-3.5 w-3.5" />
              {distance !== null && (
                <span className="tabular-nums">{formatDistance(distance)}</span>
              )}
            </button>
            <div className="flex-1 h-px bg-border" />
          </>
        )}
      </div>

      {/* Timing control — only for group-leading segments */}
      {isGroupLeader && autoDuration !== null && (
        <div className="relative" ref={timingRef}>
          <button
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

          {/* Floating timing panel */}
          <AnimatePresence>
            {showTiming && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-56"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
