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

function Separator({ compact }: { compact?: boolean }) {
  return <div className={compact ? "h-2.5 w-px bg-white/20" : "h-3.5 w-px bg-white/20"} />;
}

interface TripStatsBarProps {
  bottomInsetPx?: number;
}

/**
 * Compute a scale tier based on the parent container height.
 * Returns "compact" for small containers (e.g. 16:9 on portrait phone),
 * "normal" for standard sizes.
 */
function useContainerScale(ref: React.RefObject<HTMLDivElement | null>): "compact" | "normal" {
  const [tier, setTier] = useState<"compact" | "normal">("normal");

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;

    const update = () => {
      const h = el.clientHeight;
      // When the map container is shorter than 300px, switch to compact mode
      setTier(h < 300 ? "compact" : "normal");
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return tier;
}

export default function TripStatsBar({
  bottomInsetPx = 0,
}: TripStatsBarProps) {
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
  const containerRef = useRef<HTMLDivElement>(null);
  const tier = useContainerScale(containerRef);
  const isCompact = tier === "compact";

  // Subscribe to animation store changes for fly progress
  useEffect(() => {
    const unsub = useAnimationStore.subscribe((state) => {
      if (state.currentPhase === "FLY") {
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
  const containerStyle =
    bottomInsetPx > 0
      ? { bottom: `${Math.max(isCompact ? 32 : 56, bottomInsetPx + (isCompact ? 6 : 12))}px` }
      : undefined;

  const textClass = isCompact ? "text-[10px]" : "text-[13px]";
  const emojiClass = isCompact ? "text-[10px]" : "text-[13px]";
  const barHeight = isCompact ? "28px" : "36px";
  const barPx = isCompact ? "px-2.5" : "px-4";
  const barPy = isCompact ? "py-1" : "py-1.5";
  const gapClass = isCompact ? "gap-1.5" : "gap-2.5";

  return (
    <AnimatePresence>
      {isActive && stats && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`absolute left-1/2 z-10 -translate-x-1/2 ${isCompact ? "bottom-8" : "bottom-14 md:bottom-16"}`}
          style={containerStyle}
        >
          <div
            className={`flex items-center ${gapClass} rounded-t-lg bg-black/50 ${barPx} ${barPy} backdrop-blur-sm`}
            style={{ height: barHeight }}
          >
            {/* Cities */}
            <div className={`flex items-center gap-1 ${textClass} text-white tabular-nums`}>
              <span className={emojiClass}>📍</span>
              <span>
                <AnimatedNumber value={stats.citiesVisited} />
                /{stats.totalCities}
                {!isCompact && " cities"}
              </span>
            </div>

            <Separator compact={isCompact} />

            {/* Photos */}
            <div className={`flex items-center gap-1 ${textClass} text-white tabular-nums`}>
              <span className={emojiClass}>📸</span>
              <span>
                <AnimatedNumber value={stats.photosShown} />
                {!isCompact && " photos"}
              </span>
            </div>

            <Separator compact={isCompact} />

            {/* Distance */}
            <div className={`flex items-center gap-1 ${textClass} text-white tabular-nums`}>
              <span className={emojiClass}>🛣️</span>
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
                <Separator compact={isCompact} />
                <div className="flex items-center gap-0.5">
                  <AnimatePresence mode="popLayout">
                    {visibleModes.map((mode) => (
                      <motion.span
                        key={mode}
                        initial={{ opacity: 0, scale: 0, width: 0 }}
                        animate={{ opacity: 1, scale: 1, width: "auto" }}
                        exit={{ opacity: 0, scale: 0, width: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={emojiClass}
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
