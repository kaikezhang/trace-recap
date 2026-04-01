/**
 * MediaRecorder-based video exporter — fallback for browsers (especially iOS Safari)
 * that lack WebCodecs support but do support MediaRecorder + canvas.captureStream().
 *
 * Uses captureStream(0) for manual per-frame control: each frame is explicitly
 * pushed via requestFrame() with wall-clock delays to maintain correct fps timing.
 */

/** Extended track type for canvas capture streams (not in default TS lib) */
interface CanvasCaptureTrack extends MediaStreamTrack {
  requestFrame(): void;
}

export interface MediaRecorderExportOptions {
  width: number;
  height: number;
  fps: number;
  videoBitsPerSecond?: number;
}

/**
 * Detect whether MediaRecorder + canvas.captureStream(0) is available.
 * Returns the best supported MIME type, or null if unsupported.
 */
export function getMediaRecorderMimeType(): string | null {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function"
  ) {
    return null;
  }

  // Prefer MP4 (iOS Safari 17.1+), then WebM VP9, then WebM VP8
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return null;
}

export function isMediaRecorderSupported(): boolean {
  return getMediaRecorderMimeType() !== null;
}

/**
 * Encodes frames from a canvas into a video blob using MediaRecorder.
 *
 * Flow:
 *   const exporter = new MediaRecorderExporter(canvas, options);
 *   exporter.start();
 *   for each frame: draw to canvas, then await exporter.captureFrame();
 *   const blob = await exporter.finalize();
 */
export class MediaRecorderExporter {
  private canvas: HTMLCanvasElement;
  private stream: MediaStream;
  private track: CanvasCaptureTrack;
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private fps: number;
  private mimeType: string;
  private frameInterval: number; // ms between frames
  private frameCount = 0;
  private startTime = 0;
  private stopped = false;

  constructor(canvas: HTMLCanvasElement, options: MediaRecorderExportOptions) {
    const { width, height, fps } = options;
    // Auto bitrate: ~2 Mbps for 1080p, scale proportionally
    const pixels = (width ?? canvas.width) * (height ?? canvas.height);
    const defaultBps = Math.round(Math.max(1_000_000, Math.min(4_000_000, (pixels / (1920 * 1080)) * 2_000_000)));
    const videoBitsPerSecond = options.videoBitsPerSecond ?? defaultBps;
    this.canvas = canvas;
    this.fps = fps;
    this.frameInterval = 1000 / fps;

    const mimeType = getMediaRecorderMimeType();
    if (!mimeType) {
      throw new Error("MediaRecorder: no supported video MIME type found");
    }
    this.mimeType = mimeType;

    // captureStream(0) = manual frame capture — no automatic frame emission
    this.stream = canvas.captureStream(0);
    this.track = this.stream.getVideoTracks()[0] as CanvasCaptureTrack;

    if (typeof this.track.requestFrame !== "function") {
      throw new Error("MediaRecorder: CanvasCaptureMediaStreamTrack.requestFrame not available");
    }

    this.recorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond,
    });

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
  }

  /** The MIME type selected by this exporter (e.g. "video/mp4" or "video/webm"). */
  get selectedMimeType(): string {
    return this.mimeType;
  }

  /** Start recording. Must be called before captureFrame(). */
  start(): void {
    // timeslice = 1000ms — request data every second to avoid OOM on long videos
    this.recorder.start(1000);
    this.frameCount = 0;
    this.startTime = performance.now();
  }

  /**
   * Capture the current canvas state as a video frame.
   * Uses a virtual clock (frame count × frame interval) so export duration
   * is deterministic regardless of device render speed.
   */
  async captureFrame(): Promise<void> {
    // Virtual target: where the clock *should* be for this frame
    const targetTime = this.startTime + this.frameCount * this.frameInterval;
    const now = performance.now();
    const wait = targetTime - now;
    if (wait > 1) {
      await new Promise<void>((r) => setTimeout(r, wait));
    }

    this.track.requestFrame();
    this.frameCount++;
  }

  /** Release all resources (recorder, stream tracks). Safe to call multiple times. */
  cleanup(): void {
    if (this.stopped) return;
    this.stopped = true;

    try {
      if (this.recorder.state !== "inactive") {
        this.recorder.stop();
      }
    } catch {
      // Ignore — recorder may already be stopped
    }

    this.stream.getTracks().forEach((t) => t.stop());
  }

  /** Stop recording and return the final video blob. */
  async finalize(): Promise<Blob> {
    if (this.stopped) {
      throw new Error("MediaRecorderExporter already finalized");
    }

    // Capture one last frame to flush
    this.track.requestFrame();

    return new Promise<Blob>((resolve, reject) => {
      this.recorder.onstop = () => {
        this.stopped = true;
        this.stream.getTracks().forEach((t) => t.stop());

        if (this.chunks.length === 0) {
          reject(new Error("MediaRecorder produced no data"));
          return;
        }
        const blob = new Blob(this.chunks, { type: this.mimeType });
        resolve(blob);
      };

      this.recorder.onerror = (e) => {
        this.stopped = true;
        this.stream.getTracks().forEach((t) => t.stop());
        reject(new Error(`MediaRecorder error: ${(e as ErrorEvent).message ?? "unknown"}`));
      };

      this.recorder.stop();
    });
  }
}
