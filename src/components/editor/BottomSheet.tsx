"use client";

import { useEffect, useState } from "react";
import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import { ChevronUp, MapPin } from "lucide-react";
import { motion, type PanInfo } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Segment } from "@/types";
import CitySearch from "./CitySearch";
import RouteList from "./RouteList";

interface BottomSheetProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
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
  searchHintMessage,
  onDismissSearchHint,
}: BottomSheetProps) {
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const bottomSheetState = useUIStore((s) => s.bottomSheetState);
  const setBottomSheetState = useUIStore((s) => s.setBottomSheetState);
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

  const collapsedHeight = 60;
  const expandedHeaderHeight = 78;
  const maxSheetHeight = viewportHeight > 0 ? viewportHeight * 0.85 : 0;
  const halfVisibleHeight = viewportHeight > 0 ? viewportHeight * 0.5 : 0;
  const collapsedOffset = Math.max(maxSheetHeight - collapsedHeight, 0);
  const halfOffset = Math.max(maxSheetHeight - halfVisibleHeight, 0);
  const stateOffsets = {
    collapsed: collapsedOffset,
    half: halfOffset,
    full: 0,
  };
  const currentOffset = stateOffsets[bottomSheetState];
  const stopsLabel = `${locations.length} ${locations.length === 1 ? "stop" : "stops"}`;
  const totalDistanceKm = segments.reduce((sum, segment) => sum + getSegmentDistanceKm(segment), 0);
  const collapsedSummary = `${stopsLabel} · ${formatCompactDistance(totalDistanceKm)}`;
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

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop overlay only in full state */}
      {bottomSheetState === "full" && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
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
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex touch-pan-x flex-col overflow-hidden rounded-t-[24px] border-t bg-background shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
        style={{ height: maxSheetHeight || "85vh" }}
      >
        <div className="shrink-0 px-3 pb-2 pt-2" style={{ height: headerHeight }}>
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-gray-300" />

          {bottomSheetState === "collapsed" ? (
            <div
              className="touch-target-mobile flex min-h-[44px] items-center justify-center"
              onClick={toggleSheet}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSheet();
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={false}
              aria-label="Expand route panel"
            >
              <div className="inline-flex max-w-full items-center gap-2 rounded-full px-2 text-sm font-medium text-foreground/90">
                <MapPin className="h-4 w-4 shrink-0 text-indigo-600" />
                <span className="truncate">{collapsedSummary}</span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[44px] items-center gap-2">
              <div className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-3 text-xs font-semibold text-indigo-700">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{stopsLabel}</span>
              </div>
              <CitySearch
                className="min-w-0 flex-1 p-0"
                hintMessage={searchHintMessage}
                onHintDismiss={onDismissSearchHint}
                inputClassName="h-11 rounded-full border-border/70 bg-background/95 pl-9 pr-3 text-sm shadow-none"
              />
              <button
                type="button"
                className="touch-target-mobile flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
                onClick={toggleSheet}
                aria-expanded
                aria-label="Collapse route panel"
              >
                <ChevronUp className="h-4 w-4 rotate-180" />
              </button>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border/60">
          <ScrollArea className="flex-1 min-h-0">
            <RouteList onLocationClick={onLocationClick} onEditLayout={onEditLayout} />
          </ScrollArea>
        </div>
      </motion.div>
    </>
  );
}
