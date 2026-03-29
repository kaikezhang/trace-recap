"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  Save,
  Upload,
  PanelLeftClose,
  PanelLeft,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MapStyleSelector from "./MapStyleSelector";
import { useUIStore } from "@/stores/uiStore";
import { useProjectStore, type ImportRouteData } from "@/stores/projectStore";

export default function TopToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);
  const exportRoute = useProjectStore((s) => s.exportRoute);
  const loadRouteData = useProjectStore((s) => s.loadRouteData);
  const enrichChineseNames = useProjectStore((s) => s.enrichChineseNames);
  const clearRoute = useProjectStore((s) => s.clearRoute);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data: ImportRouteData = JSON.parse(text);
      await loadRouteData(data);
      void enrichChineseNames();
    } catch {
      // Invalid JSON or file read error.
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportRoute = async () => {
    const data = await exportRoute();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trace-recap-route.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
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
          <Link
            href="/"
            className="text-sm md:text-lg font-bold tracking-tight"
          >
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
            variant="destructive"
            size="sm"
            className="gap-1 md:gap-1.5 h-11 md:h-8 text-xs"
            onClick={() => setClearDialogOpen(true)}
            aria-label="Clear route"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Clear Route</span>
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
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Clear Route</DialogTitle>
            <DialogDescription>
              Are you sure? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                clearRoute();
                setClearDialogOpen(false);
              }}
            >
              Clear Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
