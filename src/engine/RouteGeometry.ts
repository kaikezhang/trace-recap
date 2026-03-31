import { bearing as getBearing } from "@turf/bearing";
import { bezierSpline } from "@turf/bezier-spline";
import { destination } from "@turf/destination";
import { distance } from "@turf/distance";
import { greatCircle } from "@turf/great-circle";
import { lineString, point } from "@turf/helpers";
import type { TransportMode } from "@/types";
import { TRANSPORT_MODES } from "@/lib/constants";

export async function generateRouteGeometry(
  from: [number, number],
  to: [number, number],
  mode: TransportMode
): Promise<GeoJSON.LineString> {
  if (mode === "flight") {
    return generateGreatCircle(from, to);
  }

  if (mode === "ferry") {
    return generateFerryRoute(from, to);
  }

  const config = TRANSPORT_MODES.find((m) => m.id === mode);
  const profile = config?.directionsProfile ?? "driving";

  try {
    return await fetchDirections(from, to, profile);
  } catch {
    // Fallback to straight line
    return {
      type: "LineString",
      coordinates: [from, to],
    };
  }
}

function generateGreatCircle(
  from: [number, number],
  to: [number, number]
): GeoJSON.LineString {
  const gc = greatCircle(point(from), point(to), {
    npoints: 100,
  });

  // greatCircle returns MultiLineString when crossing the antimeridian (date line)
  // Merge segments and unwrap longitudes so Mapbox doesn't draw a line around the globe
  if (gc.geometry.type === "MultiLineString") {
    const allCoords: number[][] = [];
    for (const segment of gc.geometry.coordinates) {
      for (const coord of segment) {
        if (allCoords.length > 0) {
          const prevLng = allCoords[allCoords.length - 1][0];
          let lng = coord[0];
          // Unwrap: if the jump is > 180°, shift by 360°
          while (lng - prevLng > 180) lng -= 360;
          while (lng - prevLng < -180) lng += 360;
          allCoords.push([lng, coord[1]]);
        } else {
          allCoords.push([...coord]);
        }
      }
    }
    return { type: "LineString", coordinates: allCoords };
  }

  return gc.geometry as GeoJSON.LineString;
}

function generateFerryRoute(
  from: [number, number],
  to: [number, number]
): GeoJSON.LineString {
  const midLng = (from[0] + to[0]) / 2;
  const midLat = (from[1] + to[1]) / 2;
  const bearing = getBearing(point(from), point(to));
  const perpBearing = bearing + 90;
  const dist = distance(point(from), point(to));
  const offset = dist * 0.2;

  const controlPoint = destination(
    point([midLng, midLat]),
    offset,
    perpBearing
  );

  const line = lineString([
    from,
    controlPoint.geometry.coordinates as [number, number],
    to,
  ]);

  const curved = bezierSpline(line, { resolution: 10000, sharpness: 0.85 });
  return curved.geometry as GeoJSON.LineString;
}

async function fetchDirections(
  from: [number, number],
  to: [number, number],
  profile: string
): Promise<GeoJSON.LineString> {
  const res = await fetch(
    `/api/directions?profile=${profile}&from=${from.join(",")}&to=${to.join(",")}`
  );
  if (!res.ok) throw new Error("Directions API failed");
  const data = await res.json();
  return data.geometry;
}
