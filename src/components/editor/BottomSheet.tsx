"use client";

import { ChevronUp, MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import CitySearch from "./CitySearch";
import RouteList from "./RouteList";

interface BottomSheetProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
}

export default function BottomSheet({ onLocationClick, onEditLayout }: BottomSheetProps) {
  const locations = useProjectStore((s) => s.locations);
  const expanded = useUIStore((s) => s.bottomSheetExpanded);
  const toggleBottomSheet = useUIStore((s) => s.toggleBottomSheet);
  const setBottomSheetExpanded = useUIStore((s) => s.setBottomSheetExpanded);

  return (
    <>
      {/* Backdrop overlay when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setBottomSheetExpanded(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed left-0 right-0 z-50 bg-background border-t rounded-t-2xl shadow-2xl transition-[bottom] duration-300 ease-out ${
          expanded ? "bottom-0" : "bottom-[calc(-60vh+56px)]"
        }`}
        style={{ height: "60vh" }}
      >
        {/* Drag handle + collapsed bar */}
        <div
          className="flex w-full items-center justify-between px-4 h-14 cursor-pointer"
          onClick={toggleBottomSheet}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label="Toggle route panel"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleBottomSheet(); }}
        >
          <div className="flex items-center gap-2">
            <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 absolute top-2 left-1/2 -translate-x-1/2" />
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {locations.length} {locations.length === 1 ? "stop" : "stops"}
            </span>
          </div>
          <ChevronUp
            className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>


        {/* Expanded content */}
        <div className="flex flex-col overflow-hidden" style={{ height: "calc(60vh - 56px)" }}>
          <CitySearch />
          <ScrollArea className="flex-1 min-h-0">
            <RouteList onLocationClick={onLocationClick} onEditLayout={onEditLayout} />
          </ScrollArea>
        </div>
      </div>
    </>
  );
}
