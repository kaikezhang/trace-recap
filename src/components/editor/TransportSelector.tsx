"use client";

import { useCallback, useEffect, useState } from "react";
import * as turf from "@turf/turf";
import { useProjectStore } from "@/stores/projectStore";
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
  const locations = useProjectStore((s) => s.locations);
  const [expanded, setExpanded] = useState(false);

  const fromLoc = locations.find((l) => l.id === segment.fromId);
  const toLoc = locations.find((l) => l.id === segment.toId);

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
    <div className="flex items-center justify-center py-1">
      {/* Vertical connecting line + pill */}
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-border" />
        {expanded ? (
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
        ) : (
          <button
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:shadow-sm ${activeColor}`}
            onClick={() => setExpanded(true)}
          >
            <ActiveIcon className="h-3.5 w-3.5" />
            {distance !== null && (
              <span className="tabular-nums">{formatDistance(distance)}</span>
            )}
          </button>
        )}
        <div className="w-px h-4 bg-border" />
      </div>
    </div>
  );
}
