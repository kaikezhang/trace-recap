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

type VideoEncoderProbeConfig = {
  width: number;
  height: number;
  fps: number;
};

export class VideoExporter {
  private static readonly BITRATE = 5_000_000;
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

  static async findSupportedCodec(
    config?: { width?: number; height?: number; fps?: number }
  ): Promise<string | null> {
    if (typeof window === "undefined" || typeof VideoEncoder === "undefined") {
      console.log("[codec] VideoEncoder not available (SSR or unsupported browser)");
      return null;
    }
    console.log("[codec] VideoEncoder available, testing codecs...");
    const w = config?.width ?? 1280;
    const h = config?.height ?? 720;
    const f = config?.fps ?? 30;
    for (const codec of VideoExporter.CODEC_CANDIDATES) {
      try {
        const result = await VideoEncoder.isConfigSupported({
          codec,
          width: w,
          height: h,
          bitrate: VideoExporter.BITRATE,
          framerate: f,
        });
        console.log('[codec]', codec, w + 'x' + h, '→', result.supported);
        if (result.supported) {
          return codec;
        }
      } catch (e) {
        console.log('[codec] ' + codec + ' error:', e);
      }
    }
    console.log('[codec] No supported codec found for', w, 'x', h, '@', f, 'fps');
    return null;
  }

  static async isConfigSupported(
    config?: { width?: number; height?: number; fps?: number }
  ): Promise<boolean> {
    const codec = await VideoExporter.findSupportedCodec(config);
    return codec !== null;
  }

  async export(onProgress: ProgressCallback): Promise<Blob | null> {
    const { width, height, fps } = this.getEncoderProbeConfig();
    const codec = await VideoExporter.findSupportedCodec({ width, height, fps });

    if (!codec) {
      throw new Error(
        "Your browser doesn't support video encoding for this export. Try Chrome or Edge, or use a smaller export size."
      );
    }

    this.cancelled = false;
    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);
    const canvas = this.map.getCanvas();

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
      error: (error) => {
        encoderError = VideoExporter.toError(
          error,
          `Video encoder failed while using codec ${codec}.`
        );
        console.error("[export] encoder error", {
          codec,
          width,
          height,
          fps,
          error: encoderError,
        });
      },
    });

    console.log("[export] configuring encoder", {
      codec,
      width,
      height,
      fps,
    });
    try {
      encoder.configure({
        codec,
        width,
        height,
        bitrate: VideoExporter.BITRATE,
        framerate: fps,
      });
    } catch (error) {
      const configureError = VideoExporter.toError(
        error,
        `Failed to configure the video encoder with codec ${codec}.`
      );
      console.error("[export] encoder.configure failed", {
        codec,
        width,
        height,
        fps,
        error: configureError,
      });
      VideoExporter.safeCloseEncoder(encoder);
      throw new Error(
        `Failed to configure video export with codec ${codec}. Try Chrome or Edge, or use a smaller export size.`
      );
    }

    // Wait a tick for async configure errors to surface
    await new Promise((r) => setTimeout(r, 100));
    if (encoder.state === "closed" || encoderError) {
      console.error("[export] encoder closed after configure", encoderError);
      throw new Error(
        `Video encoder closed unexpectedly after configure. Codec: ${codec}. ${encoderError?.message || ""}`
      );
    }
    console.log("[export] encoder ready, state:", encoder.state);

    await Promise.resolve();
    if (encoderError) {
      VideoExporter.safeCloseEncoder(encoder);
      throw encoderError;
    }

    // Pre-warm: just render start and end to prime the cache
    console.log("[export] pre-warm start");
    this.engine.renderFrame(0);
    await this.waitForMapIdle();
    this.engine.renderFrame(totalDuration);
    await this.waitForMapIdle();
    console.log("[export] pre-warm done, starting capture of", totalFrames, "frames");

    if (encoderError) {
      VideoExporter.safeCloseEncoder(encoder);
      throw encoderError;
    }

    // Capture and encode frames
    for (let i = 0; i < totalFrames; i++) {
      if (this.cancelled) {
        VideoExporter.safeCloseEncoder(encoder);
        return null;
      }

      if (encoderError) {
        VideoExporter.safeCloseEncoder(encoder);
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

      try {
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      } catch (error) {
        const encodeError =
          encoderError ??
          VideoExporter.toError(error, "Video encoder encode failed.");
        console.error("[export] encoder.encode failed", {
          codec,
          width,
          height,
          fps,
          frame: i,
          error: encodeError,
        });
        VideoExporter.safeCloseEncoder(encoder);
        throw encodeError;
      } finally {
        frame.close();
      }

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
      VideoExporter.safeCloseEncoder(encoder);
      return null;
    }

    // Finalizing phase: flush encoder and mux remaining data
    onProgress({ phase: "finalizing", current: 0, total: 1 });
    try {
      await encoder.flush();
    } catch (error) {
      const flushError =
        encoderError ??
        VideoExporter.toError(error, "Video encoder flush failed.");
      console.error("[export] encoder.flush failed", {
        codec,
        width,
        height,
        fps,
        error: flushError,
      });
      throw flushError;
    } finally {
      VideoExporter.safeCloseEncoder(encoder);
    }

    if (encoderError) {
      throw encoderError;
    }

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

  private getEncoderProbeConfig(): VideoEncoderProbeConfig {
    const canvas = this.map.getCanvas();

    return {
      width: canvas.width,
      height: canvas.height,
      fps: this.settings.fps,
    };
  }

  private static safeCloseEncoder(encoder: VideoEncoder) {
    if (encoder.state === "closed") {
      return;
    }

    try {
      encoder.close();
    } catch (error) {
      console.error("[export] encoder.close failed", error);
    }
  }

  private static toError(error: unknown, fallbackMessage: string): Error {
    return error instanceof Error ? error : new Error(fallbackMessage);
  }
}
