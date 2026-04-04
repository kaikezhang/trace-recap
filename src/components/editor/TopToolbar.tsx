"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  Save,
  Share2,
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
  Menu,
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
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const addToast = useUIStore((s) => s.addToast);
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
    if ((!settingsOpen && !mobileMenuOpen) || !isMobile) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [settingsOpen, mobileMenuOpen, isMobile]);

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
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const routeFile = zip.file("route.json");
        if (!routeFile) throw new Error("No route.json in zip");
        const routeText = await routeFile.async("text");
        const data: ImportRouteData = JSON.parse(routeText);

        if (data.locations) {
          for (const loc of data.locations) {
            if (loc.photos) {
              for (const photo of loc.photos) {
                if (photo.url.startsWith("photos/")) {
                  const photoFile = zip.file(photo.url);
                  if (photoFile) {
                    const blob = await photoFile.async("blob");
                    const dataUrl = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onloadend = () => resolve(reader.result as string);
                      reader.readAsDataURL(blob);
                    });
                    photo.url = dataUrl;
                  }
                }
              }
            }
          }
        }

        await loadRouteData(data);
        void enrichChineseNames();
      } else {
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

    const locations = useProjectStore.getState().locations;
    const livePhotoUrlMap = new Map<string, string>();
    for (const loc of locations) {
      for (const photo of loc.photos) {
        livePhotoUrlMap.set(`${loc.name}:${photo.caption ?? ''}:${photo.focalPoint?.x ?? ''}:${photo.focalPoint?.y ?? ''}:${photo.url.slice(-40)}`, photo.url);
      }
    }

    let photoIndex = 0;

    for (let locIdx = 0; locIdx < routeData.locations.length; locIdx++) {
      const location = routeData.locations[locIdx];
      if (!location.photos) {
        continue;
      }

      const liveLoc = locations[locIdx];

      for (let pIdx = 0; pIdx < location.photos.length; pIdx++) {
        const photo = location.photos[pIdx];
        const filename = `photos/photo_${photoIndex++}.jpg`;
        try {
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
          if (blob.size < 1024) {
            console.warn(`Export: photo ${filename} too small (${blob.size}B), skipping`);
            continue;
          }
          zip.file(filename, blob);
          photo.url = filename;
        } catch {
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

  const handleShareLink = async () => {
    const url = window.location.href;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url, title: currentProjectName });
        addToast({
          title: "Link shared",
          description: "The current project link is ready to send.",
          variant: "success",
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast({
        title: "Link copied",
        description: "The current project URL was copied to your clipboard.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Failed to share the current project link.", error);
      addToast({
        title: "Could not share link",
        description: "Try copying the URL from your browser address bar.",
        variant: "error",
      });
    }
  };

  const saveStatusConfig = {
    saving: { color: "bg-orange-400", tooltip: "Saving..." },
    saved: { color: "bg-emerald-500", tooltip: "All changes saved" },
    error: { color: "bg-red-500", tooltip: "Error saving changes" },
  } as const;

  return (
    <>
      <TooltipProvider delay={300}>
        <div
          className="flex h-12 items-center justify-between px-3 md:px-4"
          style={{
            backgroundColor: "#fffbf5",
            borderBottom: "1px solid #e7e5e4",
          }}
        >
          {/* Left: panel toggle + breadcrumb + save dot */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex h-8 w-8"
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              aria-label={leftPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
              style={{ color: "#78716c" }}
            >
              {leftPanelOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>

            <Link
              href="/"
              className="text-sm md:text-base font-semibold tracking-tight hover:opacity-80 transition-opacity"
              style={{ color: "#1c1917" }}
            >
              TraceRecap
            </Link>

            <span className="text-xs select-none" style={{ color: "#d6d3d1" }}>/</span>

            <button
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm transition-colors max-w-[140px] md:max-w-[200px] hover:bg-stone-100"
              onClick={() => setProjectListOpen(true)}
              disabled={isSwitchingProject}
              style={{ color: "#78716c" }}
            >
              <span className="truncate">{currentProjectName}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </button>

            {/* Save status dot */}
            {saveStatus && saveStatus !== "idle" && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${saveStatusConfig[saveStatus].color} ${
                        saveStatus === "saving" ? "animate-pulse" : ""
                      }`}
                    />
                  }
                />
                <TooltipContent side="bottom" sideOffset={6}>
                  {saveStatusConfig[saveStatus].tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Right side — desktop */}
          <div className="hidden md:flex items-center">
            {/* Undo / Redo group */}
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={undo}
                      disabled={!canUndo}
                      aria-label="Undo"
                      style={{ color: "#78716c" }}
                    />
                  }
                >
                  <Undo2 className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={redo}
                      disabled={!canRedo}
                      aria-label="Redo"
                      style={{ color: "#78716c" }}
                    />
                  }
                >
                  <Redo2 className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
            </div>

            {/* Divider */}
            <div className="mx-2 h-5 w-px" style={{ backgroundColor: "#e7e5e4" }} />

            {/* More menu (Import, Save Route, Clear) */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="More options"
                          style={{ color: "#78716c" }}
                        />
                      }
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
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

            {/* Settings gear */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      ref={settingsButtonRef}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSettingsOpen((v) => !v)}
                      aria-label="Settings"
                      style={{ color: settingsOpen ? "#f97316" : "#78716c" }}
                    />
                  }
                >
                  <Settings className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>

              {/* Desktop settings panel */}
              {settingsOpen && !isMobile && (
                <div
                  ref={settingsPanelRef}
                  className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[80vh] overflow-y-auto rounded-xl p-5 space-y-5"
                  style={{
                    backgroundColor: "#fffbf5",
                    border: "1px solid #e7e5e4",
                    boxShadow: "0 8px 32px rgba(28, 25, 23, 0.08), 0 2px 8px rgba(28, 25, 23, 0.04)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: "#1c1917" }}>Settings</p>
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-stone-100 transition-colors"
                      style={{ color: "#78716c" }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                    viewportRatio={viewportRatio}
                    setViewportRatio={setViewportRatio}
                    ratioOptions={ratioOptions}
                    ratioLabels={ratioLabels}
                  />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-2 h-5 w-px" style={{ backgroundColor: "#e7e5e4" }} />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void handleShareLink()}
                    aria-label="Share project link"
                    style={{ color: "#78716c" }}
                  />
                }
              >
                <Share2 className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>Share link</TooltipContent>
            </Tooltip>

            {/* Export — primary CTA */}
            <button
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ backgroundColor: "#f97316" }}
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          {/* Right side — mobile */}
          <div className="flex md:hidden items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void handleShareLink()}
              aria-label="Share project link"
              style={{ color: "#78716c" }}
            >
              <Share2 className="h-4 w-4" />
            </Button>

            {/* Export — always visible on mobile */}
            <button
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: "#f97316" }}
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>

            {/* Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
              style={{ color: "#78716c" }}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </TooltipProvider>

      {/* Mobile bottom drawer */}
      {mobileMenuOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] max-h-[70vh] overflow-y-auto overscroll-contain rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]"
            style={{ backgroundColor: "#fffbf5", borderTop: "1px solid #e7e5e4" }}
          >
            <div className="sticky top-0 z-10 pt-3 pb-2 px-4 rounded-t-2xl" style={{ backgroundColor: "#fffbf5" }}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: "#d6d3d1" }} />
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "#1c1917" }}>Actions</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  style={{ color: "#78716c" }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="px-4 pb-6 space-y-1">
              <MobileActionButton
                icon={<Undo2 className="h-4 w-4" />}
                label="Undo"
                onClick={() => { undo(); setMobileMenuOpen(false); }}
                disabled={!canUndo}
              />
              <MobileActionButton
                icon={<Redo2 className="h-4 w-4" />}
                label="Redo"
                onClick={() => { redo(); setMobileMenuOpen(false); }}
                disabled={!canRedo}
              />
              <div className="my-2 h-px" style={{ backgroundColor: "#e7e5e4" }} />
              <MobileActionButton
                icon={<Upload className="h-4 w-4" />}
                label="Import Route"
                onClick={() => { fileInputRef.current?.click(); setMobileMenuOpen(false); }}
                disabled={isSwitchingProject}
              />
              <MobileActionButton
                icon={<Save className="h-4 w-4" />}
                label="Save Route"
                onClick={() => { void handleExportRoute(); setMobileMenuOpen(false); }}
              />
              <MobileActionButton
                icon={<Settings className="h-4 w-4" />}
                label="Settings"
                onClick={() => { setMobileMenuOpen(false); setSettingsOpen(true); }}
              />
              <div className="my-2 h-px" style={{ backgroundColor: "#e7e5e4" }} />
              <MobileActionButton
                icon={<Trash2 className="h-4 w-4" />}
                label="Clear Route"
                onClick={() => { setClearDialogOpen(true); setMobileMenuOpen(false); }}
                disabled={isSwitchingProject}
                destructive
              />
            </div>
          </div>
        </>
      )}

      {/* Mobile settings drawer */}
      {settingsOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/40"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]"
            style={{ backgroundColor: "#fffbf5", borderTop: "1px solid #e7e5e4" }}
          >
            <div className="sticky top-0 z-10 pt-3 pb-2 px-4 rounded-t-2xl" style={{ backgroundColor: "#fffbf5" }}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: "#d6d3d1" }} />
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "#1c1917" }}>Settings</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close settings"
                  style={{ color: "#78716c" }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="px-4 pb-8 space-y-5">
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
                viewportRatio={viewportRatio}
                setViewportRatio={setViewportRatio}
                ratioOptions={ratioOptions}
                ratioLabels={ratioLabels}
              />
            </div>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.zip"
        className="hidden"
        onChange={handleImport}
      />

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
/*  Mobile action button                                               */
/* ------------------------------------------------------------------ */

function MobileActionButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none"
      onClick={onClick}
      disabled={disabled}
      style={{ color: destructive ? "#ef4444" : "#1c1917" }}
    >
      <span style={{ color: destructive ? "#ef4444" : "#78716c" }}>{icon}</span>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings content — shared by desktop panel and mobile drawer       */
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
  viewportRatio: AspectRatio;
  setViewportRatio: (v: AspectRatio) => void;
  ratioOptions: AspectRatio[];
  ratioLabels: Record<AspectRatio, string>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: "#78716c" }}
    >
      {children}
    </h3>
  );
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
  viewportRatio,
  setViewportRatio,
  ratioOptions,
  ratioLabels,
}: SettingsContentProps) {
  return (
    <>
      {/* Aspect Ratio */}
      <div className="space-y-2.5">
        <SectionHeader>Aspect Ratio</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {ratioOptions.map((ratio) => (
            <button
              key={ratio}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
              style={
                viewportRatio === ratio
                  ? { backgroundColor: "#f97316", color: "#fff" }
                  : { backgroundColor: "#f5f5f4", color: "#57534e" }
              }
              onMouseEnter={(e) => {
                if (viewportRatio !== ratio) {
                  e.currentTarget.style.backgroundColor = "#e7e5e4";
                }
              }}
              onMouseLeave={(e) => {
                if (viewportRatio !== ratio) {
                  e.currentTarget.style.backgroundColor = "#f5f5f4";
                }
              }}
              onClick={() => setViewportRatio(ratio)}
            >
              {ratioLabels[ratio]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px" style={{ backgroundColor: "#e7e5e4" }} />

      {/* Map Style */}
      <div className="space-y-3">
        <SectionHeader>Map Style</SectionHeader>
        {(["classic", "navigation", "creative"] as MapStyleCategory[]).map((cat) => {
          const styles = MAP_STYLE_CONFIGS.filter((c) => c.category === cat);
          return (
            <div key={cat} className="space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#a8a29e" }}>
                {MAP_STYLE_CATEGORY_LABELS[cat]}
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {styles.map((cfg) => (
                  <button
                    key={cfg.id}
                    className="flex flex-col items-center gap-1 rounded-lg p-1.5 text-[10px] font-medium transition-colors"
                    style={
                      mapStyle === cfg.id
                        ? { backgroundColor: "#fff7ed", color: "#c2410c", boxShadow: "inset 0 0 0 2px #f97316" }
                        : { backgroundColor: "#f5f5f4", color: "#57534e" }
                    }
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

      <div className="h-px" style={{ backgroundColor: "#e7e5e4" }} />

      {/* City Labels */}
      <div className="space-y-3">
        <SectionHeader>City Labels</SectionHeader>
        {/* Language toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "#57534e" }}>Language</label>
          <div className="flex gap-2">
            {([
              { value: "en", label: "English" },
              { value: "zh", label: "中文" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                className="px-3.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={
                  cityLabelLang === opt.value
                    ? { backgroundColor: "#f97316", color: "#fff" }
                    : { backgroundColor: "#f5f5f4", color: "#57534e" }
                }
                onClick={() => setCityLabelLang(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {/* Label size */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "#57534e" }}>
            Size: {cityLabelSize}px
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
        {/* Label position */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "#57534e" }}>
            Position: {cityLabelTopPercent}%
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
      </div>

      <div className="h-px" style={{ backgroundColor: "#e7e5e4" }} />

      {/* Route Labels */}
      <div className="space-y-3">
        <SectionHeader>Route Labels</SectionHeader>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "#57534e" }}>
            Position: {routeLabelBottomPercent}%
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "#57534e" }}>
            Size: {routeLabelSize}px
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

      <div className="h-px" style={{ backgroundColor: "#e7e5e4" }} />

      {/* Mood Colors */}
      <div className="space-y-2">
        <SectionHeader>
          <span className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Mood Colors
          </span>
        </SectionHeader>
        <p className="text-[11px]" style={{ color: "#a8a29e" }}>
          Color route lines using dominant colors from attached photos
        </p>
        <div className="flex gap-2">
          {([
            { value: true, label: "On" },
            { value: false, label: "Off" },
          ] as const).map((opt) => (
            <button
              key={String(opt.value)}
              className="px-3.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={
                moodColorsEnabled === opt.value
                  ? { backgroundColor: "#f97316", color: "#fff" }
                  : { backgroundColor: "#f5f5f4", color: "#57534e" }
              }
              onClick={() => setMoodColorsEnabled(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px" style={{ backgroundColor: "#e7e5e4" }} />

      {/* Album Style */}
      <div className="space-y-3">
        <SectionHeader>Album Style</SectionHeader>
        <div className="grid grid-cols-2 gap-2">
          {ALBUM_STYLE_CONFIGS.map((config) => (
            <button
              key={config.id}
              className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-[10px] font-medium transition-colors"
              style={
                albumStyle === config.id
                  ? { backgroundColor: "#fff7ed", color: "#c2410c", boxShadow: "inset 0 0 0 2px #f97316" }
                  : { backgroundColor: "#f5f5f4", color: "#57534e" }
              }
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

      {/* Album Captions */}
      <div className="space-y-2">
        <label className="text-xs font-medium" style={{ color: "#57534e" }}>Album Captions</label>
        <p className="text-[11px]" style={{ color: "#a8a29e" }}>
          Show photo captions inside the album book
        </p>
        <div className="flex gap-2">
          {([
            { value: true, label: "On" },
            { value: false, label: "Off" },
          ] as const).map((opt) => (
            <button
              key={String(opt.value)}
              className="px-3.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={
                albumCaptionsEnabled === opt.value
                  ? { backgroundColor: "#f97316", color: "#fff" }
                  : { backgroundColor: "#f5f5f4", color: "#57534e" }
              }
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
