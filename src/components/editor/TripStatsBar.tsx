"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAnimationStore } from "@/stores/animationStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import {
  computeTripStats,
  getSortedTransportModes,
  TRANSPORT_MODE_EMOJI,
  type TripStats,
} from "@/lib/tripStats";

/** Animated number that ticks up/down to the target */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number>(0);
  const currentRef = useRef(value);

  useEffect(() => {
    const target = value;
    const start = currentRef.current;
    if (Math.abs(target - start) < 0.01) {
      setDisplay(target);
      currentRef.current = target;
      return;
    }
    const startTime = performance.now();
    const duration = 300; // ms

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out quad
      const eased = 1 - (1 - t) * (1 - t);
      const current = start + (target - start) * eased;
      currentRef.current = current;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}</>;
}

function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k`;
  }
  return String(Math.round(km));
}

function Separator() {
  return <div className="h-3.5 w-px bg-white/20" />;
}

export default function TripStatsBar() {
  const playbackState = useAnimationStore((s) => s.playbackState);
  const currentSegmentIndex = useAnimationStore((s) => s.currentSegmentIndex);
  const currentPhase = useAnimationStore((s) => s.currentPhase);
  const showPhotoOverlay = useAnimationStore((s) => s.showPhotoOverlay);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const tripStatsEnabled = useUIStore((s) => s.tripStatsEnabled);

  const [stats, setStats] = useState<TripStats | null>(null);
  const [visibleModes, setVisibleModes] = useState<string[]>([]);
  const prevModesRef = useRef<string[]>([]);
  const flyProgressRef = useRef(0);

  // Subscribe to animation store changes for fly progress
  useEffect(() => {
    // We track routeDrawFraction via the animation store's currentTime changes
    // Since there's no direct routeDrawFraction in the store, we estimate from phase progress
    const unsub = useAnimationStore.subscribe((state) => {
      if (state.currentPhase === "FLY") {
        // Estimate fly progress from timeline
        const timeline = state.timeline;
        const segTiming = timeline[state.currentSegmentIndex];
        if (segTiming) {
          const flyPhase = segTiming.phases.find((p) => p.phase === "FLY");
          if (flyPhase && flyPhase.duration > 0) {
            const phaseElapsed = state.currentTime - flyPhase.startTime;
            flyProgressRef.current = Math.max(0, Math.min(1, phaseElapsed / flyPhase.duration));
          }
        }
      } else {
        flyProgressRef.current = 0;
      }
    });
    return unsub;
  }, []);

  // Recompute stats on animation state changes
  useEffect(() => {
    if (playbackState !== "playing" && playbackState !== "paused") {
      setStats(null);
      setVisibleModes([]);
      prevModesRef.current = [];
      return;
    }

    const newStats = computeTripStats(
      locations,
      segments,
      currentSegmentIndex,
      currentPhase,
      flyProgressRef.current,
      showPhotoOverlay
    );
    setStats(newStats);

    const modes = getSortedTransportModes(newStats.transportModes);
    prevModesRef.current = modes;
    setVisibleModes(modes);
  }, [playbackState, currentSegmentIndex, currentPhase, showPhotoOverlay, locations, segments]);

  // High-frequency update during FLY phase for smooth distance ticking
  useEffect(() => {
    if (playbackState !== "playing" || currentPhase !== "FLY") return;

    let raf: number;
    function update() {
      const newStats = computeTripStats(
        locations,
        segments,
        currentSegmentIndex,
        currentPhase,
        flyProgressRef.current,
        showPhotoOverlay
      );
      setStats(newStats);

      const modes = getSortedTransportModes(newStats.transportModes);
      setVisibleModes(modes);

      raf = requestAnimationFrame(update);
    }
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [playbackState, currentPhase, currentSegmentIndex, showPhotoOverlay, locations, segments]);

  if (!tripStatsEnabled) return null;

  const isActive = playbackState === "playing" || playbackState === "paused";

  return (
    <AnimatePresence>
      {isActive && stats && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 md:bottom-16"
        >
          <div className="flex items-center gap-2.5 rounded-t-lg bg-black/50 px-4 py-1.5 backdrop-blur-sm"
            style={{ height: "36px" }}
          >
            {/* Cities */}
            <div className="flex items-center gap-1 text-[13px] text-white tabular-nums">
              <span>📍</span>
              <span>
                <AnimatedNumber value={stats.citiesVisited} />
                /{stats.totalCities} cities
              </span>
            </div>

            <Separator />

            {/* Photos */}
            <div className="flex items-center gap-1 text-[13px] text-white tabular-nums">
              <span>📸</span>
              <span>
                <AnimatedNumber value={stats.photosShown} /> photos
              </span>
            </div>

            <Separator />

            {/* Distance */}
            <div className="flex items-center gap-1 text-[13px] text-white tabular-nums">
              <span>🛣️</span>
              <span>
                {stats.totalDistanceKm >= 1000 ? (
                  <>
                    <AnimatedNumber value={stats.totalDistanceKm / 1000} decimals={1} />k km
                  </>
                ) : (
                  <>
                    <AnimatedNumber value={stats.totalDistanceKm} /> km
                  </>
                )}
              </span>
            </div>

            {/* Transport modes */}
            {visibleModes.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-0.5">
                  <AnimatePresence mode="popLayout">
                    {visibleModes.map((mode) => (
                      <motion.span
                        key={mode}
                        initial={{ opacity: 0, scale: 0, width: 0 }}
                        animate={{ opacity: 1, scale: 1, width: "auto" }}
                        exit={{ opacity: 0, scale: 0, width: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="text-[13px]"
                      >
                        {TRANSPORT_MODE_EMOJI[mode] ?? mode}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
