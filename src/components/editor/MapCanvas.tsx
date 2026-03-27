"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMap } from "./MapContext";
import { useProjectStore } from "@/stores/projectStore";
import { MAPBOX_TOKEN, getDefaultMapOptions } from "@/lib/mapbox";
import { MAP_STYLES } from "@/lib/constants";
import type { MapStyle } from "@/types";

mapboxgl.accessToken = MAPBOX_TOKEN;

const ROUTE_SOURCE_ID = "route-preview";
const ROUTE_LAYER_ID = "route-preview-line";

export default function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const { setMap } = useMap();
  const addLocation = useProjectStore((s) => s.addLocation);
  const locations = useProjectStore((s) => s.locations);
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
      transformRequest: (url: string) => {
        return { url, credentials: "same-origin" as const };
      },
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: {
          "line-color": "#6366f1",
          "line-width": 2,
          "line-dasharray": [4, 4],
        },
      });
    });

    mapInstanceRef.current = map;
    setMap(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [setMap]);

  // Handle map click → reverse geocode → add location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = async (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      try {
        const res = await fetch(
          `/api/geocode?lng=${lng}&lat=${lat}`
        );
        const data = await res.json();
        const name =
          data.features?.[0]?.text || data.features?.[0]?.place_name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
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

  // Sync markers with locations
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentIds = new Set(locations.map((l) => l.id));
    // Remove stale markers
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
    // Add/update markers
    locations.forEach((loc, index) => {
      let marker = markersRef.current.get(loc.id);
      if (marker) {
        marker.setLngLat(loc.coordinates);
      } else {
        const el = document.createElement("div");
        el.className = "marker-label";
        el.style.cssText =
          "width:28px;height:28px;border-radius:50%;background:#6366f1;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);cursor:pointer;";
        el.textContent = String(index + 1);
        marker = new mapboxgl.Marker({ element: el })
          .setLngLat(loc.coordinates)
          .addTo(map);
        markersRef.current.set(loc.id, marker);
      }
      // Update label number
      const el = marker.getElement();
      el.textContent = String(index + 1);
    });

    // Update route preview line
    if (map.getSource(ROUTE_SOURCE_ID)) {
      const coordinates = locations.map((l) => l.coordinates);
      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features:
          coordinates.length >= 2
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates,
                  },
                },
              ]
            : [],
      };
      (map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(
        geojson
      );
    }
  }, [locations]);

  // Sync map style
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setStyle(MAP_STYLES[mapStyle]);
  }, [mapStyle]);

  return <div ref={containerRef} className="w-full h-full" />;
}
