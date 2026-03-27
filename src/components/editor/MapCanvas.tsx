"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMap } from "./MapContext";
import { useProjectStore } from "@/stores/projectStore";
import { MAPBOX_TOKEN, getDefaultMapOptions } from "@/lib/mapbox";
import { MAP_STYLES } from "@/lib/constants";
import type { Segment, TransportMode } from "@/types";

mapboxgl.accessToken = MAPBOX_TOKEN;

const SEGMENT_LAYER_PREFIX = "segment-";
const SEGMENT_SOURCE_PREFIX = "segment-src-";

const MODE_LINE_STYLES: Record<
  TransportMode,
  { color: string; dasharray?: number[] }
> = {
  flight: { color: "#6366f1", dasharray: [4, 4] },
  car: { color: "#f59e0b" },
  train: { color: "#10b981" },
  bus: { color: "#8b5cf6" },
  ferry: { color: "#06b6d4", dasharray: [2, 2] },
  walk: { color: "#ec4899", dasharray: [1, 2] },
  bicycle: { color: "#14b8a6", dasharray: [3, 3] },
};

export default function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const segmentLayersRef = useRef<Set<string>>(new Set());
  const { setMap } = useMap();
  const addLocation = useProjectStore((s) => s.addLocation);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const mapStyle = useProjectStore((s) => s.mapStyle);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const opts = getDefaultMapOptions();
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: opts.style,
      center: opts.center,
      zoom: opts.zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapInstanceRef.current = map;
    setMap(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [setMap]);

  // Handle map click -> reverse geocode -> add location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = async (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      try {
        const res = await fetch(`/api/geocode?lng=${lng}&lat=${lat}`);
        const data = await res.json();
        const name =
          data.features?.[0]?.text ||
          data.features?.[0]?.place_name ||
          `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        addLocation({ name, coordinates: [lng, lat] });
      } catch {
        addLocation({
          name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
          coordinates: [lng, lat],
        });
      }
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [addLocation]);

  // Sync markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentIds = new Set(locations.map((l) => l.id));
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    locations.forEach((loc, index) => {
      let marker = markersRef.current.get(loc.id);
      if (marker) {
        marker.setLngLat(loc.coordinates);
      } else {
        const el = document.createElement("div");
        el.style.cssText =
          "width:28px;height:28px;border-radius:50%;background:#6366f1;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);cursor:pointer;";
        el.textContent = String(index + 1);
        marker = new mapboxgl.Marker({ element: el })
          .setLngLat(loc.coordinates)
          .addTo(map);
        markersRef.current.set(loc.id, marker);
      }
      marker.getElement().textContent = String(index + 1);
    });
  }, [locations]);

  // Sync segment route layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const ensureStyleLoaded = () => {
      if (!map.isStyleLoaded()) return;

      // Remove stale layers/sources
      const activeIds = new Set(segments.map((s) => s.id));
      for (const layerId of segmentLayersRef.current) {
        const segId = layerId.replace(SEGMENT_LAYER_PREFIX, "");
        if (!activeIds.has(segId)) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          const srcId = SEGMENT_SOURCE_PREFIX + segId;
          if (map.getSource(srcId)) map.removeSource(srcId);
          segmentLayersRef.current.delete(layerId);
        }
      }

      // Add/update segment layers
      for (const seg of segments) {
        const srcId = SEGMENT_SOURCE_PREFIX + seg.id;
        const layerId = SEGMENT_LAYER_PREFIX + seg.id;
        const lineStyle = MODE_LINE_STYLES[seg.transportMode];

        const geojsonData: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: seg.geometry
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: seg.geometry,
                },
              ]
            : [],
        };

        if (map.getSource(srcId)) {
          (map.getSource(srcId) as mapboxgl.GeoJSONSource).setData(
            geojsonData
          );
          // Update paint properties
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-color", lineStyle.color);
            map.setPaintProperty(
              layerId,
              "line-dasharray",
              lineStyle.dasharray || [1, 0]
            );
          }
        } else {
          map.addSource(srcId, { type: "geojson", data: geojsonData });
          map.addLayer({
            id: layerId,
            type: "line",
            source: srcId,
            paint: {
              "line-color": lineStyle.color,
              "line-width": 3,
              "line-dasharray": lineStyle.dasharray || [1, 0],
            },
          });
          segmentLayersRef.current.add(layerId);
        }
      }
    };

    if (map.isStyleLoaded()) {
      ensureStyleLoaded();
    } else {
      map.once("style.load", ensureStyleLoaded);
    }
  }, [segments]);

  // Sync map style — re-add layers after style change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const styleUrl = MAP_STYLES[mapStyle];
    map.setStyle(styleUrl);

    // After style loads, layers are cleared — we need to re-add them
    map.once("style.load", () => {
      segmentLayersRef.current.clear();
      // Trigger segment re-render by reading current state
      const currentSegments = useProjectStore.getState().segments;
      for (const seg of currentSegments) {
        const srcId = SEGMENT_SOURCE_PREFIX + seg.id;
        const layerId = SEGMENT_LAYER_PREFIX + seg.id;
        const lineStyle = MODE_LINE_STYLES[seg.transportMode];

        const geojsonData: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: seg.geometry
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: seg.geometry,
                },
              ]
            : [],
        };

        map.addSource(srcId, { type: "geojson", data: geojsonData });
        map.addLayer({
          id: layerId,
          type: "line",
          source: srcId,
          paint: {
            "line-color": lineStyle.color,
            "line-width": 3,
            "line-dasharray": lineStyle.dasharray || [1, 0],
          },
        });
        segmentLayersRef.current.add(layerId);
      }
    });
  }, [mapStyle]);

  return <div ref={containerRef} className="w-full h-full" />;
}
