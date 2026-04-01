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
  Palette,
  X,
  Loader2,
  Check,
  AlertCircle,
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
import type { AlbumStyle, AspectRatio, MapStyle, MapStyleCategory } from "@/types";
import { MAP_STYLE_CONFIGS, MAP_STYLE_CATEGORY_LABELS } from "@/lib/constants";
import { ALBUM_STYLE_CONFIGS } from "@/lib/albumStyles";

export default function TopToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);
  const saveStatus = useUIStore((s) => s.saveStatus);
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
  const moodColorsEnabled = useUIStore((s) => s.moodColorsEnabled);
  const setMoodColorsEnabled = useUIStore((s) => s.setMoodColorsEnabled);
  const albumStyle = useUIStore((s) => s.albumStyle);
  const setAlbumStyle = useUIStore((s) => s.setAlbumStyle);
  const albumCaptionsEnabled = useUIStore((s) => s.albumCaptionsEnabled);
  const setAlbumCaptionsEnabled = useUIStore((s) => s.setAlbumCaptionsEnabled);

  const setProjectListOpen = useUIStore((s) => s.setProjectListOpen);
  const currentProjectName = useProjectStore((s) => s.currentProjectName);
  const isSwitchingProject = useProjectStore((s) => s.isSwitchingProject);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Close settings panel on outside click (desktop only)
  useEffect(() => {
    if (!settingsOpen || isMobile) return;
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
  }, [settingsOpen, isMobile]);

  // Prevent body scrolling when mobile drawer is open
  useEffect(() => {
    if (!settingsOpen || !isMobile) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [settingsOpen, isMobile]);

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
    const routeData = await exportRoute();

    // Build a lookup from location index → in-memory photos (with live blob/data URLs)
    const locations = useProjectStore.getState().locations;
    const livePhotoUrlMap = new Map<string, string>();
    for (const loc of locations) {
      for (const photo of loc.photos) {
        // Key by caption+focalPoint to match serialized photos back to live ones
        livePhotoUrlMap.set(`${loc.name}:${photo.caption ?? ''}:${photo.focalPoint?.x ?? ''}:${photo.focalPoint?.y ?? ''}:${photo.url.slice(-40)}`, photo.url);
      }
    }

    let photoIndex = 0;

    for (let locIdx = 0; locIdx < routeData.locations.length; locIdx++) {
      const location = routeData.locations[locIdx];
      if (!location.photos) {
        continue;
      }

      // Use live in-memory URLs when available (they have valid blob/data URLs)
      const liveLoc = locations[locIdx];

      for (let pIdx = 0; pIdx < location.photos.length; pIdx++) {
        const photo = location.photos[pIdx];
        const filename = `photos/photo_${photoIndex++}.jpg`;
        try {
          // Prefer in-memory photo URL (blob: or data:) over serialized URL
          const liveUrl = liveLoc?.photos[pIdx]?.url;
          const urlToFetch = liveUrl && (liveUrl.startsWith('blob:') || liveUrl.startsWith('data:'))
            ? liveUrl
            : photo.url;
          const response = await fetch(urlToFetch);
          if (!response.ok) {
            console.warn(`Export: failed to fetch photo ${filename} (${response.status})`);
            continue;
          }
          const blob = await response.blob();
          // Validate: real photos should be > 1KB
          if (blob.size < 1024) {
            console.warn(`Export: photo ${filename} too small (${blob.size}B), skipping`);
            continue;
          }
          zip.file(filename, blob);
          photo.url = filename;
        } catch {
          // Keep the serialized URL in route.json if the photo blob cannot be materialized.
          console.warn(`Export: exception fetching photo ${filename}`);
        }
      }
    }

    zip.file("route.json", JSON.stringify(routeData, null, 2));

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${routeData.name || "trace-recap"}.zip`;
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
          {/* Save status indicator */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse" title="Saving...">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden md:inline">Saving…</span>
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[10px] text-green-600" title="Saved">
              <Check className="h-3 w-3" />
              <span className="hidden md:inline">Saved</span>
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-[10px] text-red-500" title="Save failed">
              <AlertCircle className="h-3 w-3" />
              <span className="hidden md:inline">Save failed</span>
            </span>
          )}
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

            {/* Desktop: absolute dropdown */}
            {settingsOpen && !isMobile && (
              <div
                ref={settingsPanelRef}
                className="absolute right-0 top-full mt-2 z-50 w-72 max-h-[80vh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg space-y-4"
              >
                <p className="text-sm font-semibold">Settings</p>
                <SettingsContent
                  mapStyle={mapStyle}
                  setMapStyle={setMapStyle}
                  cityLabelLang={cityLabelLang}
                  setCityLabelLang={setCityLabelLang}
                  cityLabelSize={cityLabelSize}
                  setCityLabelSize={setCityLabelSize}
                  cityLabelTopPercent={cityLabelTopPercent}
                  setCityLabelTopPercent={setCityLabelTopPercent}
                  routeLabelBottomPercent={routeLabelBottomPercent}
                  setRouteLabelBottomPercent={setRouteLabelBottomPercent}
                  routeLabelSize={routeLabelSize}
                  setRouteLabelSize={setRouteLabelSize}
                  moodColorsEnabled={moodColorsEnabled}
                  setMoodColorsEnabled={setMoodColorsEnabled}
                  albumStyle={albumStyle}
                  setAlbumStyle={setAlbumStyle}
                  albumCaptionsEnabled={albumCaptionsEnabled}
                  setAlbumCaptionsEnabled={setAlbumCaptionsEnabled}
                />
              </div>
            )}
          </div>

          {/* Mobile: slide-up drawer (rendered via portal to avoid toolbar clipping) */}
          {settingsOpen && isMobile && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
                onClick={() => setSettingsOpen(false)}
              />
              {/* Drawer */}
              <div className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-background shadow-2xl pb-[env(safe-area-inset-bottom)]">
                {/* Drag handle */}
                <div className="sticky top-0 z-10 bg-background pt-3 pb-2 px-4 rounded-t-2xl">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Settings</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSettingsOpen(false)}
                      aria-label="Close settings"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="px-4 pb-8 space-y-4">
                  <SettingsContent
                    mapStyle={mapStyle}
                    setMapStyle={setMapStyle}
                    cityLabelLang={cityLabelLang}
                    setCityLabelLang={setCityLabelLang}
                    cityLabelSize={cityLabelSize}
                    setCityLabelSize={setCityLabelSize}
                    cityLabelTopPercent={cityLabelTopPercent}
                    setCityLabelTopPercent={setCityLabelTopPercent}
                    routeLabelBottomPercent={routeLabelBottomPercent}
                    setRouteLabelBottomPercent={setRouteLabelBottomPercent}
                    routeLabelSize={routeLabelSize}
                    setRouteLabelSize={setRouteLabelSize}
                    moodColorsEnabled={moodColorsEnabled}
                    setMoodColorsEnabled={setMoodColorsEnabled}
                    albumStyle={albumStyle}
                    setAlbumStyle={setAlbumStyle}
                    albumCaptionsEnabled={albumCaptionsEnabled}
                    setAlbumCaptionsEnabled={setAlbumCaptionsEnabled}
                  />
                </div>
              </div>
            </>
          )}

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

/* ------------------------------------------------------------------ */
/*  Shared settings controls used by both desktop dropdown and mobile */
/* ------------------------------------------------------------------ */

interface SettingsContentProps {
  mapStyle: MapStyle;
  setMapStyle: (v: MapStyle) => void;
  cityLabelLang: "en" | "zh";
  setCityLabelLang: (v: "en" | "zh") => void;
  cityLabelSize: number;
  setCityLabelSize: (v: number) => void;
  cityLabelTopPercent: number;
  setCityLabelTopPercent: (v: number) => void;
  routeLabelBottomPercent: number;
  setRouteLabelBottomPercent: (v: number) => void;
  routeLabelSize: number;
  setRouteLabelSize: (v: number) => void;
  moodColorsEnabled: boolean;
  setMoodColorsEnabled: (v: boolean) => void;
  albumStyle: AlbumStyle;
  setAlbumStyle: (v: AlbumStyle) => void;
  albumCaptionsEnabled: boolean;
  setAlbumCaptionsEnabled: (v: boolean) => void;
}

function SettingsContent({
  mapStyle,
  setMapStyle,
  cityLabelLang,
  setCityLabelLang,
  cityLabelSize,
  setCityLabelSize,
  cityLabelTopPercent,
  setCityLabelTopPercent,
  routeLabelBottomPercent,
  setRouteLabelBottomPercent,
  routeLabelSize,
  setRouteLabelSize,
  moodColorsEnabled,
  setMoodColorsEnabled,
  albumStyle,
  setAlbumStyle,
  albumCaptionsEnabled,
  setAlbumCaptionsEnabled,
}: SettingsContentProps) {
  return (
    <>
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
      <hr className="border-gray-100" />
      {/* Mood Colors toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Mood Colors
        </label>
        <p className="text-[11px] text-muted-foreground/70">
          Color route lines using dominant colors from attached photos
        </p>
        <div className="flex gap-2">
          {([
            { value: true, label: "On" },
            { value: false, label: "Off" },
          ] as const).map((opt) => (
            <button
              key={String(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                moodColorsEnabled === opt.value
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setMoodColorsEnabled(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <hr className="border-gray-100" />
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Album Style</label>
        <div className="grid grid-cols-2 gap-2">
          {ALBUM_STYLE_CONFIGS.map((config) => (
            <button
              key={config.id}
              className={`flex flex-col items-center gap-1.5 rounded-lg p-2 text-[10px] font-medium transition-colors ${
                albumStyle === config.id
                  ? "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setAlbumStyle(config.id)}
            >
              <div className="flex h-6 w-full overflow-hidden rounded">
                <span
                  className="flex-1"
                  style={{ backgroundColor: config.swatchColors[0] }}
                />
                <span
                  className="w-1 shrink-0"
                  style={{ backgroundColor: config.swatchColors[1] }}
                />
                <span
                  className="flex-1"
                  style={{ backgroundColor: config.swatchColors[0] }}
                />
              </div>
              <span className="w-full truncate text-center">{config.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Album Captions toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Album Captions</label>
        <p className="text-[11px] text-muted-foreground/70">
          Show photo captions inside the album book
        </p>
        <div className="flex gap-2">
          {([
            { value: true, label: "On" },
            { value: false, label: "Off" },
          ] as const).map((opt) => (
            <button
              key={String(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                albumCaptionsEnabled === opt.value
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setAlbumCaptionsEnabled(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
