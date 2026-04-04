"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

interface PinEntry {
  locationId: string;
  state: Exclude<ChapterPinState, "future">;
}

function arePinEntriesEqual(a: PinEntry[], b: PinEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      entry.locationId === other.locationId &&
      entry.state === other.state
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
  const setChapterPinPositions = useAnimationStore(
    (s) => s.setChapterPinPositions,
  );
  const chapterPinsEnabled = useUIStore((s) => s.chapterPinsEnabled);

  // Pin entries track which pins are visible and their state (no x/y — that's DOM-direct)
  const [pinEntries, setPinEntries] = useState<PinEntry[]>([]);

  // Refs for DOM-direct position updates (bypasses React re-render cycle)
  const pinElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const visitedRef = useRef(visitedLocationIds);
  visitedRef.current = visitedLocationIds;
  const arrivalRef = useRef(currentArrivalLocationId);
  arrivalRef.current = currentArrivalLocationId;
  const collectingRef = useRef(albumCollectingLocationId);
  collectingRef.current = albumCollectingLocationId;
  const pinEntriesRef = useRef(pinEntries);
  pinEntriesRef.current = pinEntries;
  const targetPositionsRef = useRef(useAnimationStore.getState().chapterPinPositions);

  // Register/unregister pin DOM elements
  const registerPinRef = useCallback((locationId: string, el: HTMLDivElement | null) => {
    if (el) {
      // Hide until position is set to prevent flash at top-left corner
      el.style.visibility = "hidden";
      pinElementsRef.current.set(locationId, el);
      // Immediately position if map is available
      if (map) {
        const location = locationsRef.current.find((l) => l.id === locationId);
        if (location) {
          const projected = map.project(location.coordinates);
          el.style.transform = `translate(${projected.x}px, ${projected.y}px) translate(-50%, -100%)`;
        }
        el.style.visibility = "";
      }
    } else {
      pinElementsRef.current.delete(locationId);
    }
  }, [map]);

  // Synchronously update pin DOM positions — called directly in map "move" handler
  const updatePinDOMPositions = useCallback(() => {
    if (!map) return;

    const nextTargetPositions: Record<string, ScreenPoint> = {};

    for (const entry of pinEntriesRef.current) {
      const location = locationsRef.current.find((l) => l.id === entry.locationId);
      if (!location) continue;

      const projected = map.project(location.coordinates);
      const x = projected.x;
      let y = projected.y;

      // Clamp Y so album pins have enough room above to avoid cutoff.
      // Album height ≈ 200px (book + label + stem). For non-visited pins,
      // ensure pin bottom anchor is far enough from the top of the container.
      const isAlbumPin = entry.state === "album-open" || entry.state === "album-collecting";
      if (isAlbumPin) {
        const minY = 210;
        y = Math.max(y, minY);
      }

      // Update DOM element position directly (no React re-render)
      const el = pinElementsRef.current.get(entry.locationId);
      if (el) {
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }

      // Compute target positions for PhotoOverlay fly-to-album
      if (entry.state !== "visited") {
        const offset = getChapterPinTargetOffset(entry.state);
        nextTargetPositions[entry.locationId] = {
          x: x + offset.x,
          y: y + offset.y,
        };
      }
    }

    if (!areScreenPointsEqual(targetPositionsRef.current, nextTargetPositions)) {
      targetPositionsRef.current = nextTargetPositions;
      setChapterPinPositions(nextTargetPositions);
    }
  }, [map, setChapterPinPositions]);

  // Compute which pins should be visible and their states (triggers React re-render only on state changes)
  const computePinEntries = useRef(() => {});
  computePinEntries.current = () => {
    const nextEntries: PinEntry[] = [];
    const seenCoords = new Set<string>();

    for (const location of locationsRef.current) {
      if (location.isWaypoint) continue;

      const hasPhotos = location.photos && location.photos.length > 0;
      let state: ChapterPinState = "future";
      if (location.id === collectingRef.current && hasPhotos) {
        state = "album-collecting";
      } else if (location.id === arrivalRef.current && hasPhotos) {
        state = "album-open";
      } else if (visitedRef.current.includes(location.id)) {
        state = "visited";
      }

      if (state === "future") continue;

      const coordKey = `${location.coordinates[0].toFixed(4)},${location.coordinates[1].toFixed(4)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      nextEntries.push({ locationId: location.id, state });
    }

    setPinEntries((current) =>
      arePinEntriesEqual(current, nextEntries) ? current : nextEntries,
    );
  };

  // Listen to map "move" events — update DOM positions synchronously
  useEffect(() => {
    if (!map) return;

    const onMove = () => {
      updatePinDOMPositions();
    };

    onMove();
    map.on("move", onMove);
    return () => {
      map.off("move", onMove);
      targetPositionsRef.current = {};
      setChapterPinPositions({});
    };
  }, [map, setChapterPinPositions, updatePinDOMPositions]);

  // Listen to animation store state changes — recompute pin entries + update positions
  useEffect(() => {
    if (!map) return;

    let prevVisited = useAnimationStore.getState().visitedLocationIds;
    let prevArrival = useAnimationStore.getState().currentArrivalLocationId;
    let prevCollecting = useAnimationStore.getState().albumCollectingLocationId;

    return useAnimationStore.subscribe((state) => {
      if (
        state.visitedLocationIds !== prevVisited ||
        state.currentArrivalLocationId !== prevArrival ||
        state.albumCollectingLocationId !== prevCollecting
      ) {
        prevVisited = state.visitedLocationIds;
        prevArrival = state.currentArrivalLocationId;
        prevCollecting = state.albumCollectingLocationId;
        computePinEntries.current();
        // Also update DOM positions immediately for the new set of pins
        // (use requestAnimationFrame so new pin elements are mounted first)
        requestAnimationFrame(() => {
          updatePinDOMPositions();
        });
      }
    });
  }, [map, updatePinDOMPositions]);

  // Initial pin entry computation
  useEffect(() => {
    computePinEntries.current();
  }, [locations]);

  const isAnimating =
    playbackState === "playing" || playbackState === "paused";
  if (!chapterPinsEnabled || !isAnimating) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[8]">
      {pinEntries.map((entry) => {
        const location = locations.find((l) => l.id === entry.locationId);
        if (!location) return null;

        return (
          <ChapterPin
            key={location.id}
            location={location}
            state={entry.state}
            registerRef={registerPinRef}
          />
        );
      })}
    </div>
  );
}
