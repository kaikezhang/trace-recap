"use client";

import { useRef, useState, useEffect } from "react";
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
  Settings,
  ChevronDown,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
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
import type { AspectRatio, MapStyle, MapStyleCategory, PhotoAnimation } from "@/types";
import { MAP_STYLE_CONFIGS, MAP_STYLE_CATEGORY_LABELS } from "@/lib/constants";

export default function TopToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const cityLabelSize = useUIStore((s) => s.cityLabelSize);
  const setCityLabelSize = useUIStore((s) => s.setCityLabelSize);
  const cityLabelLang = useUIStore((s) => s.cityLabelLang);
  const setCityLabelLang = useUIStore((s) => s.setCityLabelLang);
  const cityLabelTopPercent = useUIStore((s) => s.cityLabelTopPercent);
  const setCityLabelTopPercent = useUIStore((s) => s.setCityLabelTopPercent);
  const routeLabelBottomPercent = useUIStore((s) => s.routeLabelBottomPercent);
  const setRouteLabelBottomPercent = useUIStore((s) => s.setRouteLabelBottomPercent);
  const routeLabelSize = useUIStore((s) => s.routeLabelSize);
  const setRouteLabelSize = useUIStore((s) => s.setRouteLabelSize);

  const setProjectListOpen = useUIStore((s) => s.setProjectListOpen);
  const currentProjectName = useProjectStore((s) => s.currentProjectName);
  const isSwitchingProject = useProjectStore((s) => s.isSwitchingProject);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

  // Close settings panel on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsPanelRef.current &&
        !settingsPanelRef.current.contains(e.target as Node) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);

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
      if (file.name.endsWith(".zip")) {
        // Import zip project (photos as separate files)
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const routeFile = zip.file("route.json");
        if (!routeFile) throw new Error("No route.json in zip");
        const routeText = await routeFile.async("text");
        const data: ImportRouteData = JSON.parse(routeText);

        // Convert photo file references to blob URLs
        if (data.locations) {
          for (const loc of data.locations) {
            if (loc.photos) {
              for (const photo of loc.photos) {
                if (photo.url.startsWith("photos/")) {
                  const photoFile = zip.file(photo.url);
                  if (photoFile) {
                    const blob = await photoFile.async("blob");
                    photo.url = URL.createObjectURL(blob);
                  }
                }
              }
            }
          }
        }

        await loadRouteData(data);
        void enrichChineseNames();
      } else {
        // Import plain JSON
        const text = await file.text();
        const data: ImportRouteData = JSON.parse(text);
        await loadRouteData(data);
        void enrichChineseNames();
      }
    } catch (error) {
      console.error("Failed to import route file.", error);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportRoute = async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const { locations, segments, mapStyle, segmentTimingOverrides, currentProjectName } = useProjectStore.getState();

    // Store photos as separate files in the zip, reference by filename in JSON
    const photoFiles: Map<string, string> = new Map(); // photoId → filename
    let photoIndex = 0;

    const exportedLocations = await Promise.all(
      locations.map(async (loc) => {
        const photos = await Promise.all(
          loc.photos.map(async (p) => {
            const filename = `photos/photo_${photoIndex++}.jpg`;
            try {
              const resp = await fetch(p.url);
              const blob = await resp.blob();
              zip.file(filename, blob);
            } catch {
              // skip failed photos
            }
            photoFiles.set(p.id, filename);
            return {
              url: filename, // reference to file in zip
              caption: p.caption,
              ...(p.focalPoint ? { focalPoint: p.focalPoint } : {}),
            };
          }),
        );
        return {
          name: loc.name,
          nameZh: loc.nameZh,
          coordinates: loc.coordinates as [number, number],
          isWaypoint: loc.isWaypoint ?? false,
          ...(photos.length > 0 ? { photos } : {}),
          ...(loc.photoLayout ? { photoLayout: loc.photoLayout } : {}),
        };
      }),
    );

    const routeData = {
      name: currentProjectName ?? "Untitled",
      mapStyle,
      locations: exportedLocations,
      segments: segments.map((seg) => ({
        fromIndex: locations.findIndex((l) => l.id === seg.fromId),
        toIndex: locations.findIndex((l) => l.id === seg.toId),
        transportMode: seg.transportMode,
        ...(seg.iconVariant ? { iconVariant: seg.iconVariant } : {}),
        ...(seg.iconStyle ? { iconStyle: seg.iconStyle } : {}),
      })),
      // Convert segment ID-keyed timing to index-keyed for portable export
      timingOverrides: Object.fromEntries(
        Object.entries(segmentTimingOverrides)
          .map(([segId, duration]) => {
            const idx = segments.findIndex((s) => s.id === segId);
            return idx >= 0 ? [String(idx), duration] : null;
          })
          .filter(Boolean) as [string, number][],
      ),
    };

    zip.file("route.json", JSON.stringify(routeData, null, 2));

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentProjectName ?? "trace-recap"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b bg-background px-3 md:px-4">
        {/* Left: panel toggle + logo + project name */}
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
          <span className="hidden md:inline text-muted-foreground/40 mx-0.5">/</span>
          <button
            className="hidden md:flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors max-w-[180px]"
            onClick={() => setProjectListOpen(true)}
            disabled={isSwitchingProject}
            title="Switch project"
          >
            <span className="truncate">{currentProjectName}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </button>
          <button
            className="md:hidden flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => setProjectListOpen(true)}
            disabled={isSwitchingProject}
            title="Switch project"
          >
            <span className="truncate max-w-[100px]">{currentProjectName}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </button>
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

          {/* Settings gear */}
          <div className="relative">
            <Button
              ref={settingsButtonRef}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {settingsOpen && (
              <div
                ref={settingsPanelRef}
                className="absolute right-0 top-full mt-2 z-50 w-72 max-h-[80vh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg space-y-4"
              >
                <p className="text-sm font-semibold">Settings</p>
                {/* Map Style */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Map Style</label>
                  {(["classic", "navigation", "creative"] as MapStyleCategory[]).map((cat) => {
                    const styles = MAP_STYLE_CONFIGS.filter((c) => c.category === cat);
                    return (
                      <div key={cat} className="space-y-1.5">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                          {MAP_STYLE_CATEGORY_LABELS[cat]}
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {styles.map((cfg) => (
                            <button
                              key={cfg.id}
                              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-[10px] font-medium transition-colors ${
                                mapStyle === cfg.id
                                  ? "ring-2 ring-indigo-500 bg-indigo-50 text-indigo-700"
                                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                              }`}
                              onClick={() => setMapStyle(cfg.id)}
                            >
                              <span
                                className="h-6 w-full rounded"
                                style={{ backgroundColor: cfg.swatch }}
                              />
                              <span className="truncate w-full text-center">{cfg.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <hr className="border-gray-100" />
                {/* Language toggle */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Language</label>
                  <div className="flex gap-2">
                    {([
                      { value: "en", label: "English" },
                      { value: "zh", label: "中文" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          cityLabelLang === opt.value
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        onClick={() => setCityLabelLang(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Label size slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Label Size: {cityLabelSize}px
                  </label>
                  <Slider
                    value={[cityLabelSize]}
                    min={12}
                    max={48}
                    step={1}
                    onValueChange={(v) => {
                      const val = Array.isArray(v) ? v[0] : v;
                      setCityLabelSize(val);
                    }}
                  />
                </div>
                {/* City label position slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    City Label Position: {cityLabelTopPercent}%
                  </label>
                  <Slider
                    value={[cityLabelTopPercent]}
                    min={0}
                    max={30}
                    step={1}
                    onValueChange={(v) => {
                      const val = Array.isArray(v) ? v[0] : v;
                      setCityLabelTopPercent(val);
                    }}
                  />
                </div>
                {/* Route label position slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Route Label Position: {routeLabelBottomPercent}%
                  </label>
                  <Slider
                    value={[routeLabelBottomPercent]}
                    min={5}
                    max={40}
                    step={1}
                    onValueChange={(v) => {
                      const val = Array.isArray(v) ? v[0] : v;
                      setRouteLabelBottomPercent(val);
                    }}
                  />
                </div>
                {/* Route label size slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Route Label Size: {routeLabelSize}px
                  </label>
                  <Slider
                    value={[routeLabelSize]}
                    min={10}
                    max={32}
                    step={1}
                    onValueChange={(v) => {
                      const val = Array.isArray(v) ? v[0] : v;
                      setRouteLabelSize(val);
                    }}
                  />
                </div>

              </div>
            )}
          </div>

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
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                disabled={isSwitchingProject}
              >
                <Upload className="h-4 w-4" />
                Import Route
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportRoute}>
                <Save className="h-4 w-4" />
                Save Route
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4" />
                Export Video
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={isSwitchingProject}
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
            accept=".json,.zip"
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
              disabled={isSwitchingProject}
              onClick={() => {
                try {
                  clearRoute();
                  setClearDialogOpen(false);
                } catch (error) {
                  console.error("Failed to clear the current route.", error);
                }
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
