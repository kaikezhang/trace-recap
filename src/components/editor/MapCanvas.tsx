"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMap } from "./MapContext";
import {
  getEmptyRouteData,
  SEGMENT_GLOW_LAYER_PREFIX,
  SEGMENT_LAYER_PREFIX,
  SEGMENT_SOURCE_PREFIX,
  setSegmentSourceData,
} from "./routeSegmentSources";
import { useProjectStore } from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";
import { MAPBOX_TOKEN, getDefaultMapOptions, applyStyleOverrides } from "@/lib/mapbox";
import { MAP_STYLES } from "@/lib/constants";
import type { TransportMode } from "@/types";

mapboxgl.accessToken = MAPBOX_TOKEN;

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
  const [mapLoaded, setMapLoaded] = useState(false);
  const { setMap } = useMap();
  const addLocation = useProjectStore((s) => s.addLocation);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const mapStyle = useProjectStore((s) => s.mapStyle);
  const playbackState = useAnimationStore((s) => s.playbackState);
  const currentSegmentIndex = useAnimationStore((s) => s.currentSegmentIndex);
  const currentGroupSegmentIndices = useAnimationStore((s) => s.currentGroupSegmentIndices);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const opts = getDefaultMapOptions();
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: opts.style,
      center: opts.center,
      zoom: opts.zoom,
      preserveDrawingBuffer: true, // Required for canvas.toBlob() in video export
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.once("style.load", () => setMapLoaded(true));
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
        // Reverse geocode for English name, then forward geocode that name → Chinese
        const resEn = await fetch(`/api/geocode?lng=${lng}&lat=${lat}`);
        const dataEn = await resEn.json();
        const name =
          dataEn.features?.[0]?.text ||
          dataEn.features?.[0]?.place_name ||
          `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        // Forward geocode English name → Chinese (avoids granularity mismatch)
        let nameZh: string | undefined;
        try {
          const resZh = await fetch(`/api/geocode?q=${encodeURIComponent(name)}&language=zh-Hans`);
          const dataZh = await resZh.json();
          nameZh = dataZh.features?.[0]?.text || dataZh.features?.[0]?.place_name || undefined;
        } catch { /* non-critical */ }
        addLocation({ name, nameZh, coordinates: [lng, lat] });
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
      if (loc.isWaypoint) {
        // Waypoints: no marker at all
        if (marker) {
          marker.remove();
          markersRef.current.delete(loc.id);
        }
        return;
      }
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

  // Marker visibility during playback:
  // Playing: only show markers for locations already visited (index <= currentSegmentIndex)
  // Idle: show all markers
  useEffect(() => {
    if (playbackState === "playing" || playbackState === "paused") {
      locations.forEach((loc, index) => {
        const marker = markersRef.current.get(loc.id);
        if (marker) {
          // Waypoints never shown; destinations shown when visited
          const visible = !loc.isWaypoint && index <= currentSegmentIndex;
          marker.getElement().style.display = visible ? "flex" : "none";
        }
      });
    } else {
      // Idle: show all destinations (not waypoints)
      locations.forEach((loc) => {
        const marker = markersRef.current.get(loc.id);
        if (marker) {
          marker.getElement().style.display = loc.isWaypoint ? "none" : "flex";
        }
      });
    }
  }, [playbackState, currentSegmentIndex, locations]);

  // Sync segment route layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const ensureStyleLoaded = () => {
      if (!map.isStyleLoaded()) return;

      // Remove stale layers/sources
      const activeIds = new Set(segments.map((s) => s.id));
      for (const layerId of segmentLayersRef.current) {
        const segId = layerId
          .replace(SEGMENT_GLOW_LAYER_PREFIX, "")
          .replace(SEGMENT_LAYER_PREFIX, "");
        if (!activeIds.has(segId)) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + segId;
          if (map.getLayer(glowLayerId)) map.removeLayer(glowLayerId);
          const srcId = SEGMENT_SOURCE_PREFIX + segId;
          if (map.getSource(srcId)) map.removeSource(srcId);
          segmentLayersRef.current.delete(layerId);
        }
      }

      // Add/update segment layers
      for (const seg of segments) {
        const srcId = SEGMENT_SOURCE_PREFIX + seg.id;
        const layerId = SEGMENT_LAYER_PREFIX + seg.id;
        const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
        const lineStyle = MODE_LINE_STYLES[seg.transportMode];

        if (map.getSource(srcId)) {
          // Source exists — update geometry + paint properties
          setSegmentSourceData(map, seg.id, seg.geometry);
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-color", lineStyle.color);
            map.setPaintProperty(
              layerId,
              "line-dasharray",
              lineStyle.dasharray || [1, 0]
            );
          }
        } else {
          map.addSource(srcId, {
            type: "geojson",
            data: getEmptyRouteData(),
          });
          // Glow layer (wider, blurred underneath) — start HIDDEN
          map.addLayer({
            id: glowLayerId,
            type: "line",
            source: srcId,
            layout: { visibility: "none" },
            paint: {
              "line-color": lineStyle.color,
              "line-width": 10,
              "line-opacity": 0.2,
              "line-blur": 6,
              "line-dasharray": lineStyle.dasharray || [1, 0],
            },
          });
          // Main crisp line on top — start HIDDEN
          map.addLayer({
            id: layerId,
            type: "line",
            source: srcId,
            layout: { visibility: "none" },
            paint: {
              "line-color": lineStyle.color,
              "line-width": 4,
              "line-dasharray": lineStyle.dasharray || [1, 0],
            },
          });
          segmentLayersRef.current.add(layerId);
        }
      }
    };

    const runSyncAndVis = () => {
      ensureStyleLoaded();
      const ps = useAnimationStore.getState().playbackState;
      const csi = useAnimationStore.getState().currentSegmentIndex;
      if (ps === "playing" || ps === "paused") {
        const gsIndices = new Set(useAnimationStore.getState().currentGroupSegmentIndices);
        const firstGIdx = gsIndices.size > 0
          ? Math.min(...gsIndices)
          : csi;
        segments.forEach((seg, idx) => {
          const lid = SEGMENT_LAYER_PREFIX + seg.id;
          const glid = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
          if (gsIndices.has(idx)) {
            // Current group: visible but source managed by routeDrawProgress
            if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", "visible");
            if (map.getLayer(glid)) map.setLayoutProperty(glid, "visibility", "visible");
          } else if (idx < firstGIdx) {
            if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", "visible");
            if (map.getLayer(glid)) map.setLayoutProperty(glid, "visibility", "visible");
          } else {
            if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", "none");
            if (map.getLayer(glid)) map.setLayoutProperty(glid, "visibility", "none");
            setSegmentSourceData(map, seg.id, seg.geometry, 0);
          }
        });
      } else {
        // Idle (or exporting): show all segments with full geometry.
        // This is critical because the visibility useEffect may have already
        // run and bailed out (isStyleLoaded was false), and won't re-run
        // since its deps haven't changed.
        segments.forEach((seg) => {
          const lid = SEGMENT_LAYER_PREFIX + seg.id;
          const glid = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
          if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", "visible");
          if (map.getLayer(glid)) map.setLayoutProperty(glid, "visibility", "visible");
          setSegmentSourceData(map, seg.id, seg.geometry);
        });
      }
    };

    if (map.isStyleLoaded()) {
      runSyncAndVis();
    } else {
      map.once("style.load", runSyncAndVis);
    }

    // Safety net: re-apply visibility after a short delay to handle race
    // conditions where style.load already fired before the once() listener
    // was registered, or sources weren't ready yet.
    const safetyTimer = setTimeout(() => {
      if (map.isStyleLoaded()) runSyncAndVis();
    }, 500);

    return () => clearTimeout(safetyTimer);
  }, [segments]);

  // Track previous segment index to detect transitions and clear source data
  // only when the current segment actually changes (not on pause/resume).
  const prevSegmentIndexRef = useRef<number>(-1);

  // Route visibility during playback:
  // - Past segments (index < currentSegmentIndex): VISIBLE with full geometry
  // - Current segment: VISIBLE, source managed by routeDrawProgress
  // - Future segments (index > currentSegmentIndex): HIDDEN
  // On idle: show all and restore full geometries
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const applyVisibility = () => {
      if (!map.isStyleLoaded()) return;

      if (playbackState === "playing" || playbackState === "paused") {
        const segmentChanged = currentSegmentIndex !== prevSegmentIndexRef.current;
        const groupIndicesSet = new Set(currentGroupSegmentIndices);
        const firstGroupIdx = currentGroupSegmentIndices.length > 0
          ? currentGroupSegmentIndices[0]
          : currentSegmentIndex;

        segments.forEach((seg, i) => {
          const layerId = SEGMENT_LAYER_PREFIX + seg.id;
          const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;

          if (groupIndicesSet.has(i)) {
            // Segments in the current group: visibility managed by routeDrawProgress handler
            // Just ensure layers are visible; source data is set by routeDrawProgress
            if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "visible");
            if (map.getLayer(glowLayerId)) map.setLayoutProperty(glowLayerId, "visibility", "visible");
            if (segmentChanged) {
              setSegmentSourceData(map, seg.id, seg.geometry, 0);
            }
          } else if (i < firstGroupIdx) {
            // Past segments (before the current group): fully drawn
            if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "visible");
            if (map.getLayer(glowLayerId)) map.setLayoutProperty(glowLayerId, "visibility", "visible");
            setSegmentSourceData(map, seg.id, seg.geometry);
          } else {
            // Future segments (after the current group): hidden
            if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
            if (map.getLayer(glowLayerId)) map.setLayoutProperty(glowLayerId, "visibility", "none");
          }
        });

        prevSegmentIndexRef.current = currentSegmentIndex;
      } else {
        // idle: show all segments with full geometry
        segments.forEach((seg) => {
          const layerId = SEGMENT_LAYER_PREFIX + seg.id;
          const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "visible");
          if (map.getLayer(glowLayerId)) map.setLayoutProperty(glowLayerId, "visibility", "visible");
          setSegmentSourceData(map, seg.id, seg.geometry);
        });
        prevSegmentIndexRef.current = -1;
      }
    };

    if (map.isStyleLoaded()) {
      applyVisibility();
    } else {
      // Style not loaded yet — defer until it is. This handles the race
      // where segments arrive before the map style finishes loading.
      map.once("style.load", applyVisibility);
      return () => {
        map.off("style.load", applyVisibility);
      };
    }
  }, [playbackState, currentSegmentIndex, currentGroupSegmentIndices, segments]);

  // Sync map style — re-add layers after style change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const styleUrl = MAP_STYLES[mapStyle];
    map.setStyle(styleUrl);

    map.once("style.load", () => {
      // Apply runtime paint overrides for custom styles
      applyStyleOverrides(map, mapStyle);

      segmentLayersRef.current.clear();

      // Re-add segment layers
      const currentSegments = useProjectStore.getState().segments;
      for (const seg of currentSegments) {
        const srcId = SEGMENT_SOURCE_PREFIX + seg.id;
        const layerId = SEGMENT_LAYER_PREFIX + seg.id;
        const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
        const lineStyle = MODE_LINE_STYLES[seg.transportMode];

        if (map.getSource(srcId)) {
          // Source already exists (race condition) — just update data
          setSegmentSourceData(map, seg.id, seg.geometry);
          segmentLayersRef.current.add(layerId);
          continue;
        }
        map.addSource(srcId, {
          type: "geojson",
          data: getEmptyRouteData(),
        });
        setSegmentSourceData(map, seg.id, seg.geometry);
        map.addLayer({
          id: glowLayerId,
          type: "line",
          source: srcId,
          paint: {
            "line-color": lineStyle.color,
            "line-width": 10,
            "line-opacity": 0.2,
            "line-blur": 6,
            "line-dasharray": lineStyle.dasharray || [1, 0],
          },
        });
        map.addLayer({
          id: layerId,
          type: "line",
          source: srcId,
          paint: {
            "line-color": lineStyle.color,
            "line-width": 4,
            "line-dasharray": lineStyle.dasharray || [1, 0],
          },
        });
        segmentLayersRef.current.add(layerId);
      }
    });
  }, [mapStyle]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <AnimatePresence>
        {!mapLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-200"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
