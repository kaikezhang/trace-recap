import * as turf from "@turf/turf";
import BezierEasing from "bezier-easing";
import type { Location, Segment, AnimationPhase, CameraState } from "@/types";

// Per-phase easing curves
const PHASE_EASINGS: Record<AnimationPhase, (t: number) => number> = {
  HOVER: (t: number) => t, // linear
  ZOOM_OUT: BezierEasing(0.0, 0.0, 0.2, 1.0), // ease-out
  FLY: BezierEasing(0.42, 0.0, 0.58, 1.0), // ease-in-out
  ZOOM_IN: BezierEasing(0.4, 0.0, 1.0, 1.0), // ease-in
  ARRIVE: (t: number) => t, // linear
};

interface SegmentCamera {
  fromCenter: [number, number];
  toCenter: [number, number];
  midpoint: [number, number];
  flyZoom: number;
  cityZoom: number;
  routeLine: GeoJSON.LineString | null;
  routeLength: number;
  distanceKm: number;
}

export class CameraController {
  private segmentCameras: SegmentCamera[];
  private prevBearing: number = 0;

  constructor(locations: Location[], segments: Segment[]) {
    this.segmentCameras = segments.map((seg) => {
      const fromLoc = locations.find((l) => l.id === seg.fromId)!;
      const toLoc = locations.find((l) => l.id === seg.toId)!;
      const distKm = turf.distance(
        turf.point(fromLoc.coordinates),
        turf.point(toLoc.coordinates)
      );

      // Fly zoom based on distance: farther = more zoomed out
      const flyZoom = clamp(7 - Math.log2(Math.max(distKm, 1) / 200), 1.5, 6);
      // City zoom: close-up view
      const cityZoom = clamp(flyZoom + 6, 12, 14);

      const routeLine = seg.geometry;
      const routeLength = routeLine
        ? turf.length(turf.lineString(routeLine.coordinates))
        : distKm;

      return {
        fromCenter: fromLoc.coordinates,
        toCenter: toLoc.coordinates,
        midpoint: [
          (fromLoc.coordinates[0] + toLoc.coordinates[0]) / 2,
          (fromLoc.coordinates[1] + toLoc.coordinates[1]) / 2,
        ] as [number, number],
        flyZoom,
        cityZoom,
        routeLine,
        routeLength,
        distanceKm: distKm,
      };
    });
  }

  /** Get the per-phase easing function */
  getEasing(phase: AnimationPhase): (t: number) => number {
    return PHASE_EASINGS[phase];
  }

  getCameraState(
    segmentIndex: number,
    phase: AnimationPhase,
    progress: number // raw progress (0-1), easing applied internally
  ): CameraState {
    const sc = this.segmentCameras[segmentIndex];
    if (!sc) {
      return { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 };
    }

    const eased = PHASE_EASINGS[phase](progress);

    switch (phase) {
      case "HOVER": {
        // Compute initial bearing toward route start direction
        const bearing = this.getInitialBearing(sc);
        this.prevBearing = bearing;
        return {
          center: sc.fromCenter,
          zoom: sc.cityZoom,
          bearing: 0,
          pitch: 0,
        };
      }

      case "ZOOM_OUT": {
        // Zoom out from city, keeping center at fromCenter so FLY starts seamlessly
        const center = sc.fromCenter;
        const zoom = lerp(sc.cityZoom, sc.flyZoom, eased);
        const pitch = lerp(0, 60, eased);
        // Start rotating bearing toward route direction
        const targetBearing = this.getInitialBearing(sc);
        const bearing = lerp(0, targetBearing, eased);
        this.prevBearing = bearing;
        return { center, zoom, bearing, pitch };
      }

      case "FLY": {
        let center: [number, number];
        let bearing: number;

        if (sc.routeLine && sc.routeLine.coordinates.length > 1) {
          const line = turf.lineString(sc.routeLine.coordinates);
          const along = turf.along(line, eased * sc.routeLength);
          center = along.geometry.coordinates as [number, number];

          // Dynamic bearing: look ahead along route
          const lookAheadDist = Math.min(
            (eased + 0.05) * sc.routeLength,
            sc.routeLength
          );
          const ahead = turf.along(line, lookAheadDist);
          const aCoord = along.geometry.coordinates;
          const bCoord = ahead.geometry.coordinates;
          // When look-ahead equals current (at route end), reuse cached bearing
          if (
            Math.abs(aCoord[0] - bCoord[0]) < 1e-9 &&
            Math.abs(aCoord[1] - bCoord[1]) < 1e-9
          ) {
            bearing = this.prevBearing;
          } else {
            const rawBearing = turf.bearing(along, ahead);
            // Smooth bearing to avoid jerky rotation
            bearing = smoothBearing(this.prevBearing, rawBearing, 0.15);
          }
        } else {
          center = lerp2d(sc.fromCenter, sc.toCenter, eased);
          bearing = turf.bearing(
            turf.point(sc.fromCenter),
            turf.point(sc.toCenter)
          );
        }

        this.prevBearing = bearing;

        // Gentle zoom pulse mid-flight
        const zoomPulse = Math.sin(eased * Math.PI) * 0.4;
        const zoom = sc.flyZoom + zoomPulse;
        const pitch = 60;

        return { center, zoom, bearing, pitch };
      }

      case "ZOOM_IN": {
        const routeEnd = sc.routeLine
          ? (sc.routeLine.coordinates[
              sc.routeLine.coordinates.length - 1
            ] as [number, number])
          : sc.toCenter;
        const center = lerp2d(routeEnd, sc.toCenter, eased);
        const zoom = lerp(sc.flyZoom + 0.4, sc.cityZoom, eased);
        const pitch = lerp(60, 0, eased);
        // Ease bearing back to 0
        const bearing = lerp(this.prevBearing, 0, eased);
        return { center, zoom, bearing, pitch };
      }

      case "ARRIVE":
        this.prevBearing = 0;
        return {
          center: sc.toCenter,
          zoom: sc.cityZoom,
          bearing: 0,
          pitch: 0,
        };

      default:
        return {
          center: sc.fromCenter,
          zoom: sc.cityZoom,
          bearing: 0,
          pitch: 0,
        };
    }
  }

  /** Get the route length for a segment (used for progressive drawing) */
  getRouteLength(segmentIndex: number): number {
    return this.segmentCameras[segmentIndex]?.routeLength ?? 0;
  }

  private getInitialBearing(sc: SegmentCamera): number {
    if (sc.routeLine && sc.routeLine.coordinates.length > 1) {
      const start = sc.routeLine.coordinates[0] as [number, number];
      const lookIdx = Math.min(10, sc.routeLine.coordinates.length - 1);
      const lookPt = sc.routeLine.coordinates[lookIdx] as [number, number];
      return turf.bearing(turf.point(start), turf.point(lookPt));
    }
    return turf.bearing(
      turf.point(sc.fromCenter),
      turf.point(sc.toCenter)
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp2d(
  a: [number, number],
  b: [number, number],
  t: number
): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/** Smoothly interpolate between two bearings, handling the 360° wrap */
function smoothBearing(
  current: number,
  target: number,
  smoothing: number
): number {
  // Normalize both to [-180, 180]
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return current + diff * smoothing;
}
