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
  initialBearing: number;
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

      // Compute fly zoom from bounding box — ensures both cities are visible
      const bbox = turf.bbox(
        turf.featureCollection([
          turf.point(fromLoc.coordinates),
          turf.point(toLoc.coordinates),
        ])
      );
      const bboxWidth = bbox[2] - bbox[0];
      const bboxHeight = bbox[3] - bbox[1];
      const maxSpan = Math.max(bboxWidth, bboxHeight);
      // Empirical: zoom ≈ 8.5 - log2(maxSpan) works well for most cases
      const flyZoom = clamp(8.5 - Math.log2(Math.max(maxSpan, 0.1)), 1.5, 7);

      // City zoom: enough to see the city name, but not too zoomed in
      const cityZoom = clamp(flyZoom + 4, 8, 13);

      const routeLine = seg.geometry;
      const routeLength = routeLine
        ? turf.length(turf.lineString(routeLine.coordinates))
        : distKm;

      const initialBearing = turf.bearing(
        turf.point(fromLoc.coordinates),
        turf.point(toLoc.coordinates)
      );

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
        initialBearing,
        distanceKm: distKm,
      };
    });
  }

  getCameraState(
    segmentIndex: number,
    phase: AnimationPhase,
    progress: number // already eased
  ): CameraState {
    const sc = this.segmentCameras[segmentIndex];
    if (!sc) {
      return { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 };
    }

    switch (phase) {
      case "HOVER":
        return {
          center: sc.fromCenter,
          zoom: sc.cityZoom,
          bearing: 0,
          pitch: 0,
        };

      case "ZOOM_OUT": {
        // Pull back from city to show the route
        // Center moves from departure toward the route midpoint
        const center = lerp2d(sc.fromCenter, sc.midpoint, progress);
        const zoom = lerp(sc.cityZoom, sc.flyZoom, progress);
        // Gradually rotate bearing toward travel direction
        const bearing = lerp(0, sc.initialBearing * 0.3, progress);
        // Tilt up to create 3D perspective
        const pitch = lerp(0, 50, progress);
        return { center, zoom, bearing, pitch };
      }

      case "FLY": {
        let center: [number, number];
        let bearing: number;

        if (sc.routeLine && sc.routeLine.coordinates.length > 1) {
          const line = turf.lineString(sc.routeLine.coordinates);

          // Camera position: slightly behind the icon for cinematic follow
          const cameraProgress = Math.max(0, progress - 0.05);
          const cameraAlong = turf.along(line, cameraProgress * sc.routeLength);
          center = cameraAlong.geometry.coordinates as [number, number];

          // Look-ahead bearing for smooth direction
          const lookAhead = Math.min(progress + 0.08, 1);
          const aheadPoint = turf.along(line, lookAhead * sc.routeLength);
          bearing = turf.bearing(cameraAlong, aheadPoint);
        } else {
          center = lerp2d(sc.fromCenter, sc.toCenter, progress);
          bearing = sc.initialBearing;
        }

        // Dynamic zoom during flight: slightly zoom in mid-flight, zoom out at edges
        // Creates a "swooping" feel
        const zoomPulse = Math.sin(progress * Math.PI) * 0.8;
        const zoom = sc.flyZoom + zoomPulse;

        // Maintain high pitch during flight for immersion
        const pitch = 50;

        return { center, zoom, bearing, pitch };
      }

      case "ZOOM_IN": {
        // Push from midpoint/route-end into destination
        const routeEnd = sc.routeLine
          ? (sc.routeLine.coordinates[sc.routeLine.coordinates.length - 1] as [number, number])
          : sc.toCenter;
        const center = lerp2d(routeEnd, sc.toCenter, progress);
        const zoom = lerp(sc.flyZoom + 0.8, sc.cityZoom, progress);
        // Rotate bearing back to north
        const endBearing = sc.routeLine
          ? this.getBearingAtEnd(sc)
          : sc.initialBearing;
        const bearing = lerp(endBearing, 0, progress);
        // Tilt back down to flat
        const pitch = lerp(50, 0, progress);
        return { center, zoom, bearing, pitch };
      }

      case "ARRIVE":
        return {
          center: sc.toCenter,
          zoom: sc.cityZoom,
          bearing: 0,
          pitch: 0,
        };

      default:
        return { center: sc.fromCenter, zoom: sc.cityZoom, bearing: 0, pitch: 0 };
    }
  }

  private getBearingAtEnd(sc: SegmentCamera): number {
    if (!sc.routeLine || sc.routeLine.coordinates.length < 2) {
      return sc.initialBearing;
    }
    const coords = sc.routeLine.coordinates;
    const n = coords.length;
    return turf.bearing(
      turf.point(coords[Math.max(0, n - 10)] as [number, number]),
      turf.point(coords[n - 1] as [number, number])
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
