import * as turf from "@turf/turf";
import type mapboxgl from "mapbox-gl";
import type { ExportSettings, TransportMode } from "@/types";
import { AnimationEngine } from "./AnimationEngine";
import type { AnimationEvent } from "./AnimationEngine";
import {
  setSegmentSourceData,
  SEGMENT_LAYER_PREFIX,
  SEGMENT_GLOW_LAYER_PREFIX,
  SEGMENT_SOURCE_PREFIX,
} from "@/components/editor/routeSegmentSources";

export type ExportProgress = {
  phase: "capturing" | "uploading" | "encoding" | "done";
  current: number;
  total: number;
};

type ProgressCallback = (progress: ExportProgress) => void;

const TRANSPORT_MODES: TransportMode[] = [
  "flight", "car", "train", "bus", "ferry", "walk", "bicycle",
];
const DIRECTIONS = ["right", "down", "left", "up"] as const;

export class VideoExporter {
  private engine: AnimationEngine;
  private map: mapboxgl.Map;
  private settings: ExportSettings;
  private cancelled = false;
  private abortController: AbortController | null = null;
  private iconImages: Map<string, HTMLImageElement> = new Map();

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

  /** Pre-load all vehicle icon images so they're ready for canvas compositing */
  private async preloadIcons(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const mode of TRANSPORT_MODES) {
      for (const dir of DIRECTIONS) {
        const src = `/icons/${mode}-${dir}.png`;
        const key = src;
        if (this.iconImages.has(key)) continue;
        promises.push(
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.iconImages.set(key, img);
              // Also store under the browser-resolved absolute URL so
              // lookups via IconAnimator.getState().iconSrc (absolute) hit the cache.
              if (img.src !== key) {
                this.iconImages.set(img.src, img);
              }
              resolve();
            };
            img.onerror = () => {
              // Not fatal — icon just won't appear for this variant
              resolve();
            };
            img.src = src;
          })
        );
      }
    }
    await Promise.all(promises);
  }

  /** Hide all segment layers and reset source data before export starts */
  private hideAllSegments(): void {
    const segments = this.engine.getSegments();
    for (const seg of segments) {
      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      if (this.map.getLayer(layerId))
        this.map.setLayoutProperty(layerId, "visibility", "none");
      if (this.map.getLayer(glowLayerId))
        this.map.setLayoutProperty(glowLayerId, "visibility", "none");
      setSegmentSourceData(this.map, seg.id, null);
    }
  }

  /** Restore all segments to fully visible with full geometry */
  private restoreAllSegments(): void {
    const segments = this.engine.getSegments();
    for (const seg of segments) {
      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      if (this.map.getLayer(layerId))
        this.map.setLayoutProperty(layerId, "visibility", "visible");
      if (this.map.getLayer(glowLayerId))
        this.map.setLayoutProperty(glowLayerId, "visibility", "visible");
      setSegmentSourceData(this.map, seg.id, seg.geometry);
    }
  }

  /**
   * Apply route draw progress — replicates EditorLayout's routeDrawProgress handler.
   * Called after each renderFrame to update segment source data on the map.
   */
  private applyRouteDrawProgress(event: AnimationEvent): void {
    const segments = this.engine.getSegments();
    const fraction = event.routeDrawFraction ?? 0;
    const groupSegIndices = event.groupSegmentIndices;

    // Show all segments from past groups (fully drawn)
    const firstGroupSegIdx = groupSegIndices[0];
    for (let i = 0; i < firstGroupSegIdx; i++) {
      const pastSeg = segments[i];
      const pastLid = SEGMENT_LAYER_PREFIX + pastSeg.id;
      const pastGlid = SEGMENT_GLOW_LAYER_PREFIX + pastSeg.id;
      if (this.map.getLayer(pastLid))
        this.map.setLayoutProperty(pastLid, "visibility", "visible");
      if (this.map.getLayer(pastGlid))
        this.map.setLayoutProperty(pastGlid, "visibility", "visible");
      setSegmentSourceData(this.map, pastSeg.id, pastSeg.geometry);
    }

    // For the current group, compute how the merged fraction maps to individual segments
    const group = this.engine.getGroups()[event.groupIndex];
    if (!group) return;
    const mergedGeom = group.mergedGeometry;
    const mergedLength =
      mergedGeom && mergedGeom.coordinates.length > 1
        ? turf.length(turf.lineString(mergedGeom.coordinates))
        : 0;

    let accumulatedLength = 0;
    const drawnDistance = fraction * mergedLength;

    for (let gi = 0; gi < groupSegIndices.length; gi++) {
      const segIdx = groupSegIndices[gi];
      const seg = segments[segIdx];
      if (!seg?.geometry || seg.geometry.coordinates.length < 2) continue;
      if (!this.map.getSource(`${SEGMENT_SOURCE_PREFIX}${seg.id}`)) continue;

      const segLength = turf.length(turf.lineString(seg.geometry.coordinates));
      const segStart = accumulatedLength;
      const segEnd = accumulatedLength + segLength;
      accumulatedLength = segEnd;

      // Make layers visible
      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      if (this.map.getLayer(layerId))
        this.map.setLayoutProperty(layerId, "visibility", "visible");
      if (this.map.getLayer(glowLayerId))
        this.map.setLayoutProperty(glowLayerId, "visibility", "visible");

      if (drawnDistance >= segEnd) {
        // Fully drawn
        setSegmentSourceData(this.map, seg.id, seg.geometry);
      } else if (drawnDistance > segStart) {
        // Partially drawn
        const segFraction = (drawnDistance - segStart) / segLength;
        setSegmentSourceData(this.map, seg.id, seg.geometry, segFraction);
      } else {
        // Not yet drawn
        setSegmentSourceData(this.map, seg.id, seg.geometry, 0);
      }
    }

    // Hide future segments
    const lastGroupSegIdx = groupSegIndices[groupSegIndices.length - 1];
    for (let i = lastGroupSegIdx + 1; i < segments.length; i++) {
      const futureSeg = segments[i];
      const futureLid = SEGMENT_LAYER_PREFIX + futureSeg.id;
      const futureGlid = SEGMENT_GLOW_LAYER_PREFIX + futureSeg.id;
      if (this.map.getLayer(futureLid))
        this.map.setLayoutProperty(futureLid, "visibility", "none");
      if (this.map.getLayer(futureGlid))
        this.map.setLayoutProperty(futureGlid, "visibility", "none");
    }
  }

  /** Composite the vehicle icon onto the offscreen 2D canvas */
  private drawVehicleIcon(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number
  ): void {
    const iconAnimator = this.engine.getIconAnimator();
    const state = iconAnimator.getState();

    if (!state.visible || !state.position || state.opacity <= 0) return;

    const img = this.iconImages.get(state.iconSrc);
    if (!img) return;

    // map.project() returns CSS pixels; scale to physical pixels
    const point = this.map.project(state.position);
    const px = point.x * scaleX;
    const py = point.y * scaleY;
    const sz = state.size * scaleX; // uniform scale (scaleX ≈ scaleY)

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = state.opacity;
    ctx.drawImage(img, px - sz / 2, py - sz / 2, sz, sz);
    ctx.globalAlpha = prevAlpha;
  }

  /** Draw city name label on the offscreen 2D canvas, matching the preview style */
  private drawCityLabel(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    scaleX: number,
    label: string,
    baseFontSize: number = 18
  ): void {
    // Scale all dimensions from CSS to physical pixels
    const fontSize = baseFontSize * scaleX;
    const font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(label);

    const padH = 20 * scaleX;
    const padV = 10 * scaleX;
    const dotRadius = 4 * scaleX;
    const dotGap = 8 * scaleX;
    const textWidth = metrics.width;
    const boxWidth = padH + dotRadius * 2 + dotGap + textWidth + padH;
    const boxHeight = padV + 22 * scaleX + padV;
    const x = (canvasWidth - boxWidth) / 2;
    const y = 24 * scaleX;
    const radius = 8 * scaleX;

    // Shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 8 * scaleX;
    ctx.shadowOffsetY = 2 * scaleX;

    // Background rounded rect
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, radius);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    // Border
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1 * scaleX;
    ctx.stroke();
    ctx.restore();

    // Pin dot (indigo)
    const dotX = x + padH + dotRadius;
    const dotY = y + boxHeight / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#6366f1";
    ctx.fill();

    // Text
    ctx.font = font;
    ctx.fillStyle = "#1e293b";
    ctx.textBaseline = "middle";
    ctx.fillText(label, dotX + dotRadius + dotGap, dotY);
  }

  private applyRouteDrawFromCapture(captured: { routeDraw: AnimationEvent | null }): void {
    if (captured.routeDraw) {
      this.applyRouteDrawProgress(captured.routeDraw);
    }
  }

  private drawCityLabelFromCapture(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    scaleX: number,
    captured: { progress: AnimationEvent | null },
    baseFontSize: number = 18
  ): void {
    const label = captured.progress?.cityLabel;
    if (label) {
      this.drawCityLabel(ctx, canvasWidth, scaleX, label, baseFontSize);
    }
  }

  async export(onProgress: ProgressCallback): Promise<Blob | null> {
    const { fps } = this.settings;
    this.cancelled = false;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);
    const canvas = this.map.getCanvas();

    // Pre-load icon images for canvas compositing
    await this.preloadIcons();

    // Pre-warm: render key positions to load tiles
    this.engine.renderFrame(0);
    await this.waitForMapIdle();
    await new Promise((r) => setTimeout(r, 1000));
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

    // Hide all segments before starting — progressive draw starts clean
    this.hideAllSegments();

    // Capture route draw events from the engine during export.
    // Events are populated synchronously by seekTo → renderFrame → emit.
    const captured = { routeDraw: null as AnimationEvent | null, progress: null as AnimationEvent | null };
    const onRouteDrawEvent = (e: AnimationEvent) => { captured.routeDraw = e; };
    const onProgressEvent = (e: AnimationEvent) => { captured.progress = e; };
    this.engine.on("routeDrawProgress", onRouteDrawEvent);
    this.engine.on("progress", onProgressEvent);

    // Create an offscreen 2D canvas for compositing (WebGL canvas cannot getContext('2d'))
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) throw new Error("Failed to create offscreen 2D context");

    // HiDPI scaling: map.project() returns CSS pixels, canvas dimensions are physical
    const scaleX = canvas.width / canvas.clientWidth;
    const scaleY = canvas.height / canvas.clientHeight;

    try {
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

        // Reset event captures for this frame
        captured.routeDraw = null;
        captured.progress = null;

        // seekTo → renderFrame → emit populates captured synchronously
        this.engine.seekTo(Math.min(progress, 1));

        // Apply route draw state
        this.applyRouteDrawFromCapture(captured);

        await this.waitForMapIdle();

        // Copy the WebGL map frame to the offscreen 2D canvas, then draw overlays
        offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
        offCtx.drawImage(canvas, 0, 0);
        this.drawVehicleIcon(offCtx, scaleX, scaleY);
        this.drawCityLabelFromCapture(offCtx, offscreen.width, scaleX, captured, this.settings.cityLabelSize ?? 18);

        const blob = await new Promise<Blob>((resolve, reject) => {
          offscreen.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error("Frame capture failed")),
            "image/jpeg",
            0.92
          );
        });

        // Upload this frame immediately — no buffering
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("frameIndex", String(i + 1));
        formData.append(
          "frame",
          blob,
          `frame${String(i + 1).padStart(5, "0")}.jpg`
        );

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
    } finally {
      // Cleanup: restore map to idle state
      this.restoreAllSegments();
      this.engine.getIconAnimator().hide();

      // Remove our listeners to prevent leaks across repeated exports
      this.engine.off("routeDrawProgress", onRouteDrawEvent);
      this.engine.off("progress", onProgressEvent);
    }
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
