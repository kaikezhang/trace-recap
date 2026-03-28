"use client";

import { useRef } from "react";
import { Upload, Save, ChevronUp, MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useProjectStore, type ImportRouteData } from "@/stores/projectStore";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import { useUIStore } from "@/stores/uiStore";
import CitySearch from "./CitySearch";
import RouteList from "./RouteList";

export default function BottomSheet() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRoute = useProjectStore((s) => s.importRoute);
  const exportRoute = useProjectStore((s) => s.exportRoute);
  const setSegmentGeometry = useProjectStore((s) => s.setSegmentGeometry);
  const locations = useProjectStore((s) => s.locations);
  const expanded = useUIStore((s) => s.bottomSheetExpanded);
  const toggleBottomSheet = useUIStore((s) => s.toggleBottomSheet);
  const setBottomSheetExpanded = useUIStore((s) => s.setBottomSheetExpanded);

  const handleExportRoute = async () => {
    const data = await exportRoute();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trace-recap-route.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data: ImportRouteData = JSON.parse(text);
      importRoute(data);

      const state = useProjectStore.getState();
      for (const seg of state.segments) {
        const fromLoc = state.locations.find((l) => l.id === seg.fromId);
        const toLoc = state.locations.find((l) => l.id === seg.toId);
        if (fromLoc && toLoc) {
          try {
            const geometry = await generateRouteGeometry(
              fromLoc.coordinates,
              toLoc.coordinates,
              seg.transportMode
            );
            setSegmentGeometry(seg.id, geometry);
          } catch {
            // Geometry generation failed
          }
        }
      }
    } catch {
      // Invalid JSON or file read error
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleExportRoute();
              }}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Route
            </Button>
            <ChevronUp
              className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />

        {/* Expanded content */}
        <div className="flex flex-col overflow-hidden" style={{ height: "calc(60vh - 56px)" }}>
          <CitySearch />
          <ScrollArea className="flex-1 min-h-0">
            <RouteList />
          </ScrollArea>
        </div>
      </div>
    </>
  );
}
