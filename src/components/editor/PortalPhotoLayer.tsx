"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { computePortalLayout } from "@/lib/portalLayout";
import { getKenBurnsTransform, KEN_BURNS_DURATION_SEC } from "@/lib/photoAnimation";
import type { Photo } from "@/types";
import { useMap } from "./MapContext";

export interface PortalPhoto extends Photo {
  aspect: number;
}

interface PortalPhotoLayerProps {
  photos: PortalPhoto[];
  containerSize: { w: number; h: number };
  origin: { x: number; y: number } | null;
  portalProgress: number;
  accentColor: string;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.trim();
  if (!normalized.startsWith("#")) return normalized;

  const raw = normalized.slice(1);
  const value = raw.length === 3
    ? raw.split("").map((part) => part + part).join("")
    : raw;

  if (value.length !== 6) return normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function useProjectedOrigin(
  containerRef: RefObject<HTMLDivElement | null>,
  coordinates: [number, number] | undefined,
): { x: number; y: number } | null {
  const { map } = useMap();
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!coordinates) {
      setOrigin(null);
      return;
    }

    let frameId = 0;

    const update = () => {
      const container = containerRef.current;
      if (!container) {
        frameId = window.requestAnimationFrame(update);
        return;
      }

      if (!map) {
        const fallback = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
        setOrigin((current) => {
          if (current && Math.abs(current.x - fallback.x) < 0.5 && Math.abs(current.y - fallback.y) < 0.5) {
            return current;
          }
          return fallback;
        });
        frameId = window.requestAnimationFrame(update);
        return;
      }

      const canvasRect = map.getCanvas().getBoundingClientRect();
      if (canvasRect.width <= 0 || canvasRect.height <= 0) {
        frameId = window.requestAnimationFrame(update);
        return;
      }

      const projected = map.project(coordinates);
      const next = {
        x: projected.x * (container.clientWidth / canvasRect.width),
        y: projected.y * (container.clientHeight / canvasRect.height),
      };

      setOrigin((current) => {
        if (current && Math.abs(current.x - next.x) < 0.5 && Math.abs(current.y - next.y) < 0.5) {
          return current;
        }
        return next;
      });

      frameId = window.requestAnimationFrame(update);
    };

    update();
    return () => window.cancelAnimationFrame(frameId);
  }, [containerRef, coordinates, map]);

  return origin;
}

export default function PortalPhotoLayer({
  photos,
  containerSize,
  origin,
  portalProgress,
  accentColor,
}: PortalPhotoLayerProps) {
  const portalIds = useId().replace(/:/g, "");

  if (photos.length === 0 || containerSize.w <= 0 || containerSize.h <= 0) {
    return null;
  }

  const hero = photos[0];
  if (!hero) return null;

  const center = origin ?? { x: containerSize.w / 2, y: containerSize.h / 2 };
  const normalizedProgress = clamp(portalProgress);
  const animatedLayout = computePortalLayout(
    photos,
    containerSize.w,
    containerSize.h,
    center.x,
    center.y,
    normalizedProgress,
  );
  const fullLayout = computePortalLayout(
    photos,
    containerSize.w,
    containerSize.h,
    center.x,
    center.y,
    1,
  );
  const heroFocalPoint = hero.focalPoint ?? { x: 0.5, y: 0.5 };
  const kbStart = getKenBurnsTransform(0, 0, heroFocalPoint);
  const kbEnd = getKenBurnsTransform(1, 0, heroFocalPoint);
  const glowColor = accentColor || "#ffffff";
  const clipId = `${portalIds}-portal-clip`;
  const blurId = `${portalIds}-portal-blur`;

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={containerSize.w}
        height={containerSize.h}
        viewBox={`0 0 ${containerSize.w} ${containerSize.h}`}
        aria-hidden
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <motion.circle
              initial={{ cx: center.x, cy: center.y, r: 0 }}
              animate={{ cx: center.x, cy: center.y, r: animatedLayout.radius }}
              transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.9 }}
            />
          </clipPath>
          <filter id={blurId}>
            <feGaussianBlur stdDeviation="5" result="blur" />
          </filter>
        </defs>

        <motion.circle
          initial={{ cx: center.x, cy: center.y, r: 0, opacity: 0 }}
          animate={{
            cx: center.x,
            cy: center.y,
            r: animatedLayout.ringRadius,
            opacity: animatedLayout.glowOpacity * 0.55,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.9 }}
          fill="none"
          stroke={hexToRgba(glowColor, 0.9)}
          strokeWidth={animatedLayout.ringWidth + 6}
          filter={`url(#${blurId})`}
        />
        <motion.circle
          initial={{ cx: center.x, cy: center.y, r: 0, opacity: 0 }}
          animate={{
            cx: center.x,
            cy: center.y,
            r: animatedLayout.ringRadius,
            opacity: animatedLayout.glowOpacity,
          }}
          transition={{ type: "spring", stiffness: 240, damping: 24, mass: 0.85 }}
          fill="none"
          stroke={hexToRgba(glowColor, 0.95)}
          strokeWidth={animatedLayout.ringWidth}
        />
      </svg>

      <div
        className="pointer-events-none absolute overflow-hidden rounded-full"
        style={{
          left: `${fullLayout.heroRect.x}px`,
          top: `${fullLayout.heroRect.y}px`,
          width: `${fullLayout.heroRect.width}px`,
          height: `${fullLayout.heroRect.height}px`,
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`,
        }}
      >
        <motion.img
          src={hero.url}
          alt={hero.caption || ""}
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
            ease: "linear",
          }}
          style={{
            objectPosition: `${heroFocalPoint.x * 100}% ${heroFocalPoint.y * 100}%`,
          }}
        />
      </div>

      {photos.slice(1, 5).map((photo, index) => {
        const satellite = animatedLayout.satellites[index];
        if (!satellite) return null;
        const focalPoint = photo.focalPoint ?? { x: 0.5, y: 0.5 };

        return (
          <motion.div
            key={`${photo.id}-portal-satellite`}
            initial={{
              x: center.x - satellite.size / 2,
              y: center.y - satellite.size / 2,
              opacity: 0,
              scale: 0,
            }}
            animate={{
              x: satellite.x - satellite.size / 2,
              y: satellite.y - satellite.size / 2,
              opacity: satellite.opacity,
              scale: satellite.scale,
            }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 20,
              delay: normalizedProgress >= 0.6 ? index * 0.1 : 0,
            }}
            className="pointer-events-none absolute overflow-hidden rounded-full border-2 border-white/95 shadow-xl"
            style={{
              width: `${satellite.size}px`,
              height: `${satellite.size}px`,
              boxShadow: `0 0 18px ${hexToRgba(glowColor, 0.28)}`,
            }}
          >
            <img
              src={photo.url}
              alt={photo.caption || ""}
              className="h-full w-full object-cover"
              style={{
                objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`,
              }}
            />
          </motion.div>
        );
      })}
    </>
  );
}
