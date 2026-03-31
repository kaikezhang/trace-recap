import * as turf from "@turf/turf";
import type { Location, Segment, AnimationPhase } from "@/types";

export interface TripStats {
  totalDistanceKm: number;
  citiesVisited: number;
  totalCities: number;
  photosShown: number;
  totalPhotos: number;
  transportModes: Map<string, number>;
  currentSegmentIndex: number;
  elapsedPercent: number;
}

/** Icon label for each transport mode */
export const TRANSPORT_MODE_EMOJI: Record<string, string> = {
  flight: "✈️",
  train: "🚄",
  car: "🚗",
  bus: "🚌",
  ferry: "⛴️",
  walk: "🚶",
  bicycle: "🚲",
  motorcycle: "🏍️",
};

/** Order for displaying transport mode icons */
const MODE_ORDER = ["flight", "train", "car", "bus", "ferry", "motorcycle", "bicycle", "walk"];

function getSegmentDistanceKm(segment: Segment): number {
  if (!segment.geometry) return 0;
  try {
    return turf.length(turf.lineString(segment.geometry.coordinates), { units: "kilometers" });
  } catch {
    return 0;
  }
}

/**
 * Compute trip statistics given the current animation state.
 *
 * @param locations - All project locations
 * @param segments - All project segments
 * @param currentSegmentIndex - The currently active segment index (0-based)
 * @param currentPhase - The current animation phase
 * @param flyProgress - 0-1 progress within the FLY phase of the current segment (routeDrawFraction)
 * @param showPhotos - Whether photos are currently being displayed
 */
export function computeTripStats(
  locations: Location[],
  segments: Segment[],
  currentSegmentIndex: number,
  currentPhase: AnimationPhase | string | null,
  flyProgress: number = 0,
  showPhotos: boolean = false
): TripStats {
  const nonWaypointLocations = locations.filter((l) => !l.isWaypoint);
  const totalCities = nonWaypointLocations.length;
  const totalPhotos = locations.reduce((sum, l) => sum + l.photos.length, 0);

  let totalDistanceKm = 0;
  const transportModes = new Map<string, number>();
  const visitedLocationIds = new Set<string>();

  // The first location is always visited when playback starts
  if (locations.length > 0 && currentSegmentIndex >= 0) {
    visitedLocationIds.add(locations[0].id);
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentDist = getSegmentDistanceKm(segment);

    if (i < currentSegmentIndex) {
      // Completed segment — full distance
      totalDistanceKm += segmentDist;
      addTransportMode(transportModes, segment.transportMode, segmentDist);
      visitedLocationIds.add(segment.fromId);
      visitedLocationIds.add(segment.toId);
    } else if (i === currentSegmentIndex) {
      // Current segment — partial distance based on phase
      visitedLocationIds.add(segment.fromId);

      if (currentPhase === "FLY") {
        const partial = segmentDist * Math.max(0, Math.min(1, flyProgress));
        totalDistanceKm += partial;
        addTransportMode(transportModes, segment.transportMode, partial);
      } else if (currentPhase === "ZOOM_IN" || currentPhase === "ARRIVE") {
        // Past the fly phase — full segment distance
        totalDistanceKm += segmentDist;
        addTransportMode(transportModes, segment.transportMode, segmentDist);
        visitedLocationIds.add(segment.toId);
      } else {
        // HOVER or ZOOM_OUT — haven't started flying yet
        addTransportMode(transportModes, segment.transportMode, 0);
      }
    }
    // Future segments are not counted
  }

  // Count visited non-waypoint locations
  const citiesVisited = nonWaypointLocations.filter((l) => visitedLocationIds.has(l.id)).length;

  // Count photos from visited locations
  let photosShown = 0;
  if (showPhotos) {
    // When photos are currently showing, include current location's photos
    photosShown = locations
      .filter((l) => visitedLocationIds.has(l.id))
      .reduce((sum, l) => sum + l.photos.length, 0);
  } else {
    // Only count photos from locations we've fully visited (completed segments)
    const fullyVisitedIds = new Set<string>();
    if (locations.length > 0 && currentSegmentIndex >= 0) {
      fullyVisitedIds.add(locations[0].id);
    }
    for (let i = 0; i < currentSegmentIndex && i < segments.length; i++) {
      fullyVisitedIds.add(segments[i].fromId);
      fullyVisitedIds.add(segments[i].toId);
    }
    // If we're at ARRIVE phase, current segment's destination is fully visited
    if (
      currentSegmentIndex < segments.length &&
      (currentPhase === "ARRIVE")
    ) {
      fullyVisitedIds.add(segments[currentSegmentIndex].toId);
    }
    photosShown = locations
      .filter((l) => fullyVisitedIds.has(l.id))
      .reduce((sum, l) => sum + l.photos.length, 0);
  }

  const elapsedPercent =
    segments.length > 0
      ? Math.min(1, (currentSegmentIndex + (currentPhase === "FLY" ? flyProgress : currentPhase === "ZOOM_IN" || currentPhase === "ARRIVE" ? 1 : 0)) / segments.length)
      : 0;

  return {
    totalDistanceKm,
    citiesVisited,
    totalCities,
    photosShown,
    totalPhotos,
    transportModes,
    currentSegmentIndex,
    elapsedPercent,
  };
}

function addTransportMode(modes: Map<string, number>, mode: string, distance: number): void {
  modes.set(mode, (modes.get(mode) ?? 0) + distance);
}

/** Get transport mode icons sorted by first-use order */
export function getSortedTransportModes(modes: Map<string, number>): string[] {
  return MODE_ORDER.filter((mode) => modes.has(mode));
}
