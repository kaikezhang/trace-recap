"use client";

import Link from "next/link";
import { Download, Save, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapStyleSelector from "./MapStyleSelector";
import { useUIStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";

export default function TopToolbar() {
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);
  const exportRoute = useProjectStore((s) => s.exportRoute);

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
