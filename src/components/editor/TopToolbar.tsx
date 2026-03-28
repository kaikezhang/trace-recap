"use client";

import Link from "next/link";
import { Download, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapStyleSelector from "./MapStyleSelector";
import { useUIStore } from "@/stores/uiStore";

export default function TopToolbar() {
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);

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
