"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import { ChevronDown, MapPin, Route } from "lucide-react";
import { motion, type PanInfo, useReducedMotion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brand } from "@/lib/brand";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Segment } from "@/types";
import CitySearch, { type CitySearchHandle } from "./CitySearch";
import RouteList from "./RouteList";

interface BottomSheetProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
  selectedLocationIndex?: number | null;
  onSelectedLocationIndexChange?: (index: number | null) => void;
  searchHintMessage?: string;
  onDismissSearchHint?: () => void;
}

function getSegmentDistanceKm(segment: Segment): number {
  if (!segment.geometry || segment.geometry.coordinates.length < 2) {
    return 0;
  }

  try {
    return length(lineString(segment.geometry.coordinates), { units: "kilometers" });
  } catch {
    return 0;
  }
}

function formatCompactDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return "0 km";
  }

  return `${Math.round(distanceKm).toLocaleString()} km`;
}

export default function BottomSheet({
  onLocationClick,
  onEditLayout,
  selectedLocationIndex,
  onSelectedLocationIndexChange,
  searchHintMessage,
  onDismissSearchHint,
}: BottomSheetProps) {
  const shouldReduceMotion = useReducedMotion();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const bottomSheetState = useUIStore((s) => s.bottomSheetState);
  const setBottomSheetState = useUIStore((s) => s.setBottomSheetState);
  const searchRef = useRef<CitySearchHandle>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setViewportHeight(window.innerHeight);
    setMounted(true);

    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const collapsedHeight = 94;
  const expandedHeaderHeight = 118;
  const maxSheetHeight = viewportHeight > 0 ? viewportHeight * 0.88 : 0;
  const halfVisibleHeight = viewportHeight > 0 ? viewportHeight * 0.6 : 0;
  const collapsedOffset = Math.max(maxSheetHeight - collapsedHeight, 0);
  const halfOffset = Math.max(maxSheetHeight - halfVisibleHeight, 0);
  const stateOffsets = {
    collapsed: collapsedOffset,
    half: halfOffset,
    full: 0,
  };
  const currentOffset = stateOffsets[bottomSheetState];
  const nonWaypointLocations = useMemo(
    () => locations.filter((location) => !location.isWaypoint),
    [locations],
  );
  const nonWaypointCount = nonWaypointLocations.length;
  const stopsLabel = `${nonWaypointCount} ${nonWaypointCount === 1 ? "stop" : "stops"}`;
  const totalDistanceKm = segments.reduce((sum, segment) => sum + getSegmentDistanceKm(segment), 0);
  const collapsedSummary = `${stopsLabel} · ${formatCompactDistance(totalDistanceKm)}`;
  const collapsedRoutePreview = useMemo(() => {
    if (nonWaypointLocations.length === 0) {
      return "Add your first stop";
    }

    if (nonWaypointLocations.length === 1) {
      return nonWaypointLocations[0].name || "Your first stop";
    }

    const firstStop = nonWaypointLocations[0]?.name || "First stop";
    const secondStop = nonWaypointLocations[1]?.name || "Next stop";

    if (nonWaypointLocations.length === 2) {
      return `${firstStop} to ${secondStop}`;
    }

    return `${firstStop} via ${secondStop} +${nonWaypointLocations.length - 2}`;
  }, [nonWaypointLocations]);
  const collapsedStopsPreview = useMemo(
    () =>
      nonWaypointLocations
        .slice(0, 3)
        .map((location) => (location.name || "•").slice(0, 1).toUpperCase()),
    [nonWaypointLocations],
  );
  const headerHeight = bottomSheetState === "collapsed" ? collapsedHeight : expandedHeaderHeight;

  const snapToNearestState = (offset: number) => {
    const nearestState = (Object.entries(stateOffsets) as Array<
      [keyof typeof stateOffsets, number]
    >).reduce((closest, current) => {
      return Math.abs(current[1] - offset) < Math.abs(closest[1] - offset)
        ? current
        : closest;
    })[0];
    setBottomSheetState(nearestState);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (viewportHeight === 0) return;

    const nextOffset = Math.min(
      Math.max(currentOffset + info.offset.y, 0),
      collapsedOffset,
    );
    const draggedUp = info.offset.y < -100 || info.velocity.y < -700;
    const draggedDown = info.offset.y > 100 || info.velocity.y > 700;

    if (draggedUp) {
      if (bottomSheetState === "collapsed") {
        setBottomSheetState("half");
        return;
      }

      if (bottomSheetState === "half") {
        setBottomSheetState("full");
        return;
      }
    }

    if (draggedDown) {
      if (bottomSheetState === "full") {
        setBottomSheetState("half");
        return;
      }

      if (bottomSheetState === "half") {
        setBottomSheetState("collapsed");
        return;
      }
    }

    snapToNearestState(nextOffset);
  };

  const toggleSheet = () => {
    setBottomSheetState(bottomSheetState === "collapsed" ? "half" : "collapsed");
  };

  const focusSearch = () => {
    setBottomSheetState("full");
    window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop overlay only in full state */}
      {bottomSheetState === "full" && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: "rgba(28,25,23,0.24)" }}
          onClick={() => setBottomSheetState("half")}
        />
      )}

      {/* Bottom sheet */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: collapsedOffset }}
        dragElastic={0.08}
        dragMomentum={false}
        initial={false}
        animate={{ y: currentOffset }}
        onDragEnd={handleDragEnd}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 30, stiffness: 280 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex touch-pan-x flex-col overflow-hidden rounded-t-[30px] border-t"
        style={{ height: maxSheetHeight || "85vh" }}
      >
        <div
          className="shrink-0 px-3 pb-3 pt-2"
          style={{
            height: headerHeight,
            background: "linear-gradient(180deg, rgba(255,251,245,0.98) 0%, rgba(255,247,237,0.96) 62%, rgba(255,244,231,0.93) 100%)",
            borderTop: `1px solid ${brand.colors.warm[100]}`,
            boxShadow: "0 -16px 48px rgba(120, 53, 15, 0.10)",
          }}
        >
          <div
            className="mx-auto mb-3 h-[5px] w-10 rounded-full"
            style={{ backgroundColor: "rgba(120,113,108,0.36)" }}
          />

          {bottomSheetState === "collapsed" ? (
            <button
              type="button"
              className="touch-target-mobile flex w-full items-center gap-3 rounded-[24px] border px-4 py-3 text-left transition-transform duration-150 active:scale-[0.99]"
              onClick={toggleSheet}
              aria-expanded={false}
              aria-label="Expand route panel"
              style={{
                borderColor: brand.colors.warm[200],
                background: "linear-gradient(160deg, rgba(255,251,245,0.96) 0%, rgba(255,255,255,0.9) 100%)",
                boxShadow: brand.shadows.md,
              }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: brand.colors.primary[50], color: brand.colors.primary[600] }}
              >
                <MapPin className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold" style={{ color: brand.colors.warm[800] }}>
                  {collapsedSummary}
                </p>
                <p className="mt-0.5 truncate text-xs" style={{ color: brand.colors.warm[500] }}>
                  {collapsedRoutePreview}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {collapsedStopsPreview.length > 0 ? (
                  <div className="flex items-center -space-x-1">
                    {collapsedStopsPreview.map((stopInitial, index) => (
                      <span
                        key={`${stopInitial}-${index}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold"
                        style={{
                          borderColor: "rgba(255,255,255,0.85)",
                          backgroundColor: index === 2 ? brand.colors.ocean[50] : brand.colors.primary[50],
                          color: index === 2 ? brand.colors.ocean[700] : brand.colors.primary[700],
                        }}
                      >
                        {stopInitial}
                      </span>
                    ))}
                  </div>
                ) : null}
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{
                    borderColor: brand.colors.warm[200],
                    backgroundColor: "rgba(255,255,255,0.84)",
                    color: brand.colors.warm[600],
                  }}
                >
                  <ChevronDown className="h-4 w-4" />
                </span>
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex min-h-[44px] items-center gap-2">
                <div
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold"
                  style={{
                    backgroundColor: brand.colors.primary[50],
                    color: brand.colors.primary[700],
                  }}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{stopsLabel}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: brand.colors.warm[700] }}>
                    {collapsedRoutePreview}
                  </p>
                  <div
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      color: brand.colors.warm[600],
                      borderColor: brand.colors.warm[200],
                      backgroundColor: "rgba(255,255,255,0.78)",
                    }}
                  >
                    <Route className="h-3 w-3" />
                    {formatCompactDistance(totalDistanceKm)}
                  </div>
                </div>
                <button
                  type="button"
                  className="touch-target-mobile flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95"
                  onClick={toggleSheet}
                  aria-expanded
                  aria-label="Collapse route panel"
                  style={{
                    color: brand.colors.warm[600],
                    backgroundColor: "rgba(255,255,255,0.78)",
                    border: `1px solid ${brand.colors.warm[200]}`,
                  }}
                >
                  <ChevronDown className="h-4 w-4 rotate-180" />
                </button>
              </div>

              <CitySearch
                ref={searchRef}
                className="p-0"
                hintMessage={searchHintMessage}
                onHintDismiss={onDismissSearchHint}
                hideLabel
                onInputFocus={() => setBottomSheetState("full")}
                inputClassName="h-12 rounded-[22px] border-[#f2dbc2] bg-white/94 text-[15px] shadow-[0_14px_28px_-20px_rgba(120,53,15,0.18)]"
              />
            </div>
          )}
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden border-t"
          style={{
            borderColor: brand.colors.warm[200],
            background: "linear-gradient(180deg, rgba(255,250,245,0.98) 0%, rgba(255,248,240,0.95) 100%)",
          }}
        >
          <ScrollArea className="min-h-0 flex-1">
            <RouteList
              mobileSheet
              onLocationClick={onLocationClick}
              onEditLayout={onEditLayout}
              selectedLocationIndex={selectedLocationIndex}
              onSelectedLocationIndexChange={onSelectedLocationIndexChange}
              onAddStopRequest={focusSearch}
            />
          </ScrollArea>
        </div>
      </motion.div>
    </>
  );
}
