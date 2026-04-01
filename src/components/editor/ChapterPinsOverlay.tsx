"use client";

import { useEffect, useRef, useState } from "react";
import ChapterPin, {
  getChapterPinTargetOffset,
  type ChapterPinState,
} from "./ChapterPin";
import { useMap } from "./MapContext";
import { useProjectStore } from "@/stores/projectStore";
import {
  useAnimationStore,
  type ScreenPoint,
} from "@/stores/animationStore";
import { useUIStore } from "@/stores/uiStore";

interface PinPosition {
  locationId: string;
  x: number;
  y: number;
  state: Exclude<ChapterPinState, "future">;
}

function arePinPositionsEqual(a: PinPosition[], b: PinPosition[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((position, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      position.locationId === other.locationId &&
      position.x === other.x &&
      position.y === other.y &&
      position.state === other.state
    );
  });
}

function areScreenPointsEqual(
  a: Record<string, ScreenPoint>,
  b: Record<string, ScreenPoint>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => {
    const aPoint = a[key];
    const bPoint = b[key];
    return (
      bPoint !== undefined &&
      aPoint.x === bPoint.x &&
      aPoint.y === bPoint.y
    );
  });
}

export default function ChapterPinsOverlay() {
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const playbackState = useAnimationStore((s) => s.playbackState);
  const visitedLocationIds = useAnimationStore((s) => s.visitedLocationIds);
  const currentArrivalLocationId = useAnimationStore(
    (s) => s.currentArrivalLocationId,
  );
  const albumCollectingLocationId = useAnimationStore(
    (s) => s.albumCollectingLocationId,
  );
  const albumClosedLocationId = useAnimationStore((s) => s.albumClosedLocationId);
  const setChapterPinPositions = useAnimationStore(
    (s) => s.setChapterPinPositions,
  );
  const chapterPinsEnabled = useUIStore((s) => s.chapterPinsEnabled);

  const [positions, setPositions] = useState<PinPosition[]>([]);

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
  const targetPositionsRef = useRef(useAnimationStore.getState().chapterPinPositions);

  const computePositions = useRef(() => {
    /* replaced below */
  });

  computePositions.current = () => {
    if (!map) return;

    const nextPositions: PinPosition[] = [];
    const seenCoords = new Set<string>();

    for (const location of locationsRef.current) {
      if (location.isWaypoint) continue;

      let state: ChapterPinState = "future";
      if (location.id === collectingRef.current) {
        state = "album-collecting";
      } else if (location.id === closedRef.current) {
        state = "album-closed";
      } else if (location.id === arrivalRef.current) {
        state = "album-open";
      } else if (visitedRef.current.includes(location.id)) {
        state = "visited";
      }

      if (state === "future") continue;

      const coordKey = `${location.coordinates[0].toFixed(4)},${location.coordinates[1].toFixed(4)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      const projected = map.project(location.coordinates);
      nextPositions.push({
        locationId: location.id,
        x: projected.x,
        y: projected.y,
        state,
      });
    }

    setPositions((current) =>
      arePinPositionsEqual(current, nextPositions) ? current : nextPositions,
    );

    const nextTargetPositions = Object.fromEntries(
      nextPositions
        .filter((position) => position.state !== "visited")
        .map((position) => {
          const offset = getChapterPinTargetOffset(position.state);
          return [
            position.locationId,
            {
              x: position.x + offset.x,
              y: position.y + offset.y,
            },
          ];
        }),
    ) satisfies Record<string, ScreenPoint>;

    if (!areScreenPointsEqual(targetPositionsRef.current, nextTargetPositions)) {
      targetPositionsRef.current = nextTargetPositions;
      setChapterPinPositions(nextTargetPositions);
    }
  };

  useEffect(() => {
    if (!map) return;

    const update = () => {
      computePositions.current();
    };

    update();
    map.on("move", update);
    return () => {
      map.off("move", update);
      targetPositionsRef.current = {};
      setChapterPinPositions({});
    };
  }, [map, setChapterPinPositions]);

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

  const isAnimating =
    playbackState === "playing" || playbackState === "paused";
  if (!chapterPinsEnabled || !isAnimating) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[8] overflow-hidden">
      {positions.map((position) => {
        const location = locations.find((entry) => entry.id === position.locationId);
        if (!location) return null;

        return (
          <ChapterPin
            key={location.id}
            location={location}
            position={{ x: position.x, y: position.y }}
            state={position.state}
          />
        );
      })}
    </div>
  );
}
