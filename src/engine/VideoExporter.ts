import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type mapboxgl from "mapbox-gl";
import type { ExportSettings } from "@/types";
import { AnimationEngine } from "./AnimationEngine";

export type ExportProgress = {
  phase: "capturing" | "finalizing" | "done";
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

  static async isConfigSupported(): Promise<boolean> {
    if (typeof VideoEncoder === "undefined") return false;
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec: "avc1.640028",
        width: 1280,
        height: 720,
        bitrate: 5_000_000,
        framerate: 30,
      });
      return result.supported === true;
    } catch {
      return false;
    }
  }

  async export(onProgress: ProgressCallback): Promise<Blob | null> {
    if (!(await VideoExporter.isConfigSupported())) {
      throw new Error(
        "Your browser doesn't support video encoding. Please use Chrome or Edge."
      );
    }

    this.cancelled = false;
    const { fps } = this.settings;
    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);

    const canvas = this.map.getCanvas();
    const width = canvas.width;
    const height = canvas.height;

    // Setup MP4 muxer
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",
        width,
        height,
      },
      fastStart: "in-memory",
    });

    // Setup VideoEncoder
    let encoderError: Error | null = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => {
        encoderError = e;
      },
    });

    encoder.configure({
      codec: "avc1.640028", // H.264 High Profile Level 4.0
      width,
      height,
      bitrate: 5_000_000,
      framerate: fps,
    });

    // Pre-warm tile cache by quickly scrubbing through the animation
    for (let i = 0; i <= 5; i++) {
      this.engine.renderFrame((i / 5) * totalDuration);
      await this.waitForMapIdle();
    }

    // Capture and encode frames
    for (let i = 0; i < totalFrames; i++) {
      if (this.cancelled) {
        encoder.close();
        return null;
      }

      if (encoderError) {
        encoder.close();
        throw encoderError;
      }

      const time = i / fps;
      const progress = time / totalDuration;
      this.engine.seekTo(Math.min(progress, 1));

      await this.waitForMapIdle();

      const frame = new VideoFrame(canvas, {
        timestamp: i * (1_000_000 / fps),
      });

      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      // Backpressure: wait for encoder queue to drain if too large
      if (encoder.encodeQueueSize > 5) {
        await new Promise<void>((resolve) => {
          const check = () => {
            if (encoder.encodeQueueSize <= 2) {
              encoder.removeEventListener("dequeue", check);
              resolve();
            }
          };
          encoder.addEventListener("dequeue", check);
          // Check immediately in case it already drained
          check();
        });
      }

      onProgress({
        phase: "capturing",
        current: i + 1,
        total: totalFrames,
      });
    }

    if (this.cancelled) {
      encoder.close();
      return null;
    }

    // Finalizing phase: flush encoder and mux remaining data
    onProgress({ phase: "finalizing", current: 1, total: 1 });
    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    onProgress({ phase: "done", current: 1, total: 1 });

    return new Blob([buffer], { type: "video/mp4" });
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
