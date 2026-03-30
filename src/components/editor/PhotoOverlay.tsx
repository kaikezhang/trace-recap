"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import type { PhotoMeta as LayoutPhotoMeta } from "@/lib/photoLayout";
import type { Photo, PhotoLayout } from "@/types";
import { useUIStore } from "@/stores/uiStore";


interface PhotoOverlayProps {
  photos: Photo[];
  visible: boolean;
  photoLayout?: PhotoLayout;
  opacity?: number; // 0-1, for fade-out transition
  containerMode?: "viewport" | "parent"; // 'parent' uses 100% sizing instead of vw/vh
}

interface PhotoMeta extends Photo {
  aspect: number; // w/h, >1 landscape, <1 portrait
}

function usePhotoDimensions(photos: Photo[]): PhotoMeta[] {
  const aspectCacheRef = useRef(new Map<string, number>());
  const photoKey = photos
    .map((photo) => `${photo.id}:${photo.url}:${photo.caption ?? ""}:${photo.focalPoint?.x ?? ""}:${photo.focalPoint?.y ?? ""}`)
    .join("|");
  const buildMetas = () =>
    photos.map((photo) => ({
      ...photo,
      aspect: aspectCacheRef.current.get(photo.url) ?? 4 / 3,
    }));
  const [dims, setDims] = useState<PhotoMeta[]>(() => buildMetas());

  useEffect(() => {
    setDims(buildMetas());
    if (photos.length === 0) {
      return;
    }

    let cancelled = false;
    photos.forEach((photo) => {
      if (aspectCacheRef.current.has(photo.url)) {
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        aspectCacheRef.current.set(photo.url, img.naturalWidth / img.naturalHeight);
        setDims(buildMetas());
      };
      img.onerror = () => {
        if (cancelled) return;
        aspectCacheRef.current.set(photo.url, 4 / 3);
        setDims(buildMetas());
      };
      img.src = photo.url;
    });
    return () => {
      cancelled = true;
    };
  }, [photoKey]);

  return dims;
}

