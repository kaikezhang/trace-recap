import * as turf from "@turf/turf";
import BezierEasing from "bezier-easing";
import type { AnimationGroup, AnimationPhase, CameraState } from "@/types";

// Per-phase easing curves
const PHASE_EASINGS: Record<AnimationPhase, (t: number) => number> = {
  HOVER: (t: number) => t, // linear
  ZOOM_OUT: BezierEasing(0.0, 0.0, 0.2, 1.0), // ease-out
  FLY: BezierEasing(0.42, 0.0, 0.58, 1.0), // ease-in-out
  ZOOM_IN: BezierEasing(0.4, 0.0, 1.0, 1.0), // ease-in
  ARRIVE: (t: number) => t, // linear
};

interface GroupCamera {
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
  private groupCameras: GroupCamera[];

  constructor(groups: AnimationGroup[]) {
    // First pass: compute basic group data
    const basicData = groups.map((group) => {
      let fromCoords = group.fromLoc.coordinates;
      let toCoords = group.toLoc.coordinates;

      // If mergedGeometry exists, use its first/last coords for camera centers
      // These are unwrapped (continuous longitude) which prevents globe flipping
      // at the antimeridian
      const mg = group.mergedGeometry;
      if (mg && mg.coordinates && mg.coordinates.length >= 2) {
        fromCoords = mg.coordinates[0] as [number, number];
        toCoords = mg.coordinates[mg.coordinates.length - 1] as [number, number];
      }

      const distKm = turf.distance(
        turf.point(group.fromLoc.coordinates),
        turf.point(group.toLoc.coordinates)
      );

      // Fly zoom: fit ALL locations in the group using bbox
      const points = group.allLocations.map((loc) => turf.point(loc.coordinates));
      const bbox = turf.bbox(turf.featureCollection(points));
      const bboxWidth = Math.abs(bbox[2] - bbox[0]);
      const bboxHeight = Math.abs(bbox[3] - bbox[1]);
      const maxSpan = Math.max(bboxWidth, bboxHeight, 0.01);
      const flyZoom = clamp(
        Math.log2(360 / maxSpan) - 1,
        1.5,
        8
      );

      const routeLine = group.mergedGeometry;
      let routeLength = distKm;
      if (routeLine && routeLine.coordinates && routeLine.coordinates.length >= 2) {
        try {
          routeLength = turf.length(turf.lineString(routeLine.coordinates));
        } catch {
          // Invalid coordinates — fallback to straight-line distance
          routeLength = distKm;
        }
      }

      return {
        fromCenter: fromCoords,
        toCenter: toCoords,
        midpoint: [
          (fromCoords[0] + toCoords[0]) / 2,
          (fromCoords[1] + toCoords[1]) / 2,
        ] as [number, number],
        flyZoom,
        arriveZoom: 12, // placeholder, computed in second pass
        routeLine,
        routeLength,
        distanceKm: distKm,
      };
    });

    // Second pass: compute arriveZoom using look-ahead to NEXT group
    this.groupCameras = basicData.map((cam, i) => {
      const isLast = i === basicData.length - 1;

      if (isLast) {
        // Final destination: moderate zoom, not street level
        cam.arriveZoom = clamp(cam.flyZoom + 3, 8, 10);
      } else {
        const nextDist = basicData[i + 1].distanceKm;

        if (nextDist < 50) {
          // Very close next stop: fit both in view
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
          cam.arriveZoom = clamp(fitZoom, 7, 10);
        } else if (nextDist < 200) {
          // Provincial scale (e.g. cities within Yunnan/Taiwan)
          cam.arriveZoom = clamp(cam.flyZoom + 2, 7, 9);
        } else if (nextDist >= 1000) {
          // Very long next leg: barely zoom in
          cam.arriveZoom = clamp(cam.flyZoom + 1, 5, 7);
        } else {
          // Medium distance (200-1000km)
          cam.arriveZoom = clamp(cam.flyZoom + 2, 6, 8);
        }
      }

      return cam;
    });
  }

  /** Get the per-phase easing function */
  getEasing(phase: AnimationPhase): (t: number) => number {
    return PHASE_EASINGS[phase];
  }

  /** Get the look-ahead hover duration for a group */
  getHoverDuration(groupIndex: number): number {
    const n = this.groupCameras.length;
    const isLast = groupIndex === n - 1;

    if (isLast) return 2.0;

    const nextDist = this.groupCameras[groupIndex + 1]?.distanceKm ?? 0;
    if (nextDist < 100) return 1.5;
    if (nextDist >= 1000) return 0.8;
    return 1.0;
  }

  getCameraState(
    groupIndex: number,
    phase: AnimationPhase,
    progress: number
  ): CameraState {
    const gc = this.groupCameras[groupIndex];
    if (!gc) {
      return { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 };
    }

    const eased = PHASE_EASINGS[phase](progress);

    const prevArriveZoom =
      groupIndex > 0
        ? this.groupCameras[groupIndex - 1].arriveZoom
        : clamp(gc.flyZoom + 3, 8, 10);

    switch (phase) {
      case "HOVER": {
        return {
          center: gc.fromCenter,
          zoom: prevArriveZoom,
          bearing: 0,
          pitch: 0,
        };
      }

      case "ZOOM_OUT": {
        const center = lerp2d(gc.fromCenter, gc.midpoint, eased);
        const zoom = lerp(prevArriveZoom, gc.flyZoom, eased);
        return { center, zoom, bearing: 0, pitch: 0 };
      }

      case "FLY": {
        // Camera follows smooth straight-line path
        const center = lerp2d(gc.fromCenter, gc.toCenter, eased);

        // Gradual zoom during FLY — start zooming in the last 25%
        // This gives a smooth arrival without a sudden ZOOM_IN phase
        let zoom: number;
        const zoomStartAt = 0.75;
        if (eased > zoomStartAt) {
          const zoomProgress = (eased - zoomStartAt) / (1 - zoomStartAt);
          // Only reach 70% of target zoom during FLY — ZOOM_IN does the rest
          zoom = lerp(gc.flyZoom, gc.arriveZoom, zoomProgress * 0.7);
        } else {
          zoom = gc.flyZoom;
        }
        return { center, zoom, bearing: 0, pitch: 0 };
      }

      case "ZOOM_IN": {
        // Finish the remaining 30% of zoom
        const startZoom = lerp(gc.flyZoom, gc.arriveZoom, 0.7);
        const zoom = lerp(startZoom, gc.arriveZoom, eased);
        return { center: gc.toCenter, zoom, bearing: 0, pitch: 0 };
      }

      case "ARRIVE":
        return {
          center: gc.toCenter,
          zoom: gc.arriveZoom,
          bearing: 0,
          pitch: 0,
        };

      default:
        return {
          center: gc.fromCenter,
          zoom: gc.arriveZoom,
          bearing: 0,
          pitch: 0,
        };
    }
  }

  /** Get the route length for a group (used for progressive drawing) */
  getRouteLength(groupIndex: number): number {
    return this.groupCameras[groupIndex]?.routeLength ?? 0;
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
