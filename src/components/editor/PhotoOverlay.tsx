"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, type Transition, type TargetAndTransition } from "framer-motion";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import {
  resolvePhotoAnimations,
  resolvePhotoStyle,
  getKenBurnsTransform,
  KEN_BURNS_DURATION_SEC,
  getBloomTransform,
  getBloomExitTransform,
  BLOOM_ENTER_DURATION_SEC,
  computeBloomFanLayout,
} from "@/lib/photoAnimation";
import { DEFAULT_CAPTION_BG_COLOR } from "@/lib/constants";
import { frameStyleUsesInlineCaption } from "@/lib/frameStyles";
import type { PhotoMeta as LayoutPhotoMeta, PhotoRect } from "@/lib/photoLayout";
import type { FreePhotoTransform, Photo, PhotoLayout, PhotoAnimation, SceneTransition } from "@/types";
import { useUIStore } from "@/stores/uiStore";
import { computeDissolveOpacity, computeBlurDissolve, computeWipeProgress } from "@/lib/sceneTransition";
import { computePortalPhaseProgress } from "@/lib/portalLayout";
import { useAnimationStore } from "@/stores/animationStore";
import PortalPhotoLayer, { useProjectedOrigin, type PortalPhoto } from "./PortalPhotoLayer";
import PhotoFrame from "./PhotoFrame";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getArrivePhaseProgress(
  time: number,
  layoutEntry: { phases: Array<{ phase: string; startTime: number; duration: number }> } | undefined,
): number {
  const arrivePhase = layoutEntry?.phases.find((phase) => phase.phase === "ARRIVE");
  if (!arrivePhase || arrivePhase.duration <= 0) return 0;
  return clamp01((time - arrivePhase.startTime) / arrivePhase.duration);
}

function getFreeTransformMap(layout?: PhotoLayout): Map<string, FreePhotoTransform> {
  return new Map((layout?.mode === "free" ? layout.freeTransforms : undefined)?.map((transform) => [transform.photoId, transform]) ?? []);
}

function getCaptionDisplay(
  photo: Photo,
  transform: FreePhotoTransform | undefined,
  defaultFontFamily: string,
  defaultFontSizePx: number,
  scale: number,
) {
  const text = transform?.caption?.text ?? photo.caption ?? "";
  return {
    text,
    fontFamily: transform?.caption?.fontFamily ?? defaultFontFamily,
    fontSizePx: (transform?.caption?.fontSize ?? defaultFontSizePx / Math.max(scale, 0.0001)) * scale,
    color: transform?.caption?.color ?? "#ffffff",
    bgColor: transform?.caption?.bgColor ?? DEFAULT_CAPTION_BG_COLOR,
    offsetX: transform?.caption?.offsetX ?? 0,
    offsetY: transform?.caption?.offsetY ?? ((transform?.height ?? 0) / 2 + 0.04),
    rotation: transform?.caption?.rotation ?? 0,
  };
}

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

function getFlyToAlbumValues(
  rect: PhotoRect,
  containerSize: { w: number; h: number },
  overlayOffset: { x: number; y: number },
  targetPosition: { x: number; y: number },
  index: number,
) {
  const photoCenterX = (rect.x + rect.width / 2) * containerSize.w;
  const photoCenterY = (rect.y + rect.height / 2) * containerSize.h;
  const targetX = targetPosition.x - overlayOffset.x;
  const targetY = targetPosition.y - overlayOffset.y;

  return {
    exitOpacity: 0,
    exitScale: 0.15,
    exitX: targetX - photoCenterX,
    exitY: targetY - photoCenterY,
    exitBlur: 2,
    exitRotate: index % 2 === 0 ? -8 : 8,
    exitRotateY: 0,
  };
}

