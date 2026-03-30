/**
 * Granular Zustand selectors for projectStore.
 *
 * Problem: `useProjectStore(s => s.locations)` returns a new array reference
 * whenever ANY location mutates (including photo-only changes). Components
 * that don't care about photos (MapCanvas, RouteList, TransportSelector)
 * re-render unnecessarily.
 *
 * Solution: selectors that extract only the fields each consumer needs,
 * paired with custom equality functions so Zustand skips re-renders when
 * the extracted slice hasn't actually changed.
 */

import { useStoreWithEqualityFn } from "zustand/traditional";
import { useProjectStore } from "./projectStore";
import type { Location } from "@/types";

// ---------------------------------------------------------------------------
// RouteList: only needs location IDs (for SortableContext) and count
// ---------------------------------------------------------------------------

export function useLocationIds(): string[] {
  return useStoreWithEqualityFn(
    useProjectStore,
    (s) => s.locations.map((l) => l.id),
    (a, b) =>
      a.length === b.length && a.every((id, i) => id === b[i]),
  );
}

export function useLocationCount(): number {
  return useProjectStore((s) => s.locations.length);
}

// ---------------------------------------------------------------------------
// MapCanvas: needs id, coordinates, isWaypoint per location (no photos)
// ---------------------------------------------------------------------------

export interface LocationMapMeta {
  id: string;
  name: string;
  coordinates: [number, number];
  isWaypoint: boolean;
}

export function useLocationsForMap(): LocationMapMeta[] {
  return useStoreWithEqualityFn(
    useProjectStore,
    (s) =>
      s.locations.map((l) => ({
        id: l.id,
        name: l.name,
        coordinates: l.coordinates,
        isWaypoint: l.isWaypoint,
      })),
    (a, b) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (
          a[i].id !== b[i].id ||
          a[i].name !== b[i].name ||
          a[i].coordinates[0] !== b[i].coordinates[0] ||
          a[i].coordinates[1] !== b[i].coordinates[1] ||
          a[i].isWaypoint !== b[i].isWaypoint
        ) return false;
      }
      return true;
    },
  );
}

// ---------------------------------------------------------------------------
// TransportSelector: needs fromLoc/toLoc coordinates only
// ---------------------------------------------------------------------------

export interface SegmentEndpoints {
  from: { coordinates: [number, number] } | null;
  to: { coordinates: [number, number] } | null;
}

export function useSegmentEndpoints(fromId: string, toId: string): SegmentEndpoints {
  return useStoreWithEqualityFn(
    useProjectStore,
    (s) => {
      const from = s.locations.find((l) => l.id === fromId);
      const to = s.locations.find((l) => l.id === toId);
      return {
        from: from ? { coordinates: from.coordinates } : null,
        to: to ? { coordinates: to.coordinates } : null,
      };
    },
    (a, b) =>
      a.from?.coordinates[0] === b.from?.coordinates[0] &&
      a.from?.coordinates[1] === b.from?.coordinates[1] &&
      a.to?.coordinates[0] === b.to?.coordinates[0] &&
      a.to?.coordinates[1] === b.to?.coordinates[1],
  );
}

// ---------------------------------------------------------------------------
// Single location by ID (for LocationCard self-subscription)
// ---------------------------------------------------------------------------

export function useLocation(id: string): Location | undefined {
  return useProjectStore((s) => s.locations.find((l) => l.id === id));
}