export default function PhotoOverlay({ photos, visible, photoLayout, opacity = 1, containerMode = "viewport" }: PhotoOverlayProps) {
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const metas = usePhotoDimensions(photos);
  const hasPhotos = metas.length > 0;

  // Keep a snapshot of the last visible state so photos persist during exit transition
  const lastVisibleRef = useRef<{ metas: PhotoMeta[]; layout?: PhotoLayout }>({ metas: [], layout: undefined });
  if (visible && hasPhotos) {
    lastVisibleRef.current = { metas, layout: photoLayout };
  }
  // Use snapshot when transitioning out (visible=false but we still want to show photos fading)
  const displayMetas = visible && hasPhotos ? metas : lastVisibleRef.current.metas;
  const displayLayout = visible && hasPhotos ? photoLayout : lastVisibleRef.current.layout;
  const hasDisplayPhotos = displayMetas.length > 0;
  // When a fixed ratio is set, the parent map container already has that aspect ratio,
  // so we use percentage-based sizing to stay within bounds. For "free", keep vw/vh.
  const containerStyle = useMemo(() => {
    if (containerMode === "parent") {
      return { width: "100%", height: "100%" };
    }
    if (viewportRatio === "free") {
      return { width: "95vw", height: "88vh" };
    }
    return { width: "95%", height: "88%" };
  }, [viewportRatio, containerMode]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Use actual container dimensions for layout calculation
  const containerAspect = containerSize.h > 0 ? containerSize.w / containerSize.h : 16 / 9;
  const gapPx = displayLayout?.gap ?? 8;
  const borderRadiusPx = displayLayout?.borderRadius ?? 8;

  // Apply custom photo order if set
  const orderedMetas: PhotoMeta[] = (() => {
    if (!hasDisplayPhotos) return [];
    if (displayLayout?.order && displayLayout.order.length > 0) {
      const metaMap = new Map(displayMetas.map((m) => [m.id, m]));
      const ordered = displayLayout.order
        .map((id) => metaMap.get(id))
        .filter((m): m is PhotoMeta => !!m);
      // Add any photos not in order
      for (const m of displayMetas) {
        if (!ordered.find((o) => o.id === m.id)) ordered.push(m);
      }
      return ordered;
    }
    return displayMetas;
  })();

  const layoutMetas: LayoutPhotoMeta[] = hasDisplayPhotos
    ? orderedMetas.map((m) => ({ id: m.id, aspect: m.aspect }))
    : [];

  const rects = (() => {
    if (!hasDisplayPhotos) return [];
    const w = containerSize.w || 1000;
    if (displayLayout?.mode === "manual" && displayLayout.template) {
      return computeTemplateLayout(
        layoutMetas,
        containerAspect,
        displayLayout.template,
        gapPx,
        w,
        displayLayout.customProportions
      );
    }
    return computeAutoLayout(layoutMetas, containerAspect, gapPx, w);
  })();

  // Caption sizing: match export constants (captionFontSize ~14px at 1000px width, plus gap)
  const captionH = 28; // space for caption text + gap below image

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none"
      style={{
        ...containerStyle,
        margin: "auto",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
        {hasDisplayPhotos && rects.map((rect, i) => {
            const photo = orderedMetas[i];
            if (!photo) return null;
            const n = orderedMetas.length;
            const hasCaption = !!photo.caption;
            const pad = 6; // px padding inside frame
            const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };
            const isPolaroid = displayLayout?.template === "polaroid";

            // Use scatter rotation if provided, otherwise default tilts
            const rotation = rect.rotation != null
              ? rect.rotation
              : n <= 3
                ? (i === 0 ? -2 : i === n - 1 ? 2 : 0)
                : (i % 2 === 0 ? -1.5 : 1.5);

            // Per-photo exit: staggered fade based on opacity prop
            // Last photo fades first (reverse stagger)
            const exitProgress = 1 - opacity; // 0 = fully visible, 1 = fully gone
            const staggerOffset = n > 1 ? (n - 1 - i) / (n - 1) * 0.4 : 0;
            const photoExitT = Math.max(0, Math.min(1, (exitProgress - staggerOffset) / (1 - staggerOffset + 0.01)));
            
            const exitOpacity = exitProgress > 0 ? 1 - photoExitT : 1;
            const exitScale = exitProgress > 0 ? 1 - photoExitT * 0.4 : 1; // shrink to 60%
            const exitY = exitProgress > 0 ? -photoExitT * 60 : 0; // float up 60px
            const exitBlur = exitProgress > 0 ? photoExitT * 6 : 0; // blur to 6px
            const exitRotate = exitProgress > 0 ? photoExitT * (i % 2 === 0 ? -12 : 12) : 0;

            return (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.6, y: 60, filter: "blur(8px)" }}
                animate={{ opacity: exitOpacity, scale: exitScale, y: exitY, filter: `blur(${exitBlur}px)`, rotate: exitRotate + rotation }}
                transition={exitProgress > 0
                  ? { duration: 0.15, ease: "easeOut" }
                  : { type: "spring", stiffness: 300, damping: 25, delay: i * 0.08 }
                }
                className="absolute overflow-hidden drop-shadow-xl"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  borderRadius: isPolaroid ? "4px" : `${borderRadiusPx}px`,
                  rotate: rotation,
                  display: "flex",
                  flexDirection: "column" as const,
                  ...(isPolaroid ? {
                    background: "white",
                    padding: "4% 4% 10% 4%",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                  } : {}),
                }}
              >
                <div
                  className="w-full overflow-hidden"
                  style={{ flex: 1, minHeight: 0, borderRadius: `${borderRadiusPx}px` }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || ""}
                    className="w-full h-full object-contain"
                    style={{
                      objectPosition: `${fp.x * 100}% ${fp.y * 100}%`,
                    }}
                  />
                </div>
                {hasCaption && (
                  <p
                    className="text-sm text-gray-700 text-center truncate px-1"
                    style={{ height: `${captionH}px`, lineHeight: `${captionH}px`, flexShrink: 0 }}
                  >
                    {photo.caption}
                  </p>
                )}
              </motion.div>
            );
          })}
      </div>
    </div>
  );
}
