import * as turf from "@turf/turf";
import type mapboxgl from "mapbox-gl";

export const SEGMENT_LAYER_PREFIX = "segment-";
export const SEGMENT_SOURCE_PREFIX = "segment-src-";
export const SEGMENT_GLOW_LAYER_PREFIX = "segment-glow-";

export function getEmptyRouteData(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function getFullRouteData(
  geometry: GeoJSON.LineString
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry,
      },
    ],
  };
}

export function getRouteDataForFraction(
  geometry: GeoJSON.LineString,
  fraction: number
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  if (fraction <= 0) {
    return getEmptyRouteData();
  }

  if (fraction >= 1) {
    return getFullRouteData(geometry);
  }

  const line = turf.lineString(geometry.coordinates);
  const totalLength = turf.length(line);

  if (totalLength <= 0) {
    return getFullRouteData(geometry);
  }

  const sliced = turf.lineSliceAlong(line, 0, fraction * totalLength);

  return getFullRouteData(sliced.geometry);
}

export function setSegmentSourceData(
  map: mapboxgl.Map,
  segmentId: string,
  geometry: GeoJSON.LineString | null,
  fraction = 1
) {
  const src = map.getSource(`${SEGMENT_SOURCE_PREFIX}${segmentId}`) as
    | mapboxgl.GeoJSONSource
    | undefined;

  if (!src) {
    return;
  }

  src.setData(geometry ? getRouteDataForFraction(geometry, fraction) : getEmptyRouteData());
}
