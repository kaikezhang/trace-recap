"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { computeAutoLayout } from "@/lib/photoLayout";
import type { PhotoMeta as LayoutPhotoMeta } from "@/lib/photoLayout";
import type { Photo } from "@/types";

interface PhotoOverlayProps {
  photos: Photo[];
  visible: boolean;
}

interface PhotoMeta extends Photo {
  aspect: number; // w/h, >1 landscape, <1 portrait
}

function usePhotoDimensions(photos: Photo[]): PhotoMeta[] {
  const [dims, setDims] = useState<PhotoMeta[]>([]);
  // Stable dependency: only re-run when photo URLs actually change
  const photoKey = photos.map(p => p.url).join("|");

  useEffect(() => {
    if (photos.length === 0) { setDims([]); return; }
    const results: PhotoMeta[] = [];
    let loaded = 0;
    let cancelled = false;
    photos.forEach((photo, i) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        results[i] = { ...photo, aspect: img.naturalWidth / img.naturalHeight };
        loaded++;
        if (loaded === photos.length) setDims([...results]);
      };
      img.onerror = () => {
        if (cancelled) return;
        results[i] = { ...photo, aspect: 4 / 3 };
        loaded++;
        if (loaded === photos.length) setDims([...results]);
      };
      img.src = photo.url;
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);
  return dims;
}

export default function PhotoOverlay({ photos, visible }: PhotoOverlayProps) {
  const metas = usePhotoDimensions(photos);
  const ready = metas.length === photos.length && photos.length > 0;
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

  const containerAspect = containerSize.h > 0 ? containerSize.w / containerSize.h : 16 / 9;

  const layoutMetas: LayoutPhotoMeta[] = ready
    ? metas.map((m) => ({ id: m.id, aspect: m.aspect }))
    : [];
  const rects = ready
    ? computeAutoLayout(layoutMetas, containerAspect, 8, containerSize.w || 1000)
    : [];

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
        visibility: visible && ready ? "visible" : "hidden",
      }}
    >
      <AnimatePresence>
        {visible && ready &&
          rects.map((rect, i) => {
            const photo = metas[i];
            if (!photo) return null;
            const n = metas.length;
            const hasCaption = !!photo.caption;
            const pad = 6; // px padding inside frame
            return (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.8, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: i * 0.08,
                }}
                className="absolute rounded-xl bg-white shadow-2xl overflow-hidden"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  rotate: n <= 3 ? (i === 0 ? -2 : i === n - 1 ? 2 : 0) : (i % 2 === 0 ? -1.5 : 1.5),
                  padding: `${pad}px`,
                  display: "flex",
                  flexDirection: "column" as const,
                }}
              >
                <div
                  className="w-full rounded-lg overflow-hidden"
                  style={{ flex: 1, minHeight: 0 }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || ""}
                    className="w-full h-full object-cover"
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
      </AnimatePresence>
    </div>
  );
}
