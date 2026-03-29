"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

export default function PhotoOverlay({ photos, visible, photoLayout, opacity = 1 }: PhotoOverlayProps) {
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

  // Use actual container dimensions for layout calculation
  const containerAspect = containerSize.h > 0 ? containerSize.w / containerSize.h : 16 / 9;
  const gapPx = photoLayout?.gap ?? 8;
  const borderRadiusPx = photoLayout?.borderRadius ?? 8;

  // Apply custom photo order if set
  const orderedMetas: PhotoMeta[] = (() => {
    if (!ready) return [];
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

  const layoutMetas: LayoutPhotoMeta[] = ready
    ? orderedMetas.map((m) => ({ id: m.id, aspect: m.aspect }))
    : [];

  const rects = (() => {
    if (!ready) return [];
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
        visibility: visible && ready ? "visible" : "hidden",
      }}
    >
      <AnimatePresence>
        {visible && ready &&
          rects.map((rect, i) => {
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
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={{
                  hidden: { opacity: 0, scale: 0.6, y: 60, filter: "blur(8px)" },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      delay: i * 0.08,
                    },
                  },
                  exit: {
                    opacity: 0,
                    scale: 0.5,
                    y: -80,
                    filter: "blur(6px)",
                    rotate: i % 2 === 0 ? -8 : 8,
                    transition: {
                      duration: 0.45,
                      ease: [0.4, 0, 1, 1],
                      delay: (n - 1 - i) * 0.06,
                    },
                  },
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
      </AnimatePresence>
    </div>
  );
}
