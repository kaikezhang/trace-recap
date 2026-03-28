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

  private static readonly CODEC_CANDIDATES = [
    "avc1.42001f", // H.264 Baseline Level 3.1
    "avc1.4d0028", // H.264 Main Profile Level 4.0
    "avc1.640028", // H.264 High Profile Level 4.0
  ];

  private static detectedCodec: string | null = null;

  static async findSupportedCodec(
    config?: { width?: number; height?: number; fps?: number }
  ): Promise<string | null> {
    if (typeof VideoEncoder === "undefined") return null;
    const w = config?.width ?? 1280;
    const h = config?.height ?? 720;
    const f = config?.fps ?? 30;
    for (const codec of VideoExporter.CODEC_CANDIDATES) {
      try {
        const result = await VideoEncoder.isConfigSupported({
          codec, width: w, height: h, bitrate: 5_000_000, framerate: f,
        });
        if (result.supported) {
          VideoExporter.detectedCodec = codec;
          return codec;
        }
      } catch { /* skip */ }
    }
    return null;
  }

  static async isConfigSupported(
    config?: { width?: number; height?: number; fps?: number }
  ): Promise<boolean> {
    const codec = await VideoExporter.findSupportedCodec(config);
    return codec !== null;
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

    // Pre-warm: just render start and end to prime the cache
    console.log("[export] pre-warm start");
    this.engine.renderFrame(0);
    await this.waitForMapIdle();
    this.engine.renderFrame(totalDuration);
    await this.waitForMapIdle();
    console.log("[export] pre-warm done, starting capture of", totalFrames, "frames");

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

      if (i < 3 || i % 100 === 0) {
        console.log(`[export] frame ${i}/${totalFrames}, canvas ${canvas.width}x${canvas.height}`);
      }

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
    onProgress({ phase: "finalizing", current: 0, total: 1 });
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    onProgress({ phase: "finalizing", current: 1, total: 1 });

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
      // Timeout after 500ms to prevent hanging — tiles may not fully load but frame is still usable
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
