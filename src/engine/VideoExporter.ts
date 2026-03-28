import type mapboxgl from "mapbox-gl";
import type { ExportSettings } from "@/types";
import { AnimationEngine } from "./AnimationEngine";

export type ExportProgress = {
  phase: "capturing" | "uploading" | "encoding" | "done";
  current: number;
  total: number;
};

type ProgressCallback = (progress: ExportProgress) => void;

export class VideoExporter {
  private engine: AnimationEngine;
  private map: mapboxgl.Map;
  private settings: ExportSettings;
  private cancelled = false;

  constructor(
    engine: AnimationEngine,
    map: mapboxgl.Map,
    settings: ExportSettings
  ) {
    this.engine = engine;
    this.map = map;
    this.settings = settings;
  }

  cancel() {
    this.cancelled = true;
  }

  async export(onProgress: ProgressCallback): Promise<Blob | null> {
    this.cancelled = false;
    const { fps } = this.settings;
    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);

    // Pre-warm tile cache by quickly scrubbing through the animation
    for (let i = 0; i <= 5; i++) {
      this.engine.renderFrame((i / 5) * totalDuration);
      await this.waitForMapIdle();
    }

    // Capture frames as blobs
    const frameBlobs: Blob[] = [];

    for (let i = 0; i < totalFrames; i++) {
      if (this.cancelled) return null;

      const time = i / fps;
      const progress = time / totalDuration;
      this.engine.seekTo(Math.min(progress, 1));

      await this.waitForMapIdle();

      const canvas = this.map.getCanvas();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );

      if (!blob) continue;

      frameBlobs.push(blob);

      onProgress({
        phase: "capturing",
        current: i + 1,
        total: totalFrames,
      });
    }

    if (this.cancelled) return null;

    // Upload frames to server for encoding
    onProgress({ phase: "uploading", current: 0, total: 1 });

    const formData = new FormData();
    formData.append("fps", String(fps));
    for (const blob of frameBlobs) {
      formData.append("frames", blob, "frame.jpg");
    }

    onProgress({ phase: "encoding", current: 0, total: 1 });

    const response = await fetch("/api/encode-video", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Encoding failed: ${response.statusText}`);
    }

    const mp4Blob = await response.blob();

    onProgress({ phase: "done", current: 1, total: 1 });

    return mp4Blob;
  }

  private waitForMapIdle(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.map.isMoving() && this.map.areTilesLoaded()) {
        resolve();
        return;
      }
      // Timeout after 2s to prevent infinite hang
      const timeout = setTimeout(() => {
        this.map.off("idle", onIdle);
        resolve();
      }, 2000);
      const onIdle = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.map.once("idle", onIdle);
    });
  }
}
