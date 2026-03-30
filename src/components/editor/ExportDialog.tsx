"use client";

import { useState, useRef, useCallback } from "react";
import {
  Download,
  X,
  AlertTriangle,
  Monitor,
  Smartphone,
  Check,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useMap } from "./MapContext";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { AnimationEngine } from "@/engine/AnimationEngine";
import { VideoExporter, type ExportProgress } from "@/engine/VideoExporter";
import type { AspectRatio, ExportSettings } from "@/types";
import { FPS } from "@/lib/constants";

function CircularProgress({ percent }: { percent: number }) {
  const r = 45;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="6"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#6366f1"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{percent}%</span>
      </div>
    </div>
  );
}

export default function ExportDialog() {
  const open = useUIStore((s) => s.exportDialogOpen);
  const setOpen = useUIStore((s) => s.setExportDialogOpen);
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);

  const cityLabelSize = useUIStore((s) => s.cityLabelSize);
  const setCityLabelSize = useUIStore((s) => s.setCityLabelSize);
  const cityLabelLang = useUIStore((s) => s.cityLabelLang);
  const setCityLabelLang = useUIStore((s) => s.setCityLabelLang);
  const aspectRatio = useUIStore((s) => s.exportAspectRatio) as AspectRatio;
  const setAspectRatio = useUIStore((s) => s.setExportAspectRatio);
  const [resolution, setResolution] = useState("720");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadSize, setDownloadSize] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [encodingMethod, setEncodingMethod] = useState<"webcodecs" | "server" | null>(null);
  const exporterRef = useRef<VideoExporter | null>(null);

  const startExport = useCallback(async (settings: ExportSettings) => {
    if (!map || segments.length === 0) return;

    setIsExporting(true);
    setDownloadUrl(null);
    setDownloadSize(null);
    setProgress(null);
    setExportError(null);
    setEncodingMethod(null);

    const engine = new AnimationEngine(map, locations, segments);
    const exporter = new VideoExporter(engine, map, {
      ...settings,
      cityLabelSize,
      cityLabelLang,
    });
    exporterRef.current = exporter;

    const handleProgress = (p: ExportProgress) => {
      setProgress(p);
      if (p.encodingMethod) setEncodingMethod(p.encodingMethod);
    };

    try {
      const blob = await exporter.export(handleProgress);

      if (blob) {
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        setDownloadSize(`${sizeMB} MB`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setProgress(null);
        return;
      }
      setExportError(
        error instanceof Error
          ? error.message
          : "Video export failed. Please try again."
      );
      setProgress(null);
    } finally {
      engine.destroy();
      setIsExporting(false);
      exporterRef.current = null;
    }
  }, [map, locations, segments, cityLabelSize, cityLabelLang]);

  const handleQuickExport = () => {
    void startExport({
      aspectRatio: "16:9",
      resolution: 720,
      fps: 24,
    });
  };

  const handleConfiguredExport = () => {
    void startExport({
      aspectRatio,
      resolution: parseInt(resolution, 10),
      fps: FPS,
    });
  };

  const handleCancel = () => {
    exporterRef.current?.cancel();
    setExportError(null);
    setIsExporting(false);
  };

  const handleClose = (newOpen: boolean) => {
    if (isExporting) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setDownloadSize(null);
    setProgress(null);
    setExportError(null);
    setOpen(newOpen);
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const phaseLabel = (phase: ExportProgress["phase"]) => {
    switch (phase) {
      case "capturing":
        return "Capturing frames...";
      case "uploading":
        return "Uploading to server...";
      case "encoding":
        return "Encoding video...";
      case "done":
        return "Done!";
    }
  };

  // Completion state
  if (downloadUrl) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Export Complete!</h3>
              {downloadSize && (
                <p className="text-sm text-muted-foreground mt-1">
                  File size: {downloadSize}
                </p>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <a href={downloadUrl} download="trace-recap.mp4" className="flex-1">
                <Button className="w-full bg-indigo-500 hover:bg-indigo-600">
                  <Download className="h-4 w-4 mr-2" />
                  Download MP4
                </Button>
              </a>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleClose(false)}
              >
                Close
              </Button>
            </div>
            {encodingMethod && (
              <p className="text-xs text-muted-foreground text-center">
                {encodingMethod === "webcodecs"
                  ? "Encoded locally with WebCodecs"
                  : "Encoded on server"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Exporting state with circular progress
  if (isExporting && progress) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-6 space-y-4">
            <CircularProgress percent={progressPercent} />
            <p className="text-sm text-muted-foreground">
              {phaseLabel(progress.phase)}
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancel}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Aspect ratio cards */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                  aspectRatio === "16:9"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-border hover:border-gray-300"
                }`}
                onClick={() => setAspectRatio("16:9")}
              >
                {aspectRatio === "16:9" && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <Monitor className="h-8 w-8 text-gray-600" />
                <span className="text-sm font-medium">Landscape</span>
                <span className="text-xs text-muted-foreground">16:9</span>
              </button>
              <button
                className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                  aspectRatio === "9:16"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-border hover:border-gray-300"
                }`}
                onClick={() => setAspectRatio("9:16")}
              >
                {aspectRatio === "9:16" && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <Smartphone className="h-8 w-8 text-gray-600" />
                <span className="text-sm font-medium">Portrait</span>
                <span className="text-xs text-muted-foreground">9:16</span>
              </button>
            </div>
          </div>

          {/* Quick Export button */}
          <Button
            className="w-full h-12 bg-indigo-500 hover:bg-indigo-600 text-base font-medium"
            onClick={handleQuickExport}
            disabled={segments.length === 0}
          >
            Quick Export (720p)
          </Button>

          {/* Advanced Settings toggle */}
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <span>Advanced Settings</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            />
          </button>

          {/* Advanced settings collapsible */}
          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-1">
                  {/* Resolution pills */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Resolution</label>
                    <div className="flex gap-2">
                      {["720", "1080"].map((res) => (
                        <button
                          key={res}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            resolution === res
                              ? "bg-indigo-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => setResolution(res)}
                        >
                          {res}p
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* City Label pills */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City Label</label>
                    <div className="flex gap-2">
                      {[
                        { value: "en", label: "English" },
                        { value: "zh", label: "中文" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            cityLabelLang === opt.value
                              ? "bg-indigo-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() =>
                            setCityLabelLang(opt.value as "en" | "zh")
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Label Size slider */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
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

                  <Button
                    className="h-11 w-full"
                    onClick={handleConfiguredExport}
                    disabled={segments.length === 0}
                  >
                    Start Export
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {exportError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
