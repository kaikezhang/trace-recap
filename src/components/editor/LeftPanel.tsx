"use client";

import { useEffect, useRef, type RefObject } from "react";
import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import { Camera, ChevronDown, MapPinned, Route } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brand } from "@/lib/brand";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Segment } from "@/types";
import CitySearch, { type CitySearchHandle } from "./CitySearch";
import MiniRoutePreview from "./MiniRoutePreview";
import RouteList from "./RouteList";

interface LeftPanelProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
  selectedLocationIndex?: number | null;
  onSelectedLocationIndexChange?: (index: number | null) => void;
  searchHintMessage?: string;
  onDismissSearchHint?: () => void;
  searchRef?: RefObject<CitySearchHandle | null>;
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

export default function LeftPanel({
  onLocationClick,
  onEditLayout,
  selectedLocationIndex,
  onSelectedLocationIndexChange,
  searchHintMessage,
  onDismissSearchHint,
  searchRef,
}: LeftPanelProps) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const headerCollapsed = useUIStore((s) => s.headerCollapsed);
  const setHeaderCollapsed = useUIStore((s) => s.setHeaderCollapsed);
  const toggleHeaderCollapsed = useUIStore((s) => s.toggleHeaderCollapsed);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const routeScrollRegionRef = useRef<HTMLDivElement | null>(null);

  const nonWaypointLocations = locations.filter((location) => !location.isWaypoint);
  const totalPhotos = locations.reduce((sum, location) => sum + location.photos.length, 0);
  const totalDistanceKm = segments.reduce((sum, segment) => sum + getSegmentDistanceKm(segment), 0);

  useEffect(() => {
    const region = routeScrollRegionRef.current;
    const viewport = region?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;

    const handleScroll = () => {
      if (viewport.scrollTop > 0) {
        setHeaderCollapsed(true);
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [setHeaderCollapsed]);

  if (!leftPanelOpen) return null;

  const compactStats = [
    {
      key: "stops",
      icon: MapPinned,
      label: `${nonWaypointLocations.length} stop${nonWaypointLocations.length === 1 ? "" : "s"}`,
    },
    {
      key: "photos",
      icon: Camera,
      label: `${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}`,
    },
    {
      key: "distance",
      icon: Route,
      label: formatCompactDistance(totalDistanceKm),
    },
  ];

  const handleRouteAreaInteract = () => {
    if (!headerCollapsed) {
      setHeaderCollapsed(true);
    }
  };

  return (
    <aside
      className="relative hidden h-full w-[400px] flex-col overflow-hidden border-r md:flex"
      style={{
        background: brand.gradients.cardWarm,
        borderColor: brand.colors.warm[200],
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: `linear-gradient(180deg, ${brand.colors.primary[400]} 0%, ${brand.colors.ocean[400]} 100%)`,
        }}
      />

      <div
        className="border-b px-4 py-3"
        style={{
          borderColor: brand.colors.warm[200],
          background: `linear-gradient(180deg, rgba(255,247,237,0.96) 0%, rgba(255,251,245,0.82) 100%)`,
        }}
      >
        <button
          type="button"
          aria-expanded={!headerCollapsed}
          aria-controls="left-panel-expanded-header"
          aria-label={headerCollapsed ? "Expand journey header" : "Collapse journey header"}
          onClick={toggleHeaderCollapsed}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0 overflow-hidden">
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden text-sm"
              style={{
                color: brand.colors.warm[500],
                fontFamily: brand.fonts.body,
              }}
            >
              {compactStats.map(({ key, icon: Icon, label }, index) => (
                <div
                  key={key}
                  className="inline-flex min-w-0 shrink-0 items-center gap-1.5"
                >
                  <Icon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{
                      color: key === "distance"
                        ? brand.colors.ocean[600]
                        : brand.colors.primary[500],
                    }}
                  />
                  <span className="truncate">{label}</span>
                  {index < compactStats.length - 1 ? (
                    <span
                      aria-hidden
                      className="text-xs"
                      style={{ color: brand.colors.warm[400] }}
                    >
                      ·
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: "rgba(255,255,255,0.78)",
              color: brand.colors.warm[500],
            }}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                headerCollapsed ? "" : "rotate-180"
              }`}
              style={{ transitionTimingFunction: brand.animation.easeInOut }}
            />
          </span>
        </button>

        <div
          id="left-panel-expanded-header"
          className="grid overflow-hidden"
          style={{
            gridTemplateRows: headerCollapsed ? "0fr" : "1fr",
            opacity: headerCollapsed ? 0 : 1,
            marginTop: headerCollapsed ? 0 : 12,
            transitionDuration: "260ms",
            transitionProperty: "grid-template-rows, opacity, margin-top",
            transitionTimingFunction: brand.animation.easeInOut,
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="pb-1 pt-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className="text-2xl leading-none"
                    style={{
                      color: brand.colors.primary[600],
                      fontFamily: brand.fonts.handwritten,
                    }}
                  >
                    Your Journey
                  </p>
                  <h2
                    className="mt-2 text-[28px] font-semibold leading-[1.05]"
                    style={{
                      color: brand.colors.warm[800],
                      fontFamily: brand.fonts.display,
                    }}
                  >
                    {nonWaypointLocations.length > 0
                      ? `${nonWaypointLocations.length} stops waiting`
                      : "Map out your first stop"}
                  </h2>
                  <p
                    className="mt-2 max-w-[18rem] text-sm leading-5"
                    style={{ color: brand.colors.warm[500] }}
                  >
                    Warm up the route with cities, quick stopovers, and the photos that make it feel like yours.
                  </p>
                </div>

                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: brand.colors.primary[100] }}
                >
                  <MapPinned
                    className="h-5 w-5"
                    style={{ color: brand.colors.primary[500] }}
                  />
                </div>
              </div>

              <div
                className="mt-4 grid grid-cols-[112px_minmax(0,1fr)] items-end gap-4 border-t pt-4"
                style={{ borderColor: brand.colors.warm[200] }}
              >
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium"
                    style={{ color: brand.colors.warm[500] }}
                  >
                    Stops
                  </p>
                  <p
                    className="mt-1 text-2xl font-semibold"
                    style={{ color: brand.colors.warm[800] }}
                  >
                    {nonWaypointLocations.length}
                  </p>
                </div>

                <MiniRoutePreview
                  locations={locations}
                  segments={segments}
                  className="min-w-0 overflow-hidden"
                />
              </div>

              <div
                className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs"
                style={{
                  borderColor: brand.colors.warm[200],
                  color: brand.colors.warm[500],
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" />
                  {totalPhotos} photo{totalPhotos === 1 ? "" : "s"} attached
                </span>
                <span>{segments.length} leg{segments.length === 1 ? "" : "s"} planned</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="border-b px-4 py-4"
        style={{
          borderColor: brand.colors.warm[200],
          backgroundColor: "rgba(255,251,245,0.72)",
        }}
      >
        <CitySearch
          ref={searchRef}
          hintMessage={searchHintMessage}
          onHintDismiss={onDismissSearchHint}
          className="p-0"
          inputClassName="rounded-2xl border-[#fed7aa] bg-white/85 shadow-[0_8px_20px_-12px_rgba(120,53,15,0.35)] focus:border-[#f97316] focus:ring-[#f97316]/15"
        />
      </div>

      <div
        ref={routeScrollRegionRef}
        className="min-h-0 flex-1"
        onWheelCapture={handleRouteAreaInteract}
        onTouchStartCapture={handleRouteAreaInteract}
      >
        <ScrollArea className="h-full">
          <RouteList
            onLocationClick={onLocationClick}
            onEditLayout={onEditLayout}
            selectedLocationIndex={selectedLocationIndex}
            onSelectedLocationIndexChange={onSelectedLocationIndexChange}
            onAddStopRequest={() => searchRef?.current?.focus()}
          />
        </ScrollArea>
      </div>
    </aside>
  );
}
