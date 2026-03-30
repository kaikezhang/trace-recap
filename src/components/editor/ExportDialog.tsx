"use client";

import { useState, useRef, useCallback } from "react";
import {
  Download,
  X,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMap } from "./MapContext";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { AnimationEngine } from "@/engine/AnimationEngine";
import { VideoExporter, type ExportProgress } from "@/engine/VideoExporter";
import type { ExportSettings } from "@/types";
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
  const cityLabelLang = useUIStore((s) => s.cityLabelLang);
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const routeLabelSize = useUIStore((s) => s.routeLabelSize);
  const routeLabelBottomPercent = useUIStore((s) => s.routeLabelBottomPercent);
  const photoAnimation = useUIStore((s) => s.photoAnimation);

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
      viewportRatio,
      routeLabelSize,
      routeLabelBottomPercent,
      photoAnimation,
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
  }, [map, locations, segments, cityLabelSize, cityLabelLang, viewportRatio, routeLabelSize, routeLabelBottomPercent, photoAnimation]);

  const handleQuickExport = () => {
    void startExport({
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
          <p className="text-sm text-muted-foreground">
            Exports exactly what you see — the viewport ratio controls the video dimensions.
          </p>

          {/* Quick Export button */}
          <Button
            className="w-full h-12 bg-indigo-500 hover:bg-indigo-600 text-base font-medium"
            onClick={handleQuickExport}
            disabled={segments.length === 0}
          >
            Export Video
          </Button>

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
