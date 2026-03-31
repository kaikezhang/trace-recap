"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ChapterPin from "./ChapterPin";
import type { ChapterPinState } from "./ChapterPin";
import { useMap } from "./MapContext";
import { useProjectStore } from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";
import { useUIStore } from "@/stores/uiStore";

interface PinPosition {
  locationId: string;
  x: number;
  y: number;
}

export default function ChapterPinsOverlay() {
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const playbackState = useAnimationStore((s) => s.playbackState);
  const visitedLocationIds = useAnimationStore((s) => s.visitedLocationIds);
  const currentArrivalLocationId = useAnimationStore((s) => s.currentArrivalLocationId);
  const chapterPinsEnabled = useUIStore((s) => s.chapterPinsEnabled);

  const [positions, setPositions] = useState<PinPosition[]>([]);

  const updatePositions = useCallback(() => {
    if (!map) return;

    const newPositions: PinPosition[] = [];
    for (const loc of locations) {
      if (loc.isWaypoint) continue;
      const isVisited = visitedLocationIds.includes(loc.id);
      const isActive = loc.id === currentArrivalLocationId;
      if (!isVisited && !isActive) continue;

      const point = map.project(loc.coordinates);
      newPositions.push({
        locationId: loc.id,
        x: point.x,
        y: point.y,
      });
    }
    setPositions(newPositions);
  }, [map, locations, visitedLocationIds, currentArrivalLocationId]);

  useEffect(() => {
    if (!map) return;
    updatePositions();
    map.on("move", updatePositions);
    return () => {
      map.off("move", updatePositions);
    };
  }, [map, updatePositions]);

  const isAnimating = playbackState === "playing" || playbackState === "paused";
  if (!chapterPinsEnabled || !isAnimating) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[8]">
      <AnimatePresence>
        {positions.map((pos) => {
          const location = locations.find((l) => l.id === pos.locationId);
          if (!location) return null;

          let pinState: ChapterPinState = "future";
          if (location.id === currentArrivalLocationId) {
            pinState = "active";
          } else if (visitedLocationIds.includes(location.id)) {
            pinState = "visited";
          }

          return (
            <ChapterPin
              key={location.id}
              location={location}
              state={pinState}
              position={{ x: pos.x, y: pos.y }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
