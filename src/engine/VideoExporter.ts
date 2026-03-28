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
    const { fps } = this.settings;
    this.cancelled = false;
    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);
    const canvas = this.map.getCanvas();

    // Pre-warm: render start and end to prime the cache
    this.engine.renderFrame(0);
    await this.waitForMapIdle();
    this.engine.renderFrame(totalDuration);
    await this.waitForMapIdle();

    // Phase 1: Capture frames as JPEG blobs
    const frames: Blob[] = [];

    for (let i = 0; i < totalFrames; i++) {
      if (this.cancelled) return null;

      const time = i / fps;
      const progress = time / totalDuration;
      this.engine.seekTo(Math.min(progress, 1));

      await this.waitForMapIdle();

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Frame capture failed"))),
          "image/jpeg",
          0.92
        );
      });

      frames.push(blob);

      onProgress({
        phase: "capturing",
        current: i + 1,
        total: totalFrames,
      });
    }

    if (this.cancelled) return null;

    // Phase 2: Upload frames to server
    onProgress({ phase: "uploading", current: 0, total: 1 });

    const formData = new FormData();
    formData.append("fps", String(fps));
    formData.append("width", String(canvas.width));
    formData.append("height", String(canvas.height));

    for (let i = 0; i < frames.length; i++) {
      const padded = String(i + 1).padStart(5, "0");
      formData.append(`frame_${padded}`, frames[i], `frame${padded}.jpg`);
    }

    onProgress({ phase: "uploading", current: 1, total: 2 });

    // Phase 3: Send to server for encoding
    onProgress({ phase: "encoding", current: 0, total: 1 });

    const response = await fetch("/api/encode-video", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server encoding failed: ${text}`);
    }

    onProgress({ phase: "encoding", current: 1, total: 1 });

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
      const timeout = setTimeout(() => {
        this.map.off("idle", onIdle);
        resolve();
      }, 500);
      const onIdle = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.map.once("idle", onIdle);
    });
  }
}
