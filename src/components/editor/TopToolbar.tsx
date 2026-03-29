"use client";

import { useRef } from "react";
import Link from "next/link";
import { Download, Save, Upload, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapStyleSelector from "./MapStyleSelector";
import { useUIStore } from "@/stores/uiStore";
import { useProjectStore, type ImportRouteData } from "@/stores/projectStore";
import { generateRouteGeometry } from "@/engine/RouteGeometry";

export default function TopToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);
  const exportRoute = useProjectStore((s) => s.exportRoute);
  const importRoute = useProjectStore((s) => s.importRoute);
  const enrichChineseNames = useProjectStore((s) => s.enrichChineseNames);
  const setSegmentGeometry = useProjectStore((s) => s.setSegmentGeometry);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data: ImportRouteData = JSON.parse(text);
      importRoute(data);
      enrichChineseNames();
      const state = useProjectStore.getState();
      for (const seg of state.segments) {
        const fromLoc = state.locations.find((l) => l.id === seg.fromId);
        const toLoc = state.locations.find((l) => l.id === seg.toId);
        if (fromLoc && toLoc) {
          try {
            const geometry = await generateRouteGeometry(fromLoc.coordinates, toLoc.coordinates, seg.transportMode);
            setSegmentGeometry(seg.id, geometry);
          } catch { /* geometry failed */ }
        }
      }
    } catch { /* invalid file */ }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

  return (
    <div className="flex h-10 md:h-12 items-center justify-between border-b bg-background px-3 md:px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex h-8 w-8"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          aria-label={leftPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {leftPanelOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>
        <Link href="/" className="text-sm md:text-lg font-bold tracking-tight">
          TraceRecap
        </Link>
      </div>
      <div className="flex items-center gap-1.5 md:gap-2">
        <MapStyleSelector />
        <Button
          variant="outline"
          size="sm"
          className="gap-1 md:gap-1.5 h-11 md:h-8 text-xs"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Import route"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Import</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1 md:gap-1.5 h-11 md:h-8 text-xs"
          onClick={handleExportRoute}
          aria-label="Export route"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Save Route</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 md:gap-1.5 h-11 md:h-8 text-xs"
          onClick={() => setExportDialogOpen(true)}
          aria-label="Export video"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Export</span>
        </Button>
      </div>
    </div>
  );
}
