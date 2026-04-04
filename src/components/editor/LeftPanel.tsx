"use client";

import { type RefObject } from "react";
import { Camera, MapPinned, Route } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brand } from "@/lib/brand";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import CitySearch, { type CitySearchHandle } from "./CitySearch";
import MiniRoutePreview from "./MiniRoutePreview";
import RouteList from "./RouteList";

interface LeftPanelProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
  searchHintMessage?: string;
  onDismissSearchHint?: () => void;
  searchRef?: RefObject<CitySearchHandle | null>;
}

export default function LeftPanel({
  onLocationClick,
  onEditLayout,
  searchHintMessage,
  onDismissSearchHint,
  searchRef,
}: LeftPanelProps) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);

  const nonWaypointLocations = locations.filter((location) => !location.isWaypoint);
  const totalPhotos = locations.reduce((sum, location) => sum + location.photos.length, 0);

  if (!leftPanelOpen) return null;

  return (
    <aside
      className="relative hidden h-full w-[360px] flex-col overflow-hidden border-r md:flex"
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
        className="border-b px-5 pb-5 pt-6"
        style={{
          borderColor: brand.colors.warm[200],
          background: `linear-gradient(180deg, rgba(255,247,237,0.96) 0%, rgba(255,251,245,0.82) 100%)`,
        }}
      >
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
                color: brand.colors.warm[900],
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
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border"
            style={{
              backgroundColor: "rgba(255,255,255,0.7)",
              borderColor: brand.colors.primary[200],
              boxShadow: brand.shadows.md,
            }}
          >
            <MapPinned
              className="h-6 w-6"
              style={{ color: brand.colors.primary[500] }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[128px_minmax(0,1fr)] gap-3">
          <div
            className="rounded-[20px] border px-4 py-3"
            style={{
              backgroundColor: "rgba(255,255,255,0.76)",
              borderColor: brand.colors.primary[200],
              boxShadow: brand.shadows.sm,
            }}
          >
            <div
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: brand.colors.primary[100] }}
            >
              <Route
                className="h-4 w-4"
                style={{ color: brand.colors.primary[600] }}
              />
            </div>
            <p
              className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em]"
              style={{ color: brand.colors.warm[500] }}
            >
              Stops
            </p>
            <p className="mt-1 text-2xl font-semibold" style={{ color: brand.colors.warm[900] }}>
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
          className="mt-4 flex items-center justify-between rounded-full border px-3 py-2 text-xs"
          style={{
            borderColor: brand.colors.warm[200],
            backgroundColor: "rgba(255,251,245,0.86)",
            color: brand.colors.warm[600],
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            {totalPhotos} photo{totalPhotos === 1 ? "" : "s"} attached
          </span>
          <span>{segments.length} leg{segments.length === 1 ? "" : "s"} planned</span>
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

      <ScrollArea className="min-h-0 flex-1">
        <RouteList
          onLocationClick={onLocationClick}
          onEditLayout={onEditLayout}
        />
      </ScrollArea>
    </aside>
  );
}
