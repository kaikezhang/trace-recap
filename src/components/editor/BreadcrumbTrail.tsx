"use client";

import { useEffect, useRef } from "react";
import { useMap } from "./MapContext";
import { useAnimationStore } from "@/stores/animationStore";
import { useUIStore } from "@/stores/uiStore";
import type { Breadcrumb } from "@/stores/animationStore";

const BREADCRUMB_SIZE = 32;
const BORDER_WIDTH = 2;

export const BREADCRUMB_SOURCE_ID = "breadcrumb-src";
export const BREADCRUMB_LAYER_ID = "breadcrumb-lyr";
const ANIMATION_DURATION_MS = 300;

export function getBreadcrumbImageId(locationId: string): string {
  return `bc-img-${locationId}`;
}

function findFirstRouteLayerId(map: mapboxgl.Map): string | undefined {
  const style = map.getStyle();
  if (!style?.layers) return undefined;
  for (const layer of style.layers) {
    if (
      layer.id.startsWith("segment-glow-") ||
      layer.id.startsWith("segment-")
    ) {
      return layer.id;
    }
  }
  return undefined;
}

async function createCircularBreadcrumbImage(
  photoUrl: string,
  size: number,
  borderWidth: number,
): Promise<ImageData> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = photoUrl;
  });

  const totalPx = size + borderWidth * 2;
  const canvas = document.createElement("canvas");
  canvas.width = totalPx;
  canvas.height = totalPx;
  const ctx = canvas.getContext("2d")!;
  const center = totalPx / 2;
  const radius = size / 2;

  // White border circle
  ctx.beginPath();
  ctx.arc(center, center, radius + borderWidth, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Clip to inner circle for photo
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw photo with object-fit: cover
  const imgAspect = img.naturalWidth / img.naturalHeight;
  let sw = size;
  let sh = size;
  let sx = borderWidth;
  let sy = borderWidth;
  if (imgAspect > 1) {
    sw = size * imgAspect;
    sx = (totalPx - sw) / 2;
  } else {
    sh = size / imgAspect;
    sy = (totalPx - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh);
  ctx.restore();

  return ctx.getImageData(0, 0, totalPx, totalPx);
}

/**
 * Create a circular breadcrumb image from an already-loaded HTMLImageElement.
 * Used by VideoExporter to avoid re-fetching photos.
 */
export function createCircularImageFromElement(
  imgEl: HTMLImageElement,
  imgAspect: number,
  size: number,
  borderWidth: number,
): ImageData {
  const totalPx = size + borderWidth * 2;
  const canvas = document.createElement("canvas");
  canvas.width = totalPx;
  canvas.height = totalPx;
  const ctx = canvas.getContext("2d")!;
  const center = totalPx / 2;
  const radius = size / 2;

  // White border circle
  ctx.beginPath();
  ctx.arc(center, center, radius + borderWidth, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Clip to inner circle for photo
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw photo with object-fit: cover
  let sw = size;
  let sh = size;
  let sx = borderWidth;
  let sy = borderWidth;
  if (imgAspect > 1) {
    sw = size * imgAspect;
    sx = (totalPx - sw) / 2;
  } else {
    sh = size / imgAspect;
    sy = (totalPx - sh) / 2;
  }
  ctx.drawImage(imgEl, sx, sy, sw, sh);
  ctx.restore();

  return ctx.getImageData(0, 0, totalPx, totalPx);
}

function updateSource(
  source: mapboxgl.GeoJSONSource,
  breadcrumbs: Breadcrumb[],
  enabled: boolean,
  animProgress: number,
): void {
  if (!enabled || breadcrumbs.length === 0) {
    source.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  const features: GeoJSON.Feature<GeoJSON.Point>[] = breadcrumbs.map(
    (bc, i) => {
      const isNewest = i === breadcrumbs.length - 1;
      const settledOpacity = isNewest ? 0.8 : 0.7;

      let scale = 1;
      let opacity = settledOpacity;

      if (isNewest && animProgress < 1) {
        scale = 2 - animProgress; // 2 → 1
        opacity = 1 - animProgress * (1 - settledOpacity); // 1 → settled
      }

      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: bc.coordinates,
        },
        properties: {
          imageId: getBreadcrumbImageId(bc.locationId),
          scale,
          opacity,
        },
      };
    },
  );

  source.setData({ type: "FeatureCollection", features });
}

export default function BreadcrumbTrail() {
  const { map } = useMap();
  const breadcrumbs = useAnimationStore((s) => s.breadcrumbs);
  const playbackState = useAnimationStore((s) => s.playbackState);
  const breadcrumbsEnabled = useUIStore((s) => s.breadcrumbsEnabled);
  const addedImagesRef = useRef<Set<string>>(new Set());
  const prevLengthRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Initialize source and layer
  useEffect(() => {
    if (!map) return;

    const setup = () => {
      if (!map.getSource(BREADCRUMB_SOURCE_ID)) {
        map.addSource(BREADCRUMB_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer(BREADCRUMB_LAYER_ID)) {
        const beforeId = findFirstRouteLayerId(map);
        map.addLayer(
          {
            id: BREADCRUMB_LAYER_ID,
            type: "symbol",
            source: BREADCRUMB_SOURCE_ID,
            layout: {
              "icon-image": ["get", "imageId"],
              "icon-size": ["get", "scale"],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
            paint: {
              "icon-opacity": ["get", "opacity"],
            },
          },
          beforeId,
        );
      }
    };

    if (map.isStyleLoaded()) {
      setup();
    }
    map.on("style.load", setup);

    return () => {
      map.off("style.load", setup);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (map.getLayer(BREADCRUMB_LAYER_ID)) map.removeLayer(BREADCRUMB_LAYER_ID);
      if (map.getSource(BREADCRUMB_SOURCE_ID)) {
        map.removeSource(BREADCRUMB_SOURCE_ID);
      }
      addedImagesRef.current.forEach((id) => {
        if (map.hasImage(id)) map.removeImage(id);
      });
      addedImagesRef.current.clear();
    };
  }, [map]);

  // Update source when breadcrumbs change
  useEffect(() => {
    if (!map || playbackState === "exporting") return;

    const source = map.getSource(BREADCRUMB_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;

    // Ensure layer is below route layers
    if (map.getLayer(BREADCRUMB_LAYER_ID)) {
      const beforeId = findFirstRouteLayerId(map);
      if (beforeId) {
        try {
          map.moveLayer(BREADCRUMB_LAYER_ID, beforeId);
        } catch {
          /* layer might already be in correct position */
        }
      }
    }

    if (!breadcrumbsEnabled || breadcrumbs.length === 0) {
      source.setData({ type: "FeatureCollection", features: [] });
      prevLengthRef.current = 0;
      return;
    }

    const isNewCrumb = breadcrumbs.length > prevLengthRef.current;
    prevLengthRef.current = breadcrumbs.length;

    // Load images for any new breadcrumbs, then update source
    const loadAndUpdate = async () => {
      for (const bc of breadcrumbs) {
        const imgId = getBreadcrumbImageId(bc.locationId);
        if (!addedImagesRef.current.has(imgId) && !map.hasImage(imgId)) {
          try {
            const imageData = await createCircularBreadcrumbImage(
              bc.heroPhotoUrl,
              BREADCRUMB_SIZE * 2, // 2x for retina
              BORDER_WIDTH * 2,
            );
            if (!map.hasImage(imgId)) {
              map.addImage(imgId, imageData, { pixelRatio: 2 });
            }
            addedImagesRef.current.add(imgId);
          } catch (e) {
            console.warn("Failed to load breadcrumb image:", e);
            continue;
          }
        }
      }

      // Animate new breadcrumb pop-in
      if (isNewCrumb) {
        const startTime = performance.now();
        const animate = () => {
          const elapsed = performance.now() - startTime;
          const t = Math.min(1, elapsed / ANIMATION_DURATION_MS);
          // Cubic ease-out
          const ease = 1 - Math.pow(1 - t, 3);

          updateSource(source, breadcrumbs, breadcrumbsEnabled, ease);

          if (t < 1) {
            animFrameRef.current = requestAnimationFrame(animate);
          } else {
            animFrameRef.current = null;
          }
        };

        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
        }
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        updateSource(source, breadcrumbs, breadcrumbsEnabled, 1);
      }
    };

    loadAndUpdate();
  }, [map, breadcrumbs, breadcrumbsEnabled, playbackState]);

  // No DOM rendering — breadcrumbs are Mapbox layers
  return null;
}
