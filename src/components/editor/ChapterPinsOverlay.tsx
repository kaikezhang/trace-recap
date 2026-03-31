"use client";

import { useEffect, useState, useRef } from "react";
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

  // Use refs to avoid recreating the callback when store data changes
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const visitedRef = useRef(visitedLocationIds);
  visitedRef.current = visitedLocationIds;
  const arrivalRef = useRef(currentArrivalLocationId);
  arrivalRef.current = currentArrivalLocationId;

  const computePositions = useRef(() => {
    /* placeholder — replaced below */
  });

  computePositions.current = () => {
    if (!map) return;
    const locs = locationsRef.current;
    const visited = visitedRef.current;
    const arrival = arrivalRef.current;

    const newPositions: PinPosition[] = [];
    for (const loc of locs) {
      if (loc.isWaypoint) continue;
      const isVisited = visited.includes(loc.id);
      const isActive = loc.id === arrival;
      if (!isVisited && !isActive) continue;

      const point = map.project(loc.coordinates);
      newPositions.push({
        locationId: loc.id,
        x: point.x,
        y: point.y,
      });
    }
    setPositions(newPositions);
  };

  // Update on map movement
  useEffect(() => {
    if (!map) return;

    const update = () => computePositions.current();

    update();
    map.on("move", update);
    return () => {
      map.off("move", update);
    };
  }, [map]);

  // Update when animation state changes (subscribe to avoid re-render loops)
  useEffect(() => {
    if (!map) return;
    let prevVisited = useAnimationStore.getState().visitedLocationIds;
    let prevArrival = useAnimationStore.getState().currentArrivalLocationId;
    return useAnimationStore.subscribe((state) => {
      if (state.visitedLocationIds !== prevVisited || state.currentArrivalLocationId !== prevArrival) {
        prevVisited = state.visitedLocationIds;
        prevArrival = state.currentArrivalLocationId;
        computePositions.current();
      }
    });
  }, [map]);

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