interface PhotoOverlayProps {
  photos: Photo[];
  visible: boolean;
  photoLayout?: PhotoLayout;
  opacity?: number; // 0-1, for fade-out transition
  bottomInsetPx?: number;
  containerMode?: "viewport" | "parent"; // 'parent' uses 100% sizing instead of vw/vh
  originCoordinates?: [number, number];
  incomingOriginCoordinates?: [number, number];
  portalAccentColor?: string;
  incomingPortalAccentColor?: string;
  portalProgressOverride?: number;
  /** Bloom origin in raw pixels from map.project() (relative to map container top-left) */
  bloomOrigin?: { x: number; y: number } | null;
  /** Timeline-driven elapsed time (seconds) since bloom enter started */
  bloomElapsedTime?: number;
  /** Current album collection target in screen space */
  flyToPosition?: { x: number; y: number } | null;
  /** Location whose photos are being displayed or collected */
  photoLocationId?: string | null;
  /** Invoked after the fly-to-album animation actually completes */
  onFlyToAlbumComplete?: (locationId: string) => void;
  /** Active scene transition type */
  sceneTransition?: SceneTransition;
  /** Scene transition progress (0-1): 0 = fully outgoing, 1 = fully incoming */
  sceneTransitionProgress?: number;
  /** Photos from the incoming location during a scene transition */
  incomingPhotos?: Photo[];
  /** PhotoLayout of the incoming location during a scene transition */
  incomingPhotoLayout?: PhotoLayout;
  /** Bearing for wipe direction */
  transitionBearing?: number;
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

export default function PhotoOverlay({
  photos,
  visible,
  photoLayout,
  opacity = 1,
  bottomInsetPx = 0,
  containerMode = "viewport",
  originCoordinates,
  portalAccentColor = "#ffffff",
  portalProgressOverride,
  bloomOrigin,
  bloomElapsedTime = 0,
  flyToPosition,
  photoLocationId,
  onFlyToAlbumComplete,
  sceneTransition,
  sceneTransitionProgress,
  incomingPhotos,
  incomingPhotoLayout,
  transitionBearing,
  incomingOriginCoordinates,
  incomingPortalAccentColor = "#ffffff",
}: PhotoOverlayProps) {
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const photoAnimation = useUIStore((s) => s.photoAnimation);
  const globalPhotoStyle = useUIStore((s) => s.photoStyle);
  const photoFrameStyle = useUIStore((s) => s.photoFrameStyle);
  const currentTime = useAnimationStore((s) => s.currentTime);
  const currentSegmentIndex = useAnimationStore((s) => s.currentSegmentIndex);
  const timeline = useAnimationStore((s) => s.timeline);
  const metas = usePhotoDimensions(photos);
  const hasPhotos = metas.length > 0;

  const lastVisibleRef = useRef<{ metas: PhotoMeta[]; layout?: PhotoLayout }>({ metas: [], layout: undefined });
  if (visible && hasPhotos) {
    lastVisibleRef.current = { metas, layout: photoLayout };
  }

  const displayMetas = visible && hasPhotos ? metas : lastVisibleRef.current.metas;
  const displayLayout = visible && hasPhotos ? photoLayout : lastVisibleRef.current.layout;
  const hasDisplayPhotos = displayMetas.length > 0;
  const { enterAnimation, exitAnimation } = resolvePhotoAnimations(displayLayout, photoAnimation);
  const photoStyle = resolvePhotoStyle(displayLayout, globalPhotoStyle);
  const incomingPhotoStyleResolved = resolvePhotoStyle(incomingPhotoLayout, globalPhotoStyle);
  const isActiveTransition = Boolean(
    sceneTransition && sceneTransition !== "cut" && sceneTransitionProgress !== undefined,
  );
  const overlayExitProgress = isActiveTransition ? 0 : 1 - opacity;
  const shouldFlyToAlbum =
    overlayExitProgress > 0 &&
    flyToPosition != null &&
    photoLocationId != null;
  const usesPortalLayout = photoStyle === "portal" || incomingPhotoStyleResolved === "portal";

  const containerStyle = useMemo(() => {
    if (usesPortalLayout) {
      return { width: "100%", height: "100%" };
    }
    if (containerMode === "parent") {
      // Match the same inset as viewport mode for WYSIWYG fidelity
      return { width: "95%", height: "88%" };
    }
    if (viewportRatio === "free") {
      return {
        width: "95%",
        height:
          bottomInsetPx > 0
            ? `min(88%, calc(100% - ${bottomInsetPx}px))`
            : "88%",
      };
    }
    return { width: "95%", height: "88%" };
  }, [bottomInsetPx, viewportRatio, containerMode, usesPortalLayout]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const completedFlyLocationIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!shouldFlyToAlbum) {
      completedFlyLocationIdRef.current = null;
    }
  }, [shouldFlyToAlbum]);

  const handleFlyToAlbumComplete = useCallback(
    (locationId: string) => {
      if (completedFlyLocationIdRef.current === locationId) return;
      completedFlyLocationIdRef.current = locationId;
      onFlyToAlbumComplete?.(locationId);
    },
    [onFlyToAlbumComplete],
  );

  // ── Bloom animation progress (timeline-driven, not wall-clock) ──
  const isBloom = photoStyle === "bloom";
  const bloomProgress = isBloom ? Math.min(1, bloomElapsedTime / BLOOM_ENTER_DURATION_SEC) : 0;

  // Use actual container dimensions for layout calculation
  const containerAspect = containerSize.h > 0 ? containerSize.w / containerSize.h : 16 / 9;
  const gapPx = displayLayout?.gap ?? 8;
  const borderRadiusPx = displayLayout?.borderRadius ?? 8;

  const displayFreeTransformMap = useMemo(
    () => getFreeTransformMap(displayLayout),
    [displayLayout],
  );

  const orderedMetas: PhotoMeta[] = (() => {
    if (!hasDisplayPhotos) return [];
    if (displayLayout?.mode === "free" && displayLayout.freeTransforms && displayLayout.freeTransforms.length > 0) {
      const metaMap = new Map(displayMetas.map((meta) => [meta.id, meta]));
      return [...displayLayout.freeTransforms]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((transform) => metaMap.get(transform.photoId))
        .filter((meta): meta is PhotoMeta => !!meta);
    }
    if (displayLayout?.order && displayLayout.order.length > 0) {
      const metaMap = new Map(displayMetas.map((meta) => [meta.id, meta]));
      const ordered = displayLayout.order
        .map((id) => metaMap.get(id))
        .filter((meta): meta is PhotoMeta => !!meta);
      for (const meta of displayMetas) {
        if (!ordered.find((orderedMeta) => orderedMeta.id === meta.id)) ordered.push(meta);
      }
      return ordered;
    }
    return displayMetas;
  })();

  const layoutMetas: LayoutPhotoMeta[] = hasDisplayPhotos
    ? orderedMetas.map((meta) => ({ id: meta.id, aspect: meta.aspect }))
    : [];

  const rects = (() => {
    if (!hasDisplayPhotos) return [];
    const width = containerSize.w || 1000;
    if (displayLayout?.mode === "free" && displayLayout.freeTransforms?.length) {
      return orderedMetas.reduce<PhotoRect[]>((acc, meta) => {
          const transform = displayFreeTransformMap.get(meta.id);
          if (transform) {
            acc.push({
              x: transform.x,
              y: transform.y,
              width: transform.width,
              height: transform.height,
              rotation: transform.rotation,
            });
          }
          return acc;
        }, []);
    }
    if (displayLayout?.mode === "manual" && displayLayout.template) {
      return computeTemplateLayout(
        layoutMetas,
        containerAspect,
        displayLayout.template,
        gapPx,
        width,
        displayLayout.customProportions,
        displayLayout.layoutSeed,
      );
    }
    return computeAutoLayout(layoutMetas, containerAspect, gapPx, width);
  })();

  // Fix #3: Override with radial fan layout for bloom style
  const bloomFanRects = (() => {
    if (!isBloom || !bloomOrigin || !hasDisplayPhotos || containerSize.w <= 0) return null;
    const overlayOffX = containerRef.current?.offsetLeft ?? 0;
    const overlayOffY = containerRef.current?.offsetTop ?? 0;
    const originFracX = (bloomOrigin.x - overlayOffX) / containerSize.w;
    const originFracY = (bloomOrigin.y - overlayOffY) / containerSize.h;
    return computeBloomFanLayout(
      originFracX,
      originFracY,
      orderedMetas.map((m) => ({ aspect: m.aspect })),
      containerSize.w,
      containerSize.h,
    );
  })();
  // Use fan layout for bloom, standard layout for everything else
  const effectiveRects = bloomFanRects ?? rects;

  // Caption sizing: scale proportionally based on container width (reference: 1000px)
  const captionScale = containerSize.w > 0 ? containerSize.w / 1000 : 1;
  const captionFontSizePx = (displayLayout?.captionFontSize ?? 14) * captionScale;
  const captionH = captionFontSizePx * 2;
  const captionFontFamily = displayLayout?.captionFontFamily ?? "system-ui";
  const displayIsFreeMode = displayLayout?.mode === "free";
  const incomingCaptionFontSizePx = (incomingPhotoLayout?.captionFontSize ?? 14) * captionScale;
  const incomingCaptionH = incomingCaptionFontSizePx * 2;
  const incomingCaptionFontFamily = incomingPhotoLayout?.captionFontFamily ?? "system-ui";
  const incomingIsFreeMode = incomingPhotoLayout?.mode === "free";

  // Scene transition: compute outgoing wrapper styles
  const transitionOutgoingStyle = useMemo<React.CSSProperties>(() => {
    if (!isActiveTransition || sceneTransitionProgress === undefined) return {};
    switch (sceneTransition) {
      case "dissolve": {
        const { outgoing } = computeDissolveOpacity(sceneTransitionProgress);
        return { opacity: outgoing };
      }
      case "blur-dissolve": {
        const { outgoing, blur } = computeBlurDissolve(sceneTransitionProgress);
        return { opacity: outgoing, filter: `blur(${blur}px)` };
      }
      case "wipe": {
        const { wipePosition } = computeWipeProgress(sceneTransitionProgress, transitionBearing ?? 0);
        const bearing = transitionBearing ?? 0;
        const normBearing = ((bearing % 360) + 360) % 360;
        let clipPath: string;
        if (normBearing >= 315 || normBearing < 45) {
          clipPath = `inset(0 0 ${wipePosition * 100}% 0)`;
        } else if (normBearing >= 45 && normBearing < 135) {
          clipPath = `inset(0 ${wipePosition * 100}% 0 0)`;
        } else if (normBearing >= 135 && normBearing < 225) {
          clipPath = `inset(${wipePosition * 100}% 0 0 0)`;
        } else {
          clipPath = `inset(0 0 0 ${wipePosition * 100}%)`;
        }
        return { clipPath };
      }
      default:
        return {};
    }
  }, [isActiveTransition, sceneTransition, sceneTransitionProgress, transitionBearing]);

  const incomingMetas = usePhotoDimensions(incomingPhotos ?? []);
  const hasIncomingPhotos = isActiveTransition && incomingMetas.length > 0;
  const incomingGapPx = incomingPhotoLayout?.gap ?? 8;
  const incomingBorderRadiusPx = incomingPhotoLayout?.borderRadius ?? 8;
  const { enterAnimation: incomingEnterAnim } = resolvePhotoAnimations(incomingPhotoLayout, photoAnimation);

  const incomingFreeTransformMap = useMemo(
    () => getFreeTransformMap(incomingPhotoLayout),
    [incomingPhotoLayout],
  );

  const incomingOrderedMetas: PhotoMeta[] = useMemo(() => {
    if (!hasIncomingPhotos) return [];
    if (incomingPhotoLayout?.mode === "free" && incomingPhotoLayout.freeTransforms && incomingPhotoLayout.freeTransforms.length > 0) {
      const metaMap = new Map(incomingMetas.map((meta) => [meta.id, meta]));
      return [...incomingPhotoLayout.freeTransforms]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((transform) => metaMap.get(transform.photoId))
        .filter((meta): meta is PhotoMeta => !!meta);
    }
    if (incomingPhotoLayout?.order && incomingPhotoLayout.order.length > 0) {
      const metaMap = new Map(incomingMetas.map((meta) => [meta.id, meta]));
      const ordered = incomingPhotoLayout.order
        .map((id) => metaMap.get(id))
        .filter((meta): meta is PhotoMeta => !!meta);
      for (const meta of incomingMetas) {
        if (!ordered.find((orderedMeta) => orderedMeta.id === meta.id)) ordered.push(meta);
      }
      return ordered;
    }
    return incomingMetas;
  }, [hasIncomingPhotos, incomingMetas, incomingPhotoLayout]);

  const incomingLayoutMetas: LayoutPhotoMeta[] = hasIncomingPhotos
    ? incomingOrderedMetas.map((meta) => ({ id: meta.id, aspect: meta.aspect }))
    : [];

  const incomingRects = useMemo(() => {
    if (!hasIncomingPhotos) return [];
    const width = containerSize.w || 1000;
    if (incomingPhotoLayout?.mode === "free" && incomingPhotoLayout.freeTransforms?.length) {
      return incomingOrderedMetas.reduce<PhotoRect[]>((acc, meta) => {
          const transform = incomingFreeTransformMap.get(meta.id);
          if (transform) {
            acc.push({
              x: transform.x,
              y: transform.y,
              width: transform.width,
              height: transform.height,
              rotation: transform.rotation,
            });
          }
          return acc;
        }, []);
    }
    if (incomingPhotoLayout?.mode === "manual" && incomingPhotoLayout.template) {
      return computeTemplateLayout(
        incomingLayoutMetas,
        containerAspect,
        incomingPhotoLayout.template,
        incomingGapPx,
        width,
        incomingPhotoLayout.customProportions,
        incomingPhotoLayout.layoutSeed,
      );
    }
    return computeAutoLayout(incomingLayoutMetas, containerAspect, incomingGapPx, width);
  }, [hasIncomingPhotos, incomingLayoutMetas, containerAspect, incomingGapPx, containerSize.w, incomingOrderedMetas, incomingPhotoLayout, incomingFreeTransformMap]);

  const transitionIncomingStyle = useMemo<React.CSSProperties>(() => {
    if (!isActiveTransition || sceneTransitionProgress === undefined) return {};
    switch (sceneTransition) {
      case "dissolve": {
        const { incoming } = computeDissolveOpacity(sceneTransitionProgress);
        return { opacity: incoming };
      }
      case "blur-dissolve": {
        const { incoming, blur } = computeBlurDissolve(sceneTransitionProgress);
        return { opacity: incoming, filter: `blur(${blur}px)` };
      }
      case "wipe": {
        const { wipePosition } = computeWipeProgress(sceneTransitionProgress, transitionBearing ?? 0);
        const bearing = transitionBearing ?? 0;
        const normBearing = ((bearing % 360) + 360) % 360;
        let clipPath: string;
        if (normBearing >= 315 || normBearing < 45) {
          clipPath = `inset(${(1 - wipePosition) * 100}% 0 0 0)`;
        } else if (normBearing >= 45 && normBearing < 135) {
          clipPath = `inset(0 0 0 ${(1 - wipePosition) * 100}%)`;
        } else if (normBearing >= 135 && normBearing < 225) {
          clipPath = `inset(0 0 ${(1 - wipePosition) * 100}% 0)`;
        } else {
          clipPath = `inset(0 ${(1 - wipePosition) * 100}% 0 0)`;
        }
        return { clipPath };
      }
      default:
        return {};
    }
  }, [isActiveTransition, sceneTransition, sceneTransitionProgress, transitionBearing]);

  const portalOrigin = useProjectedOrigin(containerRef, originCoordinates);
  const portalProgress = photoStyle === "portal"
    ? clamp01(portalProgressOverride ?? computePortalPhaseProgress(getArrivePhaseProgress(currentTime, timeline[currentSegmentIndex])))
    : 0;

  const incomingPortalOrigin = useProjectedOrigin(containerRef, incomingOriginCoordinates);
  const incomingPortalProgress = isActiveTransition && incomingPhotoStyleResolved === "portal" && sceneTransitionProgress !== undefined
    ? computePortalPhaseProgress(sceneTransitionProgress)
    : 0;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none"
      style={{
        ...containerStyle,
        margin: "auto",
        top: 0,
        bottom: bottomInsetPx,
        left: 0,
        right: 0,
      }}
    >
      <div className="absolute inset-0" style={{ pointerEvents: "none", ...transitionOutgoingStyle }}>
        {hasDisplayPhotos && photoStyle === "portal" && !shouldFlyToAlbum ? (
          <PortalPhotoLayer
            photos={orderedMetas as PortalPhoto[]}
            containerSize={containerSize}
            origin={portalOrigin}
            portalProgress={portalProgress}
            accentColor={portalAccentColor}
          />
        ) : (<>
        {/* Bloom tether lines */}
        {isBloom && bloomOrigin && hasDisplayPhotos && containerSize.w > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              opacity: bloomProgress >= 1 && opacity >= 1 ? 0.3 : 0,
              transition: "opacity 0.4s ease",
            }}
          >
            {effectiveRects.map((rect, i) => {
              const photo = orderedMetas[i];
              if (!photo) return null;
              const overlayOffX = containerRef.current?.offsetLeft ?? 0;
              const overlayOffY = containerRef.current?.offsetTop ?? 0;
              const originPx = { x: bloomOrigin.x - overlayOffX, y: bloomOrigin.y - overlayOffY };
              const targetCX = (rect.x + rect.width / 2) * containerSize.w;
              const targetCY = (rect.y + rect.height / 2) * containerSize.h;
              // Quadratic bezier control point: midpoint shifted toward origin
              const cpX = (originPx.x + targetCX) / 2;
              const cpY = (originPx.y + targetCY) / 2 - 20;
              return (
                <path
                  key={`tether-${photo.id}`}
                  d={`M ${originPx.x} ${originPx.y} Q ${cpX} ${cpY} ${targetCX} ${targetCY}`}
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        )}

        {hasDisplayPhotos && effectiveRects.map((rect, index) => {
            const photo = orderedMetas[index];
            if (!photo) return null;
            const total = orderedMetas.length;
            const freeTransform = displayFreeTransformMap.get(photo.id);
            const captionDisplay = getCaptionDisplay(photo, freeTransform, captionFontFamily, captionFontSizePx, captionScale);
            const hasCaption = Boolean(captionDisplay.text);
            const frameHandlesCaption = !displayIsFreeMode && frameStyleUsesInlineCaption(photoFrameStyle);
            const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };

            const rotation = rect.rotation != null
              ? rect.rotation
              : total <= 3
                ? (index === 0 ? -2 : index === total - 1 ? 2 : 0)
                : (index % 2 === 0 ? -1.5 : 1.5);

            const exitProgress = overlayExitProgress;
            const staggerOffset = total > 1 ? (total - 1 - index) / (total - 1) * 0.4 : 0;
            const photoExitT = Math.max(0, Math.min(1, (exitProgress - staggerOffset) / (1 - staggerOffset + 0.01)));

            // ── Bloom style: geo-anchored animation ──
            if (isBloom && bloomOrigin && containerSize.w > 0 && !shouldFlyToAlbum) {
              // Convert raw map.project() pixels to overlay-local pixels
              const overlayOffsetX = containerRef.current?.offsetLeft ?? 0;
              const overlayOffsetY = containerRef.current?.offsetTop ?? 0;
              const originPx = { x: bloomOrigin.x - overlayOffsetX, y: bloomOrigin.y - overlayOffsetY };
              const targetPx = {
                x: rect.x * containerSize.w,
                y: rect.y * containerSize.h,
                w: rect.width * containerSize.w,
                h: rect.height * containerSize.h,
              };

              let bt: { scale: number; translateX: number; translateY: number; opacity: number };
              if (exitProgress > 0) {
                bt = getBloomExitTransform(exitProgress, index, total, originPx.x, originPx.y, targetPx);
              } else {
                bt = getBloomTransform(bloomProgress, index, total, originPx.x, originPx.y, targetPx);
              }

              return (
                <Fragment key={photo.id}>
                  <div
                    key={photo.id}
                    className="absolute"
                    style={{
                      left: `${rect.x * 100}%`,
                      top: `${rect.y * 100}%`,
                      width: `${rect.width * 100}%`,
                      height: `${rect.height * 100}%`,
                      opacity: bt.opacity,
                      transform: `translate(${bt.translateX}px, ${bt.translateY}px) scale(${bt.scale}) rotate(${rotation}deg)`,
                      transition: exitProgress > 0 ? "transform 0.05s linear, opacity 0.05s linear" : undefined,
                      willChange: "transform, opacity",
                    }}
                  >
                    <PhotoFrame
                      frameStyle={photoFrameStyle}
                      photoIndex={index}
                      caption={!displayIsFreeMode ? captionDisplay.text : undefined}
                      className="h-full w-full"
                      mediaStyle={{ borderRadius: `${borderRadiusPx}px` }}
                      footer={
                        !displayIsFreeMode && hasCaption && !frameHandlesCaption ? (
                          <p
                            className="mt-1 rounded-md px-2 py-1 text-center text-white shadow-sm"
                            style={{
                              minHeight: `${captionH}px`,
                              fontSize: `${captionFontSizePx}px`,
                              fontFamily: captionFontFamily,
                              flexShrink: 0,
                              backgroundColor: DEFAULT_CAPTION_BG_COLOR,
                              color: "#ffffff",
                              textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                            }}
                          >
                            {photo.caption}
                          </p>
                        ) : undefined
                      }
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || ""}
                        className="h-full w-full object-contain"
                        style={{ objectPosition: `${fp.x * 100}% ${fp.y * 100}%` }}
                      />
                    </PhotoFrame>
                  </div>
                  {displayIsFreeMode && hasCaption && (
                    <div
                      key={`${photo.id}-caption`}
                      className="absolute whitespace-nowrap rounded-md px-2 py-1 text-center shadow-sm"
                      style={{
                        left: `${(rect.x + rect.width / 2 + captionDisplay.offsetX) * 100}%`,
                        top: `${(rect.y + rect.height / 2 + captionDisplay.offsetY) * 100}%`,
                        transform: `translate(-50%, -50%) translate(${bt.translateX}px, ${bt.translateY}px) scale(${bt.scale}) rotate(${captionDisplay.rotation}deg)`,
                        backgroundColor: captionDisplay.bgColor,
                        color: captionDisplay.color,
                        fontFamily: captionDisplay.fontFamily,
                        fontSize: `${captionDisplay.fontSizePx}px`,
                        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                        opacity: bt.opacity,
                        zIndex: freeTransform?.zIndex ?? index,
                        transition: exitProgress > 0 ? "transform 0.05s linear, opacity 0.05s linear" : undefined,
                        willChange: "transform, opacity",
                      }}
                    >
                      {captionDisplay.text}
                    </div>
                  )}
                </Fragment>
              );
            }

            // ── Normal (non-bloom) rendering ──
            // Ken Burns: compute start/end transforms for this photo
            const isKenBurns = photoStyle === "kenburns";
            const kbStart = isKenBurns ? getKenBurnsTransform(0, index, fp) : null;
            const kbEnd = isKenBurns ? getKenBurnsTransform(1, index, fp) : null;

            const enter = getEnterAnimation(enterAnimation, index, total);
            const enterDelay = typeof (enter.transition as { delay?: number }).delay === "number"
              ? (enter.transition as { delay?: number }).delay!
              : 0;
            const overlayOffset = {
              x: containerRef.current?.offsetLeft ?? 0,
              y: containerRef.current?.offsetTop ?? 0,
            };
            const flyToAlbumExit = shouldFlyToAlbum && flyToPosition
              ? getFlyToAlbumValues(
                  rect,
                  containerSize,
                  overlayOffset,
                  flyToPosition,
                  index,
                )
              : null;
            const exit = getExitValues(exitAnimation, exitProgress, photoExitT, index);

            const enterRotate = typeof (enter.animate as { rotate?: number }).rotate === "number"
              ? (enter.animate as { rotate?: number }).rotate! + rotation
              : rotation;
            const animateValues: TargetAndTransition = flyToAlbumExit
              ? {
                  opacity: flyToAlbumExit.exitOpacity,
                  scale: flyToAlbumExit.exitScale,
                  x: flyToAlbumExit.exitX,
                  y: flyToAlbumExit.exitY,
                  filter: `blur(${flyToAlbumExit.exitBlur}px)`,
                  rotate: flyToAlbumExit.exitRotate + rotation,
                  rotateY: undefined,
                }
              : exitProgress > 0
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
              <Fragment key={photo.id}>
                <motion.div
                  key={photo.id}
                  initial={enter.initial}
                  animate={animateValues}
                  transition={flyToAlbumExit
                    ? { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
                    : exitProgress > 0
                    ? { duration: 0.5, ease: "easeOut" }
                    : enter.transition
                  }
                  onAnimationComplete={
                    flyToAlbumExit && index === 0 && photoLocationId
                      ? () => handleFlyToAlbumComplete(photoLocationId)
                      : undefined
                  }
                  className="absolute"
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.width * 100}%`,
                    height: `${rect.height * 100}%`,
                    rotate: rotation,
                    zIndex: freeTransform?.zIndex ?? index,
                  }}
                >
                  <PhotoFrame
                    frameStyle={photoFrameStyle}
                    photoIndex={index}
                    caption={!displayIsFreeMode ? captionDisplay.text : undefined}
                    className="h-full w-full"
                    mediaStyle={{ borderRadius: `${borderRadiusPx}px` }}
                    footer={
                      !displayIsFreeMode && hasCaption && !frameHandlesCaption ? (
                        <p
                          className="mt-1 rounded-md px-2 py-1 text-center text-white shadow-sm"
                          style={{
                            minHeight: `${captionH}px`,
                            fontSize: `${captionFontSizePx}px`,
                            fontFamily: captionFontFamily,
                            flexShrink: 0,
                            backgroundColor: DEFAULT_CAPTION_BG_COLOR,
                            color: "#ffffff",
                            textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                          }}
                        >
                          {photo.caption}
                        </p>
                      ) : undefined
                    }
                  >
                    {isKenBurns && kbStart && kbEnd ? (
                      <motion.img
                        src={photo.url}
                        alt={photo.caption || ""}
                        className="h-full w-full object-cover"
                        initial={{
                          scale: kbStart.scale,
                          x: `${kbStart.translateX}%`,
                          y: `${kbStart.translateY}%`,
                        }}
                        animate={{
                          scale: kbEnd.scale,
                          x: `${kbEnd.translateX}%`,
                          y: `${kbEnd.translateY}%`,
                        }}
                        transition={{
                          duration: KEN_BURNS_DURATION_SEC,
                          delay: enterDelay,
                          ease: "linear",
                          repeat: 0,
                        }}
                        style={{
                          objectPosition: `${fp.x * 100}% ${fp.y * 100}%`,
                        }}
                      />
                    ) : (
                      <img
                        src={photo.url}
                        alt={photo.caption || ""}
                        className="h-full w-full object-contain"
                        style={{
                          objectPosition: `${fp.x * 100}% ${fp.y * 100}%`,
                        }}
                      />
                    )}
                  </PhotoFrame>
                </motion.div>
                {displayIsFreeMode && hasCaption && (
                  <div
                    key={`${photo.id}-caption-anchor`}
                    className="absolute"
                    style={{
                      left: `${(rect.x + rect.width / 2 + captionDisplay.offsetX) * 100}%`,
                      top: `${(rect.y + rect.height / 2 + captionDisplay.offsetY) * 100}%`,
                      transform: `translate(-50%, -50%)`,
                      zIndex: (freeTransform?.zIndex ?? index) + 1,
                    }}
                  >
                    <motion.div
                      key={`${photo.id}-caption`}
                      initial={enter.initial}
                      animate={exitProgress > 0
                        ? { opacity: exit.exitOpacity, scale: exit.exitScale, x: exit.exitX, y: exit.exitY }
                        : enter.animate
                      }
                      transition={exitProgress > 0 ? { duration: 0.5, ease: "easeOut" } : enter.transition}
                      className="whitespace-nowrap rounded-md px-2 py-1 text-center shadow-sm"
                      style={{
                        transform: `rotate(${captionDisplay.rotation}deg)`,
                        backgroundColor: captionDisplay.bgColor,
                        color: captionDisplay.color,
                        fontFamily: captionDisplay.fontFamily,
                        fontSize: `${captionDisplay.fontSizePx}px`,
                        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                      }}
                    >
                      {captionDisplay.text}
                    </motion.div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </>)}
      </div>

      {hasIncomingPhotos && incomingPhotoStyleResolved === "portal" && incomingPortalProgress > 0 && (
        <div className="absolute inset-0" style={{ pointerEvents: "none", ...transitionIncomingStyle }}>
          <PortalPhotoLayer
            photos={incomingOrderedMetas as PortalPhoto[]}
            containerSize={containerSize}
            origin={incomingPortalOrigin}
            portalProgress={incomingPortalProgress}
            accentColor={incomingPortalAccentColor}
          />
        </div>
      )}

      {hasIncomingPhotos && incomingPhotoStyleResolved !== "portal" && (
        <div className="absolute inset-0" style={{ pointerEvents: "none", ...transitionIncomingStyle }}>
          {incomingRects.map((rect, index) => {
              const photo = incomingOrderedMetas[index];
              if (!photo) return null;
              const total = incomingOrderedMetas.length;
              const freeTransform = incomingFreeTransformMap.get(photo.id);
              const captionDisplay = getCaptionDisplay(photo, freeTransform, incomingCaptionFontFamily, incomingCaptionFontSizePx, captionScale);
              const hasCaption = Boolean(captionDisplay.text);
              const frameHandlesCaption = !incomingIsFreeMode && frameStyleUsesInlineCaption(photoFrameStyle);
              const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };

              const rotation = rect.rotation != null
                ? rect.rotation
                : total <= 3
                  ? (index === 0 ? -2 : index === total - 1 ? 2 : 0)
                  : (index % 2 === 0 ? -1.5 : 1.5);

              const isKenBurns = incomingPhotoStyleResolved === "kenburns";
              const kbStart = isKenBurns ? getKenBurnsTransform(0, index, fp) : null;
              const kbEnd = isKenBurns ? getKenBurnsTransform(1, index, fp) : null;

              const enter = getEnterAnimation(incomingEnterAnim, index, total);
              const enterDelay = typeof (enter.transition as { delay?: number }).delay === "number"
                ? (enter.transition as { delay?: number }).delay!
                : 0;

              return (
                <Fragment key={`incoming-${photo.id}`}>
                  <motion.div
                    key={`incoming-${photo.id}`}
                    initial={enter.initial}
                    animate={{ ...enter.animate, rotate: rotation }}
                    transition={enter.transition}
                    className="absolute"
                    style={{
                      left: `${rect.x * 100}%`,
                      top: `${rect.y * 100}%`,
                      width: `${rect.width * 100}%`,
                      height: `${rect.height * 100}%`,
                      rotate: rotation,
                      zIndex: freeTransform?.zIndex ?? index,
                    }}
                  >
                    <PhotoFrame
                      frameStyle={photoFrameStyle}
                      photoIndex={index}
                      caption={!incomingIsFreeMode ? captionDisplay.text : undefined}
                      className="h-full w-full"
                      mediaStyle={{ borderRadius: `${incomingBorderRadiusPx}px` }}
                      footer={
                        !incomingIsFreeMode && hasCaption && !frameHandlesCaption ? (
                          <p
                            className="mt-1 rounded-md px-2 py-1 text-center text-white shadow-sm"
                            style={{
                              minHeight: `${incomingCaptionH}px`,
                              fontSize: `${incomingCaptionFontSizePx}px`,
                              fontFamily: incomingCaptionFontFamily,
                              flexShrink: 0,
                              backgroundColor: DEFAULT_CAPTION_BG_COLOR,
                              color: "#ffffff",
                              textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                            }}
                          >
                            {photo.caption}
                          </p>
                        ) : undefined
                      }
                    >
                      {isKenBurns && kbStart && kbEnd ? (
                        <motion.img
                          src={photo.url}
                          alt={photo.caption || ""}
                          className="h-full w-full object-cover"
                          initial={{
                            scale: kbStart.scale,
                            x: `${kbStart.translateX}%`,
                            y: `${kbStart.translateY}%`,
                          }}
                          animate={{
                            scale: kbEnd.scale,
                            x: `${kbEnd.translateX}%`,
                            y: `${kbEnd.translateY}%`,
                          }}
                          transition={{
                            duration: KEN_BURNS_DURATION_SEC,
                            delay: enterDelay,
                            ease: "linear",
                            repeat: 0,
                          }}
                          style={{
                            objectPosition: `${fp.x * 100}% ${fp.y * 100}%`,
                          }}
                        />
                      ) : (
                        <img
                          src={photo.url}
                          alt={photo.caption || ""}
                          className="h-full w-full object-contain"
                          style={{
                            objectPosition: `${fp.x * 100}% ${fp.y * 100}%`,
                          }}
                        />
                      )}
                    </PhotoFrame>
                  </motion.div>
                  {incomingIsFreeMode && hasCaption && (
                    <div
                      key={`incoming-${photo.id}-caption`}
                      className="absolute whitespace-nowrap rounded-md px-2 py-1 text-center shadow-sm"
                      style={{
                        left: `${(rect.x + rect.width / 2 + captionDisplay.offsetX) * 100}%`,
                        top: `${(rect.y + rect.height / 2 + captionDisplay.offsetY) * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${captionDisplay.rotation}deg)`,
                        backgroundColor: captionDisplay.bgColor,
                        color: captionDisplay.color,
                        fontFamily: captionDisplay.fontFamily,
                        fontSize: `${captionDisplay.fontSizePx}px`,
                        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                        zIndex: (freeTransform?.zIndex ?? index) + 1,
                      }}
                    >
                      {captionDisplay.text}
                    </div>
                  )}
                </Fragment>
              );
            })}
        </div>
      )}
    </div>
  );
}
