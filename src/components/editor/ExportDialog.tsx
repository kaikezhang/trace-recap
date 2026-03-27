"use client";

import { useState, useRef, useCallback } from "react";
import { Download, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMap } from "./MapContext";
import { useProjectStore } from "@/stores/projectStore";
import { useAnimationStore } from "@/stores/animationStore";
import { useUIStore } from "@/stores/uiStore";
import { AnimationEngine } from "@/engine/AnimationEngine";
import { VideoExporter, type ExportProgress } from "@/engine/VideoExporter";
import type { AspectRatio, ExportSettings } from "@/types";
import { FPS } from "@/lib/constants";

export default function ExportDialog() {
  const open = useUIStore((s) => s.exportDialogOpen);
  const setOpen = useUIStore((s) => s.setExportDialogOpen);
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState("720");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const exporterRef = useRef<VideoExporter | null>(null);

  const handleExport = useCallback(async () => {
    if (!map || segments.length === 0) return;

    setIsExporting(true);
    setDownloadUrl(null);
    setProgress(null);

    const settings: ExportSettings = {
      aspectRatio,
      resolution: parseInt(resolution),
      fps: FPS,
    };

    const engine = new AnimationEngine(map, locations, segments);
    const exporter = new VideoExporter(engine, map, settings);
    exporterRef.current = exporter;

    const blob = await exporter.export(setProgress);
    engine.destroy();

    if (blob) {
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    }

    setIsExporting(false);
    exporterRef.current = null;
  }, [map, locations, segments, aspectRatio, resolution]);

  const handleCancel = () => {
    exporterRef.current?.cancel();
    setIsExporting(false);
  };

  const handleClose = (newOpen: boolean) => {
    if (isExporting) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setProgress(null);
    setOpen(newOpen);
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Aspect Ratio</label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => v && setAspectRatio(v as AspectRatio)}
              disabled={isExporting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                <SelectItem value="9:16">Portrait (9:16)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Resolution</label>
            <Select
              value={resolution}
              onValueChange={(v) => v && setResolution(v)}
              disabled={isExporting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720">720p</SelectItem>
                <SelectItem value="1080">1080p</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isExporting && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.phase === "capturing"
                    ? "Capturing frames..."
                    : progress.phase === "encoding"
                    ? "Encoding video..."
                    : "Done!"}
                </span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download="trace-recap.mp4"
                className="flex-1"
              >
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download MP4
                </Button>
              </a>
            ) : isExporting ? (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleExport}
                disabled={segments.length === 0}
              >
                <Loader2 className="h-4 w-4 mr-2 animate-spin hidden" />
                Start Export
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
