"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import type { PhotoMeta as LayoutPhotoMeta } from "@/lib/photoLayout";
import type { Photo, PhotoLayout } from "@/types";


interface PhotoOverlayProps {
  photos: Photo[];
  visible: boolean;
  photoLayout?: PhotoLayout;
  opacity?: number; // 0-1, for fade-out transition
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

export default function PhotoOverlay({ photos, visible, photoLayout, opacity = 1 }: PhotoOverlayProps) {
  const metas = usePhotoDimensions(photos);
  const hasPhotos = metas.length > 0;
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
  const gapPx = photoLayout?.gap ?? 8;
  const borderRadiusPx = photoLayout?.borderRadius ?? 8;

  // Apply custom photo order if set
  const orderedMetas: PhotoMeta[] = (() => {
    if (!hasPhotos) return [];
    if (photoLayout?.order && photoLayout.order.length > 0) {
      const metaMap = new Map(metas.map((m) => [m.id, m]));
      const ordered = photoLayout.order
        .map((id) => metaMap.get(id))
        .filter((m): m is PhotoMeta => !!m);
      // Add any photos not in order
      for (const m of metas) {
        if (!ordered.find((o) => o.id === m.id)) ordered.push(m);
      }
      return ordered;
    }
    return metas;
  })();

  const layoutMetas: LayoutPhotoMeta[] = hasPhotos
    ? orderedMetas.map((m) => ({ id: m.id, aspect: m.aspect }))
    : [];

  const rects = (() => {
    if (!hasPhotos) return [];
    const w = containerSize.w || 1000;
    if (photoLayout?.mode === "manual" && photoLayout.template) {
      return computeTemplateLayout(
        layoutMetas,
        containerAspect,
        photoLayout.template,
        gapPx,
        w,
        photoLayout.customProportions
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
        width: "95vw",
        height: "88vh",
        margin: "auto",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          opacity: visible && hasPhotos ? 1 : 0,
          transform: visible && hasPhotos ? "scale(1) translateY(0)" : "scale(0.7) translateY(-50px)",
          filter: visible && hasPhotos ? "blur(0px)" : "blur(8px)",
          transition: "opacity 0.5s ease-out, transform 0.5s ease-out, filter 0.5s ease-out",
          pointerEvents: "none",
        }}
      >
        {hasPhotos && rects.map((rect, i) => {
            const photo = orderedMetas[i];
            if (!photo) return null;
            const n = orderedMetas.length;
            const hasCaption = !!photo.caption;
            const pad = 6; // px padding inside frame
            const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };

            // Use scatter rotation if provided, otherwise default tilts
            const rotation = rect.rotation != null
              ? rect.rotation
              : n <= 3
                ? (i === 0 ? -2 : i === n - 1 ? 2 : 0)
                : (i % 2 === 0 ? -1.5 : 1.5);

            return (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.6, y: 60, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: i * 0.08,
                }}
                className="absolute overflow-hidden drop-shadow-xl"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  borderRadius: `${borderRadiusPx}px`,
                  rotate: rotation,
                  display: "flex",
                  flexDirection: "column" as const,
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
