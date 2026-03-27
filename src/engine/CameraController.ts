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
  arriveZoom: number;
  routeLine: GeoJSON.LineString | null;
  routeLength: number;
  distanceKm: number;
}

export class CameraController {
  private segmentCameras: SegmentCamera[];

  constructor(locations: Location[], segments: Segment[]) {
    // First pass: compute basic segment data
    const basicData = segments.map((seg) => {
      const fromLoc = locations.find((l) => l.id === seg.fromId)!;
      const toLoc = locations.find((l) => l.id === seg.toId)!;
      const distKm = turf.distance(
        turf.point(fromLoc.coordinates),
        turf.point(toLoc.coordinates)
      );

      // Fly zoom: fit both endpoints in view using bbox
      const bbox = turf.bbox(
        turf.featureCollection([
          turf.point(fromLoc.coordinates),
          turf.point(toLoc.coordinates),
        ])
      );
      const bboxWidth = Math.abs(bbox[2] - bbox[0]);
      const bboxHeight = Math.abs(bbox[3] - bbox[1]);
      const maxSpan = Math.max(bboxWidth, bboxHeight, 0.01);
      const flyZoom = clamp(
        Math.log2(360 / maxSpan) - 1,
        1.5,
        8
      );

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
        arriveZoom: 12, // placeholder, computed in second pass
        routeLine,
        routeLength,
        distanceKm: distKm,
      };
    });

    // Second pass: compute arriveZoom using look-ahead to NEXT segment
    this.segmentCameras = basicData.map((cam, i) => {
      const isLast = i === basicData.length - 1;

      if (isLast) {
        // Last destination: zoom to city level
        cam.arriveZoom = clamp(cam.flyZoom + 5, 12, 13);
      } else {
        const nextDist = basicData[i + 1].distanceKm;

        if (nextDist < 100) {
          // Short next segment: zoom to fit current + next destination
          const nextCam = basicData[i + 1];
          const bbox = turf.bbox(
            turf.featureCollection([
              turf.point(cam.toCenter),
              turf.point(nextCam.toCenter),
            ])
          );
          const bboxWidth = Math.abs(bbox[2] - bbox[0]);
          const bboxHeight = Math.abs(bbox[3] - bbox[1]);
          const maxSpan = Math.max(bboxWidth, bboxHeight, 0.01);
          const fitZoom = Math.log2(360 / maxSpan) - 1;
          cam.arriveZoom = clamp(fitZoom, 9, 13);
        } else if (nextDist >= 1000) {
          // Very long next segment: barely zoom in
          cam.arriveZoom = clamp(cam.flyZoom + 2, 6, 7);
        } else {
          // Medium next segment (100-1000km): moderate zoom
          cam.arriveZoom = clamp(cam.flyZoom + 3, 9, 10);
        }
      }

      return cam;
    });
  }

  /** Get the per-phase easing function */
  getEasing(phase: AnimationPhase): (t: number) => number {
    return PHASE_EASINGS[phase];
  }

  /** Get the look-ahead hover duration for a segment */
  getHoverDuration(segmentIndex: number): number {
    const n = this.segmentCameras.length;
    const isLast = segmentIndex === n - 1;

    if (isLast) return 2.0;

    const nextDist = this.segmentCameras[segmentIndex + 1]?.distanceKm ?? 0;
    if (nextDist < 100) return 1.5;
    if (nextDist >= 1000) return 0.8;
    return 1.0;
  }

  getCameraState(
    segmentIndex: number,
    phase: AnimationPhase,
    progress: number
  ): CameraState {
    const sc = this.segmentCameras[segmentIndex];
    if (!sc) {
      return { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 };
    }

    const eased = PHASE_EASINGS[phase](progress);

    // Get the arrive zoom of the previous segment (or this segment's arrive zoom for first)
    const prevArriveZoom =
      segmentIndex > 0
        ? this.segmentCameras[segmentIndex - 1].arriveZoom
        : sc.arriveZoom;

    switch (phase) {
      case "HOVER": {
        return {
          center: sc.fromCenter,
          zoom: prevArriveZoom,
          bearing: 0,
          pitch: 0,
        };
      }

      case "ZOOM_OUT": {
        const center = lerp2d(sc.fromCenter, sc.midpoint, eased);
        const zoom = lerp(prevArriveZoom, sc.flyZoom, eased);
        return { center, zoom, bearing: 0, pitch: 0 };
      }

      case "FLY": {
        let center: [number, number];

        if (sc.routeLine && sc.routeLine.coordinates.length > 1) {
          const line = turf.lineString(sc.routeLine.coordinates);
          const along = turf.along(line, eased * sc.routeLength);
          center = along.geometry.coordinates as [number, number];
        } else {
          center = lerp2d(sc.fromCenter, sc.toCenter, eased);
        }

        const zoom = sc.flyZoom;
        return { center, zoom, bearing: 0, pitch: 0 };
      }

      case "ZOOM_IN": {
        const routeEnd = sc.routeLine
          ? (sc.routeLine.coordinates[
              sc.routeLine.coordinates.length - 1
            ] as [number, number])
          : sc.toCenter;
        const center = lerp2d(routeEnd, sc.toCenter, eased);
        const zoom = lerp(sc.flyZoom, sc.arriveZoom, eased);
        return { center, zoom, bearing: 0, pitch: 0 };
      }

      case "ARRIVE":
        return {
          center: sc.toCenter,
          zoom: sc.arriveZoom,
          bearing: 0,
          pitch: 0,
        };

      default:
        return {
          center: sc.fromCenter,
          zoom: sc.arriveZoom,
          bearing: 0,
          pitch: 0,
        };
    }
  }

  /** Get the route length for a segment (used for progressive drawing) */
  getRouteLength(segmentIndex: number): number {
    return this.segmentCameras[segmentIndex]?.routeLength ?? 0;
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
