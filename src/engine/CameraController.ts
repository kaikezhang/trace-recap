import * as turf from "@turf/turf";
import type { Location, Segment, AnimationPhase, CameraState } from "@/types";
import { ZOOM_RANGE } from "@/lib/constants";

interface SegmentCamera {
  fromCenter: [number, number];
  toCenter: [number, number];
  midpoint: [number, number];
  flyZoom: number;
  cityZoom: number;
  routeLine: GeoJSON.LineString | null;
  routeLength: number;
}

export class CameraController {
  private segmentCameras: SegmentCamera[];

  constructor(locations: Location[], segments: Segment[]) {
    this.segmentCameras = segments.map((seg) => {
      const fromLoc = locations.find((l) => l.id === seg.fromId)!;
      const toLoc = locations.find((l) => l.id === seg.toId)!;
      const distKm = turf.distance(
        turf.point(fromLoc.coordinates),
        turf.point(toLoc.coordinates)
      );

      const flyZoom = clamp(14 - Math.log2(distKm / 50), ZOOM_RANGE.flyMin, ZOOM_RANGE.flyMax);
      const cityZoom = clamp(flyZoom + 4, ZOOM_RANGE.cityMin, ZOOM_RANGE.cityMax);

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
      };
    });
  }

  getCameraState(
    segmentIndex: number,
    phase: AnimationPhase,
    progress: number
  ): CameraState {
    const sc = this.segmentCameras[segmentIndex];
    if (!sc) {
      return { center: [0, 0], zoom: 2, bearing: 0 };
    }

    switch (phase) {
      case "HOVER":
        return {
          center: sc.fromCenter,
          zoom: sc.cityZoom,
          bearing: 0,
        };

      case "ZOOM_OUT": {
        const center = lerp2d(sc.fromCenter, sc.midpoint, progress);
        const zoom = lerp(sc.cityZoom, sc.flyZoom, progress);
        return { center, zoom, bearing: 0 };
      }

      case "FLY": {
        let center: [number, number];
        let bearing = 0;

        if (sc.routeLine && sc.routeLine.coordinates.length > 1) {
          const along = turf.along(
            turf.lineString(sc.routeLine.coordinates),
            progress * sc.routeLength
          );
          center = along.geometry.coordinates as [number, number];

          // Compute bearing from current to a point slightly ahead
          const aheadProgress = Math.min(progress + 0.02, 1);
          const ahead = turf.along(
            turf.lineString(sc.routeLine.coordinates),
            aheadProgress * sc.routeLength
          );
          bearing = turf.bearing(along, ahead);
        } else {
          center = lerp2d(sc.fromCenter, sc.toCenter, progress);
          bearing = turf.bearing(
            turf.point(sc.fromCenter),
            turf.point(sc.toCenter)
          );
        }

        return { center, zoom: sc.flyZoom, bearing: 0 }; // Keep bearing 0 for smoother feel
      }

      case "ZOOM_IN": {
        const center = lerp2d(sc.midpoint, sc.toCenter, progress);
        const zoom = lerp(sc.flyZoom, sc.cityZoom, progress);
        return { center, zoom, bearing: 0 };
      }

      case "ARRIVE":
        return {
          center: sc.toCenter,
          zoom: sc.cityZoom,
          bearing: 0,
        };

      default:
        return { center: sc.fromCenter, zoom: sc.cityZoom, bearing: 0 };
    }
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
