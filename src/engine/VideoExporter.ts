import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type mapboxgl from "mapbox-gl";
import type { ExportSettings } from "@/types";
import { AnimationEngine } from "./AnimationEngine";

export type ExportProgress = {
  phase: "capturing" | "encoding" | "done";
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

    // Capture frames
    const frames: Uint8Array[] = [];

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

      const buffer = await blob.arrayBuffer();
      frames.push(new Uint8Array(buffer));

      onProgress({
        phase: "capturing",
        current: i + 1,
        total: totalFrames,
      });
    }

    if (this.cancelled) return null;

    // Encode with FFmpeg
    onProgress({ phase: "encoding", current: 0, total: 1 });

    const ffmpeg = new FFmpeg();
    await ffmpeg.load();

    // Write frames to virtual FS
    for (let i = 0; i < frames.length; i++) {
      const name = `frame${String(i).padStart(5, "0")}.jpg`;
      await ffmpeg.writeFile(name, frames[i]);
    }

    // Encode
    await ffmpeg.exec([
      "-framerate",
      String(fps),
      "-i",
      "frame%05d.jpg",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "fast",
      "-crf",
      "23",
      "output.mp4",
    ]);

    const data = await ffmpeg.readFile("output.mp4");
    ffmpeg.terminate();

    onProgress({ phase: "done", current: 1, total: 1 });

    const mp4Data = data instanceof Uint8Array
      ? new Uint8Array(data) as unknown as BlobPart
      : data as unknown as BlobPart;
    return new Blob([mp4Data], { type: "video/mp4" });
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
