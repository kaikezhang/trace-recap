"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, type Transition, type TargetAndTransition } from "framer-motion";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import { resolvePhotoAnimations } from "@/lib/photoAnimation";
import type { PhotoMeta as LayoutPhotoMeta } from "@/lib/photoLayout";
import type { Photo, PhotoLayout, PhotoAnimation } from "@/types";
import { useUIStore } from "@/stores/uiStore";

/** Compute framer-motion initial/animate values for a given animation style */
function getEnterAnimation(
  style: PhotoAnimation,
  index: number,
  total: number,
): { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition } {
  switch (style) {
    case "none":
      return { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } };
    case "fade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.5, delay: index * 0.1, ease: "easeOut" as const },
      };
    case "slide":
      return {
        initial: { opacity: 0, x: index % 2 === 0 ? -80 : 80 },
        animate: { opacity: 1, x: 0 },
        transition: { type: "spring", stiffness: 200, damping: 25, delay: index * 0.08 },
      };
    case "flip":
      return {
        initial: { opacity: 0, rotateY: 90 },
        animate: { opacity: 1, rotateY: 0 },
        transition: { duration: 0.6, delay: index * 0.1, ease: "easeOut" as const },
      };
    case "scatter": {
      const angle = (index / Math.max(total, 1)) * 2 * Math.PI;
      const dist = 200;
      return {
        initial: {
          opacity: 0,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotate: (index % 2 === 0 ? -30 : 30),
          scale: 0.4,
        },
        animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
        transition: { type: "spring", stiffness: 150, damping: 20, delay: index * 0.06 },
      };
    }
    case "typewriter":
      return {
        initial: { opacity: 0, scale: 0.8, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 0.3, delay: index * 0.2, ease: "easeOut" as const },
      };
    case "scale":
    default:
      return {
        initial: { opacity: 0, scale: 0.6, y: 60, filter: "blur(8px)" },
        animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
        transition: { type: "spring", stiffness: 300, damping: 25, delay: index * 0.08 },
      };
  }
}

/** Compute exit transform values for a given animation style */
function getExitValues(
  style: PhotoAnimation,
  exitProgress: number,
  photoExitT: number,
  index: number,
) {
  if (exitProgress <= 0) {
    return { exitOpacity: 1, exitScale: 1, exitX: 0, exitY: 0, exitBlur: 0, exitRotate: 0, exitRotateY: 0 };
  }
  switch (style) {
    case "none":
      return {
        exitOpacity: 1 - exitProgress,
        exitScale: 1, exitX: 0, exitY: 0, exitBlur: 0, exitRotate: 0, exitRotateY: 0,
      };
    case "fade":
      return {
        exitOpacity: 1 - photoExitT,
        exitScale: 1, exitX: 0, exitY: 0, exitBlur: 0, exitRotate: 0, exitRotateY: 0,
      };
    case "slide":
      return {
        exitOpacity: 1 - photoExitT,
        exitScale: 1,
        exitX: (index % 2 === 0 ? -1 : 1) * photoExitT * 120,
        exitY: 0, exitBlur: 0, exitRotate: 0, exitRotateY: 0,
      };
    case "flip":
      return {
        exitOpacity: 1 - photoExitT * 0.8,
        exitScale: 1, exitX: 0, exitY: 0, exitBlur: 0, exitRotate: 0,
        exitRotateY: photoExitT * -90,
      };
    case "scatter": {
      const angle = (index / 4) * 2 * Math.PI;
      const dist = 200;
      return {
        exitOpacity: 1 - photoExitT,
        exitScale: 1 - photoExitT * 0.5,
        exitX: Math.cos(angle) * dist * photoExitT,
        exitY: Math.sin(angle) * dist * photoExitT,
        exitBlur: photoExitT * 4,
        exitRotate: (index % 2 === 0 ? -25 : 25) * photoExitT,
        exitRotateY: 0,
      };
    }
    case "typewriter":
      return {
        exitOpacity: 1 - photoExitT,
        exitScale: 1 - photoExitT * 0.2,
        exitX: 0, exitY: photoExitT * -30,
        exitBlur: 0, exitRotate: 0, exitRotateY: 0,
      };
    case "scale":
    default:
      return {
        exitOpacity: 1 - photoExitT,
        exitScale: 1 - photoExitT * 0.4,
        exitX: 0,
        exitY: -photoExitT * 60,
        exitBlur: photoExitT * 6,
        exitRotate: photoExitT * (index % 2 === 0 ? -12 : 12),
        exitRotateY: 0,
      };
  }
}


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
  const photoAnimation = useUIStore((s) => s.photoAnimation);
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
  const { enterAnimation, exitAnimation } = resolvePhotoAnimations(displayLayout, photoAnimation);
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
        displayLayout.customProportions,
        displayLayout.layoutSeed
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

            const enter = getEnterAnimation(enterAnimation, i, n);
            const exit = getExitValues(exitAnimation, exitProgress, photoExitT, i);

            const enterRotate = typeof (enter.animate as { rotate?: number }).rotate === "number"
              ? (enter.animate as { rotate?: number }).rotate! + rotation
              : rotation;
            const animateValues: TargetAndTransition = exitProgress > 0
              ? {
                  opacity: exit.exitOpacity,
                  scale: exit.exitScale,
                  x: exit.exitX,
                  y: exit.exitY,
                  filter: exit.exitBlur > 0 ? `blur(${exit.exitBlur}px)` : undefined,
                  rotate: exit.exitRotate + rotation,
                  rotateY: exit.exitRotateY || undefined,
                }
              : { ...enter.animate, rotate: enterRotate };

            return (
              <motion.div
                key={photo.id}
                initial={enter.initial}
                animate={animateValues}
                transition={exitProgress > 0
                  ? { duration: 0.5, ease: "easeOut" }
                  : enter.transition
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
