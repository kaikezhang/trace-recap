"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Download,
  X,
  AlertTriangle,
  Check,
  Film,
  Monitor,
  Smartphone,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { getExportViewportSize } from "@/lib/viewportRatio";
import { FPS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";
import type { ExportResolution, ExportSettings } from "@/types";

const RESOLUTION_OPTIONS: Array<{
  value: ExportResolution;
  label: string;
  subtitle: string;
  pixels: string;
  icon: typeof Monitor;
}> = [
  { value: "720p", label: "HD", subtitle: "720p", pixels: "1280 × 720", icon: Smartphone },
  { value: "1080p", label: "Full HD", subtitle: "1080p", pixels: "1920 × 1080", icon: Monitor },
  { value: "4K", label: "Ultra HD", subtitle: "4K", pixels: "3840 × 2160", icon: Monitor },
];

function estimateExportSizeBytes(
  width: number,
  height: number,
  totalDuration: number,
): number {
  const bitrate = Math.min(
    4_000_000,
    Math.max(1_000_000, ((width * height) / (1920 * 1080)) * 2_000_000),
  );
  return (bitrate * totalDuration) / 8;
}

function formatEstimatedSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1024) {
    return `~${(megabytes / 1024).toFixed(1)} GB`;
  }
  if (megabytes >= 10) {
    return `~${Math.round(megabytes)} MB`;
  }
  return `~${megabytes.toFixed(1)} MB`;
}

function WarmProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full space-y-3">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-orange-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${brand.colors.primary[400]}, ${brand.colors.primary[500]}, ${brand.colors.primary[600]})`,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        <div
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
            animation: "shimmer 2s infinite",
          }}
        />
      </div>
      <div className="flex items-center justify-center">
        <span
          className="text-3xl font-bold tabular-nums"
          style={{ color: brand.colors.primary[600] }}
        >
          {percent}%
        </span>
      </div>
    </div>
  );
}

