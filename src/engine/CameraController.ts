import * as turf from "@turf/turf";
import type { Location, Segment, AnimationPhase, CameraState } from "@/types";

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

  constructor(locations: Location[], segments: Segment[]) {
    this.segmentCameras = segments.map((seg) => {
      const fromLoc = locations.find((l) => l.id === seg.fromId)!;
      const toLoc = locations.find((l) => l.id === seg.toId)!;
      const distKm = turf.distance(
        turf.point(fromLoc.coordinates),
        turf.point(toLoc.coordinates)
      );

      // Compute fly zoom from bounding box
      const bbox = turf.bbox(
        turf.featureCollection([
          turf.point(fromLoc.coordinates),
          turf.point(toLoc.coordinates),
        ])
      );
      const bboxWidth = bbox[2] - bbox[0];
      const bboxHeight = bbox[3] - bbox[1];
      const maxSpan = Math.max(bboxWidth, bboxHeight);
      const flyZoom = clamp(8.5 - Math.log2(Math.max(maxSpan, 0.1)), 1.5, 7);
      const cityZoom = clamp(flyZoom + 4, 8, 13);

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

  getCameraState(
    segmentIndex: number,
    phase: AnimationPhase,
    progress: number
  ): CameraState {
    const sc = this.segmentCameras[segmentIndex];
    if (!sc) {
      return { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 };
    }

    // Bearing is ALWAYS 0 — north stays up
    const bearing = 0;

    switch (phase) {
      case "HOVER":
        return { center: sc.fromCenter, zoom: sc.cityZoom, bearing, pitch: 0 };

      case "ZOOM_OUT": {
        const center = lerp2d(sc.fromCenter, sc.midpoint, progress);
        const zoom = lerp(sc.cityZoom, sc.flyZoom, progress);
        const pitch = lerp(0, 45, progress);
        return { center, zoom, bearing, pitch };
      }

      case "FLY": {
        let center: [number, number];

        if (sc.routeLine && sc.routeLine.coordinates.length > 1) {
          const line = turf.lineString(sc.routeLine.coordinates);
          const along = turf.along(line, progress * sc.routeLength);
          center = along.geometry.coordinates as [number, number];
        } else {
          center = lerp2d(sc.fromCenter, sc.toCenter, progress);
        }

        // Gentle zoom pulse mid-flight
        const zoomPulse = Math.sin(progress * Math.PI) * 0.6;
        const zoom = sc.flyZoom + zoomPulse;
        const pitch = 45;

        return { center, zoom, bearing, pitch };
      }

      case "ZOOM_IN": {
        const routeEnd = sc.routeLine
          ? (sc.routeLine.coordinates[sc.routeLine.coordinates.length - 1] as [number, number])
          : sc.toCenter;
        const center = lerp2d(routeEnd, sc.toCenter, progress);
        const zoom = lerp(sc.flyZoom + 0.6, sc.cityZoom, progress);
        const pitch = lerp(45, 0, progress);
        return { center, zoom, bearing, pitch };
      }

      case "ARRIVE":
        return { center: sc.toCenter, zoom: sc.cityZoom, bearing, pitch: 0 };

      default:
        return { center: sc.fromCenter, zoom: sc.cityZoom, bearing, pitch: 0 };
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
