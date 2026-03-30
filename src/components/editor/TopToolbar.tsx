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
  Undo2,
  Redo2,
  MoreVertical,
  Map,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/stores/uiStore";
import { useProjectStore, type ImportRouteData } from "@/stores/projectStore";
import { useHistoryStore } from "@/stores/historyStore";
import type { AspectRatio, MapStyle } from "@/types";

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
  const mapStyle = useProjectStore((s) => s.mapStyle);
  const setMapStyle = useProjectStore((s) => s.setMapStyle);
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const setViewportRatio = useUIStore((s) => s.setViewportRatio);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

  const ratioOptions: AspectRatio[] = ["free", "16:9", "9:16", "4:3", "3:4", "1:1"];
  const ratioLabels: Record<AspectRatio, string> = {
    free: "Free",
    "16:9": "16:9",
    "9:16": "9:16",
    "4:3": "4:3",
    "3:4": "3:4",
    "1:1": "1:1",
  };

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
      <div className="flex h-12 items-center justify-between border-b bg-background px-3 md:px-4">
        {/* Left: panel toggle + logo */}
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

        {/* Center: viewport ratio selector (desktop) */}
        <div className="hidden md:flex items-center gap-1 rounded-lg border p-0.5 bg-muted/50">
          {ratioOptions.map((ratio) => (
            <button
              key={ratio}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                viewportRatio === ratio
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => setViewportRatio(ratio)}
            >
              {ratioLabels[ratio]}
            </button>
          ))}
        </div>

        {/* Center: viewport ratio selector (mobile dropdown) */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="px-2 py-1 text-xs rounded-md font-medium border bg-muted/50">
                  {ratioLabels[viewportRatio]}
                </button>
              }
            />
            <DropdownMenuContent align="center" sideOffset={4}>
              <DropdownMenuRadioGroup
                value={viewportRatio}
                onValueChange={(v) => setViewportRatio(v as AspectRatio)}
              >
                {ratioOptions.map((ratio) => (
                  <DropdownMenuRadioItem key={ratio} value={ratio}>
                    {ratioLabels[ratio]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: undo/redo + more menu */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Import Route
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportRoute}>
                <Save className="h-4 w-4" />
                Save Route
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Map className="h-4 w-4" />
                  Map Style
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={mapStyle}
                    onValueChange={(v) => setMapStyle(v as MapStyle)}
                  >
                    <DropdownMenuRadioItem value="light">
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="satellite">
                      Satellite
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4" />
                Export Video
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setClearDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Clear Route
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
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
