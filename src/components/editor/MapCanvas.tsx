"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMap } from "./MapContext";
import {
  getEmptyRouteData,
  SEGMENT_GLOW_LAYER_PREFIX,
  SEGMENT_LAYER_PREFIX,
  SEGMENT_SOURCE_PREFIX,
  setSegmentSourceData,
} from "./routeSegmentSources";
import { useProjectStore } from "@/stores/projectStore";
import { useLocationsForMap, usePhotoFingerprint } from "@/stores/selectors";
import { useAnimationStore } from "@/stores/animationStore";
import { useUIStore } from "@/stores/uiStore";
import { MAPBOX_TOKEN, getDefaultMapOptions, applyStyleOverrides } from "@/lib/mapbox";
import { MAP_STYLES } from "@/lib/constants";
import { extractDominantColor } from "@/lib/colorExtract";
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

const FALLBACK_MAP_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

/** Resolve the line color for a segment, considering mood colors */
function getSegmentColor(
  segIndex: number,
  transportMode: TransportMode,
  segmentColors: Record<number, string>,
  moodColorsEnabled: boolean
): string {
  if (moodColorsEnabled && segmentColors[segIndex]) {
    return segmentColors[segIndex];
  }
  return MODE_LINE_STYLES[transportMode].color;
}

export default memo(function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const segmentLayersRef = useRef<Set<string>>(new Set());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lng: number;
    lat: number;
  } | null>(null);
  const { setMap } = useMap();
  const addLocationAtCoordinates = useProjectStore((s) => s.addLocationAtCoordinates);
  const locations = useLocationsForMap();
  const segments = useProjectStore((s) => s.segments);
  const segmentColors = useProjectStore((s) => s.segmentColors);
  const setSegmentColor = useProjectStore((s) => s.setSegmentColor);
  const mapStyle = useProjectStore((s) => s.mapStyle);
  const moodColorsEnabled = useUIStore((s) => s.moodColorsEnabled);
  const addToast = useUIStore((s) => s.addToast);
  const photoFingerprint = usePhotoFingerprint();
  const playbackState = useAnimationStore((s) => s.playbackState);
  const currentSegmentIndex = useAnimationStore((s) => s.currentSegmentIndex);
  const currentGroupSegmentIndices = useAnimationStore((s) => s.currentGroupSegmentIndices);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const opts = getDefaultMapOptions();
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_TOKEN ? opts.style : FALLBACK_MAP_STYLE,
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
      setContextMenu(null);
      await addLocationAtCoordinates({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [addLocationAtCoordinates]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleContextMenu = (e: mapboxgl.MapMouseEvent & { point: mapboxgl.Point }) => {
      const originalTarget = e.originalEvent.target as HTMLElement | null;
      if (originalTarget?.closest(".mapboxgl-marker")) {
        return;
      }

      e.originalEvent.preventDefault();
      const rect = map.getContainer().getBoundingClientRect();
      setContextMenu({
        x: rect.left + e.point.x,
        y: rect.top + e.point.y,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    };

    map.on("contextmenu", handleContextMenu);
    return () => {
      map.off("contextmenu", handleContextMenu);
    };
  }, []);

  // Auto-extract dominant colors from photos for each segment's destination
  useEffect(() => {
    if (!moodColorsEnabled) return;

    let cancelled = false;
    const allLocations = useProjectStore.getState().locations;
    const allSegments = useProjectStore.getState().segments;
    const currentColors = useProjectStore.getState().segmentColors;

    for (let i = 0; i < allSegments.length; i++) {
      const seg = allSegments[i];
      // Use destination location's photos for this segment's color
      const destLoc = allLocations.find((l) => l.id === seg.toId);
      if (!destLoc || destLoc.photos.length === 0) {
        // Clear color for segments with no photos
        if (currentColors[i]) {
          setSegmentColor(i, "");
        }
        continue;
      }

      const firstPhotoUrl = destLoc.photos[0].url;
      extractDominantColor(firstPhotoUrl).then((color) => {
        if (cancelled) return;
        // Only update if different to avoid unnecessary re-renders
        const current = useProjectStore.getState().segmentColors[i];
        if (current !== color) {
          setSegmentColor(i, color);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [locations, segments, moodColorsEnabled, setSegmentColor, photoFingerprint]);

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
        el.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        marker = new mapboxgl.Marker({ element: el })
          .setLngLat(loc.coordinates)
          .addTo(map);
        markersRef.current.set(loc.id, marker);
      }
      marker.getElement().textContent = String(index + 1);
    });
  }, [locations]);

  // Marker visibility during playback:
  // Playing/Paused: hide all numbered markers (photo-based chapter pins handle display)
  // Idle: show all markers (for editing)
  useEffect(() => {
    if (playbackState === "playing" || playbackState === "paused") {
      locations.forEach((loc) => {
        const marker = markersRef.current.get(loc.id);
        if (marker) {
          marker.getElement().style.display = "none";
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
  }, [playbackState, locations]);

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
      for (let idx = 0; idx < segments.length; idx++) {
        const seg = segments[idx];
        const srcId = SEGMENT_SOURCE_PREFIX + seg.id;
        const layerId = SEGMENT_LAYER_PREFIX + seg.id;
        const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
        const lineStyle = MODE_LINE_STYLES[seg.transportMode];
        const color = getSegmentColor(idx, seg.transportMode, segmentColors, moodColorsEnabled);

        if (map.getSource(srcId)) {
          // Source exists — update geometry + paint properties
          setSegmentSourceData(map, seg.id, seg.geometry);
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-color", color);
            map.setPaintProperty(
              layerId,
              "line-dasharray",
              lineStyle.dasharray || [1, 0]
            );
          }
          if (map.getLayer(glowLayerId)) {
            map.setPaintProperty(glowLayerId, "line-color", color);
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
              "line-color": color,
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
              "line-color": color,
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
  }, [segments, segmentColors, moodColorsEnabled]);

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

    if (!MAPBOX_TOKEN) {
      return;
    }

    const styleUrl = MAP_STYLES[mapStyle];
    map.setStyle(styleUrl);

    map.once("style.load", () => {
      // Apply runtime paint overrides for custom styles
      applyStyleOverrides(map, mapStyle);

      segmentLayersRef.current.clear();

      // Re-add segment layers
      const currentSegments = useProjectStore.getState().segments;
      const currentSegColors = useProjectStore.getState().segmentColors;
      const moodEnabled = useUIStore.getState().moodColorsEnabled;
      for (let idx = 0; idx < currentSegments.length; idx++) {
        const seg = currentSegments[idx];
        const srcId = SEGMENT_SOURCE_PREFIX + seg.id;
        const layerId = SEGMENT_LAYER_PREFIX + seg.id;
        const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
        const lineStyle = MODE_LINE_STYLES[seg.transportMode];
        const color = getSegmentColor(idx, seg.transportMode, currentSegColors, moodEnabled);

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
            "line-color": color,
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
            "line-color": color,
            "line-width": 4,
            "line-dasharray": lineStyle.dasharray || [1, 0],
          },
        });
        segmentLayersRef.current.add(layerId);
      }
    });
  }, [mapStyle]);

  // Apply mood colors to existing layers when segmentColors or moodColorsEnabled change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    segments.forEach((seg, idx) => {
      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      const color = getSegmentColor(idx, seg.transportMode, segmentColors, moodColorsEnabled);

      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "line-color", color);
      }
      if (map.getLayer(glowLayerId)) {
        map.setPaintProperty(glowLayerId, "line-color", color);
      }
    });
  }, [segmentColors, moodColorsEnabled, segments]);

  const citySearchInput = typeof document !== "undefined"
    ? document.querySelector<HTMLInputElement>('[data-city-search-input="true"]')
    : null;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="h-full w-full" />
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
      <DropdownMenu
        open={Boolean(contextMenu)}
        onOpenChange={(open) => {
          if (!open) {
            setContextMenu(null);
          }
        }}
      >
        <DropdownMenuTrigger
          render={(
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none fixed h-0 w-0 opacity-0"
              style={{
                left: contextMenu?.x ?? 0,
                top: contextMenu?.y ?? 0,
              }}
            />
          )}
        />
        <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="w-44">
          <DropdownMenuItem
            disabled={!contextMenu}
            onClick={async () => {
              if (!contextMenu) return;
              await addLocationAtCoordinates({
                lng: contextMenu.lng,
                lat: contextMenu.lat,
              });
              setContextMenu(null);
            }}
          >
            Add Stop Here
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!contextMenu}
            onClick={async () => {
              if (!contextMenu) return;
              await addLocationAtCoordinates(
                {
                  lng: contextMenu.lng,
                  lat: contextMenu.lat,
                },
                { isWaypoint: true },
              );
              if (locations.length < 2) {
                addToast({
                  title: "Added as a regular stop",
                  description: "Waypoints need both a start and end destination.",
                  variant: "info",
                });
              }
              setContextMenu(null);
            }}
          >
            Add as Waypoint
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              citySearchInput?.focus();
              setContextMenu(null);
            }}
          >
            Search Nearby
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
