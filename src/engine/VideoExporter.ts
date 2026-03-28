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
  private abortController: AbortController | null = null;

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
    this.abortController?.abort();
  }

  async export(onProgress: ProgressCallback): Promise<Blob | null> {
    const { fps } = this.settings;
    this.cancelled = false;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);
    const canvas = this.map.getCanvas();

    // Pre-warm: render key positions to load tiles
    this.engine.renderFrame(0);
    await this.waitForMapIdle();
    await new Promise(r => setTimeout(r, 1000));
    this.engine.renderFrame(totalDuration * 0.25);
    await this.waitForMapIdle();
    this.engine.renderFrame(totalDuration * 0.5);
    await this.waitForMapIdle();
    this.engine.renderFrame(totalDuration * 0.75);
    await this.waitForMapIdle();
    this.engine.renderFrame(totalDuration);
    await this.waitForMapIdle();
    this.engine.renderFrame(0);
    await this.waitForMapIdle();

    // Start a server session
    const startRes = await fetch("/api/encode-video/start", {
      method: "POST",
      signal,
    });
    if (!startRes.ok) {
      throw new Error("Failed to start encoding session");
    }
    const { sessionId } = (await startRes.json()) as { sessionId: string };

    // Phase 1 & 2: Capture each frame and immediately upload it
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

      // Upload this frame immediately — no buffering
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("frameIndex", String(i + 1));
      formData.append("frame", blob, `frame${String(i + 1).padStart(5, "0")}.jpg`);

      const uploadRes = await fetch("/api/encode-video/frame", {
        method: "POST",
        body: formData,
        signal,
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload frame ${i + 1}`);
      }

      onProgress({
        phase: "capturing",
        current: i + 1,
        total: totalFrames,
      });
    }

    if (this.cancelled) return null;

    // Phase 3: Trigger server-side encoding
    onProgress({ phase: "encoding", current: 0, total: 1 });

    const response = await fetch("/api/encode-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, fps: String(fps) }),
      signal,
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
      // Force a repaint so tiles start loading
      this.map.triggerRepaint();

      const checkReady = () => {
        if (!this.map.isMoving() && this.map.areTilesLoaded()) {
          return true;
        }
        return false;
      };

      if (checkReady()) {
        resolve();
        return;
      }

      // Poll every 100ms until tiles loaded, with 5s max timeout
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        if (checkReady() || elapsed >= 5000) {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      // Also listen for idle event as a faster path
      const onIdle = () => {
        clearInterval(interval);
        resolve();
      };
      this.map.once("idle", onIdle);
    });
  }
}
