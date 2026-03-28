import * as turf from "@turf/turf";
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
  const gc = turf.greatCircle(turf.point(from), turf.point(to), {
    npoints: 100,
  });

  // greatCircle returns MultiLineString when crossing the antimeridian (date line)
  // Merge all segments into a single LineString
  if (gc.geometry.type === "MultiLineString") {
    const allCoords: number[][] = [];
    for (const segment of gc.geometry.coordinates) {
      allCoords.push(...segment);
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
  const bearing = turf.bearing(turf.point(from), turf.point(to));
  const perpBearing = bearing + 90;
  const dist = turf.distance(turf.point(from), turf.point(to));
  const offset = dist * 0.2;

  const controlPoint = turf.destination(
    turf.point([midLng, midLat]),
    offset,
    perpBearing
  );

  const line = turf.lineString([
    from,
    controlPoint.geometry.coordinates as [number, number],
    to,
  ]);

  const curved = turf.bezierSpline(line, { resolution: 10000, sharpness: 0.85 });
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
