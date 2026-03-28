"use client";

import { useRef } from "react";
import { Upload, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useProjectStore, type ImportRouteData } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import CitySearch from "./CitySearch";
import RouteList from "./RouteList";

export default function LeftPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRoute = useProjectStore((s) => s.importRoute);
  const enrichChineseNames = useProjectStore((s) => s.enrichChineseNames);
  const exportRoute = useProjectStore((s) => s.exportRoute);
  const setSegmentGeometry = useProjectStore((s) => s.setSegmentGeometry);

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
      // Fetch Chinese names for imported locations (non-blocking)
      enrichChineseNames();

      // Generate geometry for each segment
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
            // Geometry generation failed; segment keeps null geometry
          }
        }
      }
    } catch {
      // Invalid JSON or file read error
    }

    // Reset input so same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);

  if (!leftPanelOpen) return null;

  return (
    <div className="hidden md:flex h-full w-80 flex-col overflow-hidden border-r bg-background">
      <div className="border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Route</h2>
      </div>
      <CitySearch />
      <div className="px-3 py-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleExportRoute}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Route
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <RouteList />
      </ScrollArea>
    </div>
  );
}
