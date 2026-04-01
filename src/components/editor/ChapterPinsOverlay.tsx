"use client";

import { useEffect, useState, useRef } from "react";

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
  const albumCollectingLocationId = useAnimationStore((s) => s.albumCollectingLocationId);
  const albumClosedLocationId = useAnimationStore((s) => s.albumClosedLocationId);
  const setChapterPinPositions = useAnimationStore((s) => s.setChapterPinPositions);
  const chapterPinsEnabled = useUIStore((s) => s.chapterPinsEnabled);

  const [positions, setPositions] = useState<PinPosition[]>([]);

  console.log(
    "[ChapterPins] render, positions:",
    positions.length,
    "visited:",
    visitedLocationIds.length,
  );

  // Use refs to avoid recreating the callback when store data changes
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const visitedRef = useRef(visitedLocationIds);
  visitedRef.current = visitedLocationIds;
  const arrivalRef = useRef(currentArrivalLocationId);
  arrivalRef.current = currentArrivalLocationId;
  const collectingRef = useRef(albumCollectingLocationId);
  collectingRef.current = albumCollectingLocationId;
  const closedRef = useRef(albumClosedLocationId);
  closedRef.current = albumClosedLocationId;

  const computePositions = useRef(() => {
    /* placeholder — replaced below */
  });

  computePositions.current = () => {
    if (!map) return;
    const locs = locationsRef.current;
    const visited = visitedRef.current;
    const arrival = arrivalRef.current;
    const collecting = collectingRef.current;
    const closed = closedRef.current;

    const newPositions: PinPosition[] = [];
    const seenCoords = new Set<string>();
    for (const loc of locs) {
      if (loc.isWaypoint) continue;
      const isVisited = visited.includes(loc.id);
      const isActive = loc.id === arrival;
      const isCollecting = loc.id === collecting;
      const isClosed = loc.id === closed;
      if (!isVisited && !isActive && !isCollecting && !isClosed) continue;

      // Deduplicate by coordinates — routes that revisit a city
      // (e.g. Seattle→...→Seattle) should show only one pin
      const coordKey = `${loc.coordinates[0].toFixed(4)},${loc.coordinates[1].toFixed(4)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      const point = map.project(loc.coordinates);
      newPositions.push({
        locationId: loc.id,
        x: point.x,
        y: point.y,
      });
    }
    setPositions(newPositions);
    setChapterPinPositions(
      Object.fromEntries(
        newPositions.map((position) => [
          position.locationId,
          { x: position.x, y: position.y },
        ]),
      ),
    );
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
    let prevCollecting = useAnimationStore.getState().albumCollectingLocationId;
    let prevClosed = useAnimationStore.getState().albumClosedLocationId;
    return useAnimationStore.subscribe((state) => {
      if (
        state.visitedLocationIds !== prevVisited ||
        state.currentArrivalLocationId !== prevArrival ||
        state.albumCollectingLocationId !== prevCollecting ||
        state.albumClosedLocationId !== prevClosed
      ) {
        prevVisited = state.visitedLocationIds;
        prevArrival = state.currentArrivalLocationId;
        prevCollecting = state.albumCollectingLocationId;
        prevClosed = state.albumClosedLocationId;
        computePositions.current();
      }
    });
  }, [map]);

  const isAnimating = playbackState === "playing" || playbackState === "paused";
  if (!chapterPinsEnabled || !isAnimating) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[8]">
        {positions.filter((pos, idx, arr) => arr.findIndex((p) => p.locationId === pos.locationId) === idx).map((pos) => {
          const location = locations.find((l) => l.id === pos.locationId);
          if (!location) return null;

          let pinState: ChapterPinState = "future";
          if (location.id === albumCollectingLocationId) {
            pinState = "album-collecting";
          } else if (location.id === albumClosedLocationId) {
            pinState = "album-closed";
          } else if (location.id === currentArrivalLocationId) {
            pinState = "album-open";
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
    </div>
  );
}