function CelebrationBurst() {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const distance = 40 + Math.random() * 20;
    const x = Math.cos((angle * Math.PI) / 180) * distance;
    const y = Math.sin((angle * Math.PI) / 180) * distance;
    const colors = [brand.colors.primary[400], brand.colors.ocean[400], brand.colors.sand[400]];
    const color = colors[i % colors.length];
    return { x, y, color, delay: i * 0.03, size: 3 + Math.random() * 4 };
  });

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            left: "50%",
            top: "50%",
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export default function ExportDialog() {
  const open = useUIStore((s) => s.exportDialogOpen);
  const setOpen = useUIStore((s) => s.setExportDialogOpen);
  const { map } = useMap();
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const segmentTimingOverrides = useProjectStore((s) => s.segmentTimingOverrides);

  const cityLabelSize = useUIStore((s) => s.cityLabelSize);
  const cityLabelLang = useUIStore((s) => s.cityLabelLang);
  const cityLabelTopPercent = useUIStore((s) => s.cityLabelTopPercent);
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const routeLabelSize = useUIStore((s) => s.routeLabelSize);
  const routeLabelBottomPercent = useUIStore((s) => s.routeLabelBottomPercent);
  const photoAnimation = useUIStore((s) => s.photoAnimation);
  const photoStyle = useUIStore((s) => s.photoStyle);
  const photoFrameStyle = useUIStore((s) => s.photoFrameStyle);

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadSize, setDownloadSize] = useState<string | null>(null);
  const [downloadExt, setDownloadExt] = useState<"mp4" | "webm">("mp4");
  const [exportError, setExportError] = useState<string | null>(null);
  const [encodingMethod, setEncodingMethod] = useState<"webcodecs" | "mediarecorder" | "server" | null>(null);
  const [resolution, setResolution] = useState<ExportResolution>("1080p");
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const exporterRef = useRef<VideoExporter | null>(null);

  useEffect(() => {
    if (!open || !map || segments.length === 0 || isExporting || downloadUrl) {
      setEstimatedDuration(null);
      return;
    }

    const engine = new AnimationEngine(map, locations, segments, segmentTimingOverrides);
    setEstimatedDuration(engine.getTotalDuration());

    return () => {
      engine.destroy();
    };
  }, [open, map, locations, segments, segmentTimingOverrides, isExporting, downloadUrl]);

  const startExport = useCallback(async (settings: ExportSettings) => {
    if (!map || segments.length === 0) return;

    setIsExporting(true);
    setDownloadUrl(null);
    setDownloadSize(null);
    setDownloadExt("mp4");
    setProgress(null);
    setExportError(null);
    setEncodingMethod(null);

    const engine = new AnimationEngine(map, locations, segments, segmentTimingOverrides);
    const exporter = new VideoExporter(engine, map, {
      ...settings,
      cityLabelSize,
      cityLabelLang,
      cityLabelTopPercent,
      viewportRatio,
      routeLabelSize,
      routeLabelBottomPercent,
      photoAnimation,
      photoStyle,
      photoFrameStyle,
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
        const ext = blob.type.includes("webm") ? "webm" : "mp4";
        setDownloadExt(ext);
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
  }, [map, locations, segments, segmentTimingOverrides, cityLabelSize, cityLabelLang, cityLabelTopPercent, viewportRatio, routeLabelSize, routeLabelBottomPercent, photoAnimation, photoStyle, photoFrameStyle]);

  const handleQuickExport = () => {
    void startExport({
      fps: FPS,
      resolution,
    });
  };

  const handleCancel = () => {
    exporterRef.current?.cancel();
    setExportError(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (isExporting) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setDownloadSize(null);
    setDownloadExt("mp4");
    setProgress(null);
    setExportError(null);
    if (!newOpen) {
      setResolution("1080p");
      setEstimatedDuration(null);
    }
    setOpen(newOpen);
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const canvas = map?.getCanvas();
  const estimatedViewport = canvas
    ? getExportViewportSize(
        viewportRatio,
        canvas.width,
        canvas.height,
        resolution,
      )
    : null;
  const estimatedSize = estimatedViewport && estimatedDuration !== null
    ? formatEstimatedSize(
        estimateExportSizeBytes(
          estimatedViewport.width,
          estimatedViewport.height,
          estimatedDuration,
        ),
      )
    : null;
  const estimatedSizeLabel =
    estimatedSize ?? (!canvas || segments.length === 0 ? "Unavailable" : "Calculating...");

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
        <DialogContent className="sm:max-w-md overflow-hidden">
          <motion.div
            className="flex flex-col items-center py-6 space-y-5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
              <motion.div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${brand.colors.primary[50]}, ${brand.colors.ocean[50]})`,
                  boxShadow: brand.shadows.glow,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              >
                <Check className="h-10 w-10" style={{ color: brand.colors.primary[500] }} />
              </motion.div>
              <CelebrationBurst />
            </div>
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-xl font-semibold" style={{ color: brand.colors.warm[800] }}>
                Your video is ready!
              </h3>
              {downloadSize && (
                <p className="text-sm mt-1" style={{ color: brand.colors.warm[500] }}>
                  {downloadSize}
                </p>
              )}
            </motion.div>
            <motion.div
              className="flex gap-3 w-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <a href={downloadUrl} download={`trace-recap.${downloadExt}`} className="flex-1">
                <Button
                  className="w-full h-12 text-base font-medium text-white"
                  style={{
                    background: `linear-gradient(135deg, ${brand.colors.primary[500]}, ${brand.colors.primary[600]})`,
                    boxShadow: `0 4px 14px 0 rgba(249, 115, 22, 0.3)`,
                  }}
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download {downloadExt.toUpperCase()}
                </Button>
              </a>
              <Button
                variant="outline"
                className="h-12 px-5"
                style={{ borderColor: brand.colors.warm[200] }}
                onClick={() => handleClose(false)}
              >
                Close
              </Button>
            </motion.div>
            {encodingMethod && (
              <p className="text-xs" style={{ color: brand.colors.warm[400] }}>
                {encodingMethod === "webcodecs"
                  ? "Encoded locally with WebCodecs"
                  : encodingMethod === "mediarecorder"
                  ? "Encoded locally with MediaRecorder"
                  : "Encoded on server"}
              </p>
            )}
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  }

  // Exporting state with warm progress bar
  if (isExporting && progress) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <motion.div
            className="flex flex-col items-center py-8 space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <Film className="h-8 w-8" style={{ color: brand.colors.primary[500] }} />
            </motion.div>
            <WarmProgressBar percent={progressPercent} />
            <p className="text-sm font-medium" style={{ color: brand.colors.warm[600] }}>
              {phaseLabel(progress.phase)}
            </p>
            <Button
              variant="outline"
              className="w-full"
              style={{ borderColor: brand.colors.warm[300], color: brand.colors.warm[600] }}
              onClick={handleCancel}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Export
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: brand.colors.primary[500] }} />
            <span>Export Your Recap</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <p className="text-sm" style={{ color: brand.colors.warm[500] }}>
            Choose a resolution and export your travel video.
          </p>

          {/* Resolution cards */}
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: brand.colors.warm[700] }}>
              Resolution
            </p>
            <div className="grid grid-cols-3 gap-2">
              {RESOLUTION_OPTIONS.map((option) => {
                const isSelected = resolution === option.value;
                const Icon = option.icon;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 transition-colors",
                      isSelected
                        ? "border-orange-400 bg-orange-50"
                        : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
                    )}
                    style={isSelected ? { boxShadow: `0 0 0 1px ${brand.colors.primary[200]}, ${brand.shadows.sm}` } : undefined}
                    onClick={() => setResolution(option.value)}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: isSelected ? brand.colors.primary[500] : brand.colors.warm[400] }}
                    />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: isSelected ? brand.colors.primary[700] : brand.colors.warm[700] }}
                    >
                      {option.label}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: isSelected ? brand.colors.primary[500] : brand.colors.warm[400] }}
                    >
                      {option.pixels}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Estimated info */}
          <div
            className="flex items-center justify-between rounded-lg px-4 py-3"
            style={{ backgroundColor: brand.colors.primary[50] }}
          >
            <span className="text-sm" style={{ color: brand.colors.warm[600] }}>
              Estimated size
            </span>
            <span className="text-sm font-semibold" style={{ color: brand.colors.primary[700] }}>
              {estimatedSizeLabel}
            </span>
          </div>

          <AnimatePresence>
            {resolution === "4K" && (
              <motion.p
                className="text-xs flex items-center gap-1.5 px-1"
                style={{ color: brand.colors.sand[700] }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: brand.colors.sand[600] }} />
                4K export may be slow on some devices
              </motion.p>
            )}
          </AnimatePresence>

          {/* Export button */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              className="w-full h-12 text-base font-medium text-white"
              style={{
                background: `linear-gradient(135deg, ${brand.colors.primary[500]}, ${brand.colors.primary[600]})`,
                boxShadow: `0 4px 14px 0 rgba(249, 115, 22, 0.25)`,
              }}
              onClick={handleQuickExport}
              disabled={segments.length === 0}
            >
              <Film className="h-5 w-5 mr-2" />
              Export Video
            </Button>
          </motion.div>

          {/* Error state */}
          <AnimatePresence>
            {exportError && (
              <motion.div
                className="flex flex-col gap-3 rounded-xl p-4"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.06)",
                  border: "1px solid rgba(239, 68, 68, 0.15)",
                }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                  <span>{exportError}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-end text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleQuickExport}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Retry
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
