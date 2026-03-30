import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined"
  );
}

export interface WebCodecsExportOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
}

/**
 * Encodes frames from an offscreen canvas into an MP4 blob using WebCodecs + mp4-muxer.
 * Usage:
 *   const exporter = new WebCodecsExporter(options);
 *   for each frame: exporter.addFrame(canvas, frameIndex);
 *   const blob = await exporter.finalize();
 */
export class WebCodecsExporter {
  private muxer: Muxer<ArrayBufferTarget>;
  private encoder: VideoEncoder;
  private fps: number;
  private frameCount = 0;
  private encoderError: Error | null = null;

  constructor(options: WebCodecsExportOptions) {
    const { width, height, fps, bitrate = 5_000_000 } = options;
    this.fps = fps;

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",
        width,
        height,
      },
      fastStart: "in-memory",
    });

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        this.muxer.addVideoChunk(chunk, meta ?? undefined);
      },
      error: (e) => {
        this.encoderError = e;
      },
    });

    this.encoder.configure({
      codec: "avc1.42001f",
      width,
      height,
      bitrate,
      framerate: fps,
    });
  }

  addFrame(canvas: HTMLCanvasElement | OffscreenCanvas, frameIndex: number): void {
    if (this.encoderError) throw this.encoderError;

    const timestamp = frameIndex * (1_000_000 / this.fps);
    const frame = new VideoFrame(canvas, { timestamp });
    this.encoder.encode(frame, { keyFrame: frameIndex % 60 === 0 });
    frame.close();
    this.frameCount++;
  }

  async finalize(): Promise<Blob> {
    if (this.encoderError) throw this.encoderError;

    await this.encoder.flush();
    this.encoder.close();
    this.muxer.finalize();

    const buffer = this.muxer.target.buffer;
    return new Blob([buffer], { type: "video/mp4" });
  }
}
