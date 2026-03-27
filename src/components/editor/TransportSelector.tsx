"use client";

import { useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { TRANSPORT_MODES } from "@/lib/constants";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import type { Segment, TransportMode } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TransportSelectorProps {
  segment: Segment;
}

const MODE_COLORS: Record<TransportMode, string> = {
  flight: "bg-indigo-100 text-indigo-700 border-indigo-300",
  car: "bg-amber-100 text-amber-700 border-amber-300",
  train: "bg-emerald-100 text-emerald-700 border-emerald-300",
  bus: "bg-violet-100 text-violet-700 border-violet-300",
  ferry: "bg-cyan-100 text-cyan-700 border-cyan-300",
  walk: "bg-pink-100 text-pink-700 border-pink-300",
  bicycle: "bg-teal-100 text-teal-700 border-teal-300",
};

export default function TransportSelector({ segment }: TransportSelectorProps) {
  const setTransportMode = useProjectStore((s) => s.setTransportMode);
  const setSegmentGeometry = useProjectStore((s) => s.setSegmentGeometry);
  const locations = useProjectStore((s) => s.locations);

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
  };

  return (
    <div className="flex items-center justify-center gap-1 py-1">
      {TRANSPORT_MODES.map((mode) => {
        const isActive = segment.transportMode === mode.id;
        return (
          <Tooltip key={mode.id}>
            <TooltipTrigger
              className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                isActive
                  ? MODE_COLORS[mode.id]
                  : "border-transparent text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => handleModeChange(mode.id)}
            >
              {mode.label[0]}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{mode.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
