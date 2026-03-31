"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMap } from "./MapContext";
import { useAnimationStore } from "@/stores/animationStore";
import { useUIStore } from "@/stores/uiStore";
import type { Breadcrumb } from "@/stores/animationStore";

interface ProjectedBreadcrumb extends Breadcrumb {
  x: number;
  y: number;
}

const BREADCRUMB_SIZE = 32;
const BORDER_WIDTH = 2;

export default function BreadcrumbTrail() {
  const { map } = useMap();
  const breadcrumbs = useAnimationStore((s) => s.breadcrumbs);
  const breadcrumbsEnabled = useUIStore((s) => s.breadcrumbsEnabled);
  const [projected, setProjected] = useState<ProjectedBreadcrumb[]>([]);

  const updatePositions = useCallback(() => {
    if (!map || breadcrumbs.length === 0) {
      setProjected([]);
      return;
    }

    const next = breadcrumbs.map((bc) => {
      const point = map.project(bc.coordinates);
      return { ...bc, x: point.x, y: point.y };
    });
    setProjected(next);
  }, [map, breadcrumbs]);

  useEffect(() => {
    if (!map) return;

    updatePositions();
    map.on("move", updatePositions);
    return () => {
      map.off("move", updatePositions);
    };
  }, [map, updatePositions]);

  if (!breadcrumbsEnabled || projected.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <AnimatePresence>
        {projected.map((bc, index) => {
          const isNewest = index === projected.length - 1;
          const targetOpacity = isNewest ? 0.8 : 0.7;

          return (
            <motion.div
              key={bc.locationId}
              initial={{ scale: 2, opacity: 1 }}
              animate={{ scale: 1, opacity: targetOpacity }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
              className="absolute"
              style={{
                left: bc.x - BREADCRUMB_SIZE / 2,
                top: bc.y - BREADCRUMB_SIZE / 2,
                width: BREADCRUMB_SIZE,
                height: BREADCRUMB_SIZE,
              }}
            >
              <div
                className="h-full w-full overflow-hidden rounded-full"
                style={{
                  border: `${BORDER_WIDTH}px solid white`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <img
                  src={bc.heroPhotoUrl}
                  alt={bc.cityName}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
