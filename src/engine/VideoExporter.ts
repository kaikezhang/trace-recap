import * as turf from "@turf/turf";
import type mapboxgl from "mapbox-gl";
import type { ExportSettings, Photo, TransportMode } from "@/types";
import { AnimationEngine } from "./AnimationEngine";
import type { AnimationEvent } from "./AnimationEngine";
import {
  setSegmentSourceData,
  SEGMENT_LAYER_PREFIX,
  SEGMENT_GLOW_LAYER_PREFIX,
  SEGMENT_SOURCE_PREFIX,
} from "@/components/editor/routeSegmentSources";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import { getExportViewportSize } from "@/lib/viewportRatio";
import { isWebCodecsSupported, WebCodecsExporter } from "./WebCodecsExporter";

export type ExportProgress = {
  phase: "capturing" | "uploading" | "encoding" | "done";
  current: number;
  total: number;
  encodingMethod?: "webcodecs" | "server";
};

type ProgressCallback = (progress: ExportProgress) => void;

interface PreloadedPhoto {
  img: HTMLImageElement;
  aspect: number; // naturalWidth / naturalHeight
  failed?: boolean; // true if the original image failed to load (placeholder)
}

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
  private photoImages: Map<string, PreloadedPhoto> = new Map();

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
              if (img.src !== key) {
                this.iconImages.set(img.src, img);
              }
              resolve();
            };
            img.onerror = () => {
              resolve();
            };
            img.src = src;
          })
        );
      }
    }
    await Promise.all(promises);
  }

  /** Pre-load all photo images so they're ready for canvas compositing */
  private async preloadPhotos(): Promise<void> {
    const locations = this.engine.getLocations();
    const urls = new Set<string>();
    for (const loc of locations) {
      for (const photo of loc.photos) {
        urls.add(photo.url);
      }
    }

    const promises: Promise<void>[] = [];
    for (const url of urls) {
      if (this.photoImages.has(url)) continue;
      promises.push(
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.photoImages.set(url, {
              img,
              aspect: img.naturalWidth / img.naturalHeight,
            });
            resolve();
          };
          img.onerror = () => {
            const placeholder = this.createPlaceholderImage(240, 180);
            this.photoImages.set(url, {
              img: placeholder,
              aspect: 240 / 180,
              failed: true,
            });
            resolve();
          };
          img.src = url;
        })
      );
    }
    await Promise.all(promises);
  }

  /** Create a placeholder HTMLImageElement for failed photo loads */
  private createPlaceholderImage(w: number, h: number): HTMLImageElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    cx.fillStyle = "#d1d5db";
    cx.fillRect(0, 0, w, h);
    const m = 40;
    cx.strokeStyle = "#9ca3af";
    cx.lineWidth = 6;
    cx.lineCap = "round";
    cx.beginPath();
    cx.moveTo(m, m);
    cx.lineTo(w - m, h - m);
    cx.moveTo(w - m, m);
    cx.lineTo(m, h - m);
    cx.stroke();
    const iconW = 50;
    const iconH = 36;
    const ix = (w - iconW) / 2;
    const iy = (h - iconH) / 2;
    cx.strokeStyle = "#6b7280";
    cx.lineWidth = 3;
    cx.strokeRect(ix, iy, iconW, iconH);
    cx.beginPath();
    cx.arc(w / 2, h / 2, 10, 0, Math.PI * 2);
    cx.stroke();

    const img = new Image();
    img.src = c.toDataURL();
    return img;
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

  private applyRouteDrawProgress(event: AnimationEvent): void {
    const segments = this.engine.getSegments();
    const fraction = event.routeDrawFraction ?? 0;
    const groupSegIndices = event.groupSegmentIndices;

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

      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      if (this.map.getLayer(layerId))
        this.map.setLayoutProperty(layerId, "visibility", "visible");
      if (this.map.getLayer(glowLayerId))
        this.map.setLayoutProperty(glowLayerId, "visibility", "visible");

      if (drawnDistance >= segEnd) {
        setSegmentSourceData(this.map, seg.id, seg.geometry);
      } else if (drawnDistance > segStart) {
        const segFraction = (drawnDistance - segStart) / segLength;
        setSegmentSourceData(this.map, seg.id, seg.geometry, segFraction);
      } else {
        setSegmentSourceData(this.map, seg.id, seg.geometry, 0);
      }
    }

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

    const point = this.map.project(state.position);
    const px = point.x * scaleX;
    const py = point.y * scaleY;
    const sz = state.size * scaleX;

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

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 8 * scaleX;
    ctx.shadowOffsetY = 2 * scaleX;

    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, radius);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1 * scaleX;
    ctx.stroke();
    ctx.restore();

    const dotX = x + padH + dotRadius;
    const dotY = y + boxHeight / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#6366f1";
    ctx.fill();

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
    baseFontSize: number = 18,
    lang: "en" | "zh" = "en"
  ): void {
    const labelEn = captured.progress?.cityLabel;
    const labelZh = captured.progress?.cityLabelZh;
    const label = lang === "zh" ? (labelZh || labelEn) : labelEn;
    if (label) {
      this.drawCityLabel(ctx, canvasWidth, scaleX, label, baseFontSize);
    }
  }

  /** Draw photo overlays onto the offscreen canvas during ARRIVE phases */
  private drawPhotos(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    captured: { progress: AnimationEvent | null }
  ): void {
    const progress = captured.progress;
    if (!progress || !progress.showPhotos) return;

    const groups = this.engine.getGroups();
    const group = groups[progress.groupIndex];
    if (!group) return;

    const toLoc = group.toLoc;
    const photos: Photo[] = toLoc.photos;
    if (photos.length === 0) return;

    const layout = toLoc.photoLayout;
    const gapPx = layout?.gap ?? 8;
    const borderRadiusPx = layout?.borderRadius ?? 8;

    const orderedPhotos = (() => {
      if (layout?.order && layout.order.length > 0) {
        const photoMap = new Map(photos.map((p) => [p.id, p]));
        const ordered = layout.order
          .map((id) => photoMap.get(id))
          .filter((p): p is Photo => !!p);
        for (const p of photos) {
          if (!ordered.find((o) => o.id === p.id)) ordered.push(p);
        }
        return ordered;
      }
      return photos;
    })();

    const loaded: { photo: Photo; preloaded: PreloadedPhoto }[] = [];
    for (const photo of orderedPhotos) {
      const preloaded = this.photoImages.get(photo.url);
      if (preloaded) {
        loaded.push({ photo, preloaded });
      }
    }
    if (loaded.length === 0) return;

    const pad = 6 * scaleX;
    const radius = borderRadiusPx * scaleX;
    const shadowOffX = 2 * scaleX;
    const shadowOffY = 2 * scaleX;
    const captionFontSize = 14 * scaleX;
    const captionH = 28 * scaleX;

    const insetW = canvasWidth * 0.95;
    const insetH = canvasHeight * 0.88;
    const insetX = (canvasWidth - insetW) / 2;
    const insetY = (canvasHeight - insetH) / 2;

    const containerAspect = insetW / insetH;
    const layoutMetas = loaded.map(({ photo, preloaded }) => ({
      id: photo.id,
      aspect: preloaded.aspect,
    }));
    const widthPx = insetW / scaleX;
    const rects = layout?.mode === "manual" && layout.template
      ? computeTemplateLayout(
          layoutMetas,
          containerAspect,
          layout.template,
          gapPx,
          widthPx,
          layout.customProportions
        )
      : computeAutoLayout(layoutMetas, containerAspect, gapPx, widthPx);
    const count = loaded.length;

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const { photo, preloaded } = loaded[i];
      const hasCaption = !!photo.caption;
      const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };

      const rx = insetX + rect.x * insetW;
      const ry = insetY + rect.y * insetH;
      const rw = rect.width * insetW;
      const rh = rect.height * insetH;

      const frameW = rw;
      const frameH = rh;
      const imgW = frameW - pad * 2;
      const imgH = frameH - pad * 2 - (hasCaption ? captionH : 0);

      // Use scatter rotation if provided, otherwise default tilts
      let rotation: number;
      if (rect.rotation != null) {
        rotation = rect.rotation;
      } else if (count <= 3) {
        if (i === 0) rotation = -2;
        else if (i === count - 1) rotation = 2;
        else rotation = 0;
      } else {
        rotation = i % 2 === 0 ? -1.5 : 1.5;
      }

      const centerX = rx + frameW / 2;
      const centerY = ry + frameH / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }

      // Compute contain dimensions (fit entire image, no crop)
      const imgAspect = preloaded.aspect;
      const targetAspect = frameW / frameH;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgAspect > targetAspect) {
        drawW = frameW;
        drawH = frameW / imgAspect;
        drawX = -frameW / 2;
        drawY = -drawH / 2;
      } else {
        drawH = frameH;
        drawW = frameH * imgAspect;
        drawX = -drawW / 2;
        drawY = -frameH / 2;
      }

      // Drop shadow
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 12 * scaleX;
      ctx.shadowOffsetX = shadowOffX;
      ctx.shadowOffsetY = shadowOffY;

      // Clip to rounded rect and draw
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(drawX, drawY, drawW, drawH, radius);
      ctx.clip();
      ctx.drawImage(preloaded.img, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      if (hasCaption) {
        ctx.font = `${captionFontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "#374151";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          photo.caption!,
          0,
          drawY + drawH + captionH / 2,
          drawW
        );
      }

      ctx.restore();
    }
  }

  /** Draw a filled rounded rectangle */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  async export(onProgress: ProgressCallback): Promise<Blob | null> {
    const { fps } = this.settings;
    this.cancelled = false;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);
    const canvas = this.map.getCanvas();
    const useWebCodecs = isWebCodecsSupported();

    const { width: targetW, height: targetH } = getExportViewportSize(
      this.settings.viewportRatio ?? "free",
      canvas.width,
      canvas.height,
    );

    await this.preloadIcons();
    await this.preloadPhotos();

    this.hideAllSegments();

    const captured = { routeDraw: null as AnimationEvent | null, progress: null as AnimationEvent | null };
    const onRouteDrawEvent = (e: AnimationEvent) => { captured.routeDraw = e; };
    const onProgressEvent = (e: AnimationEvent) => { captured.progress = e; };
    this.engine.on("routeDrawProgress", onRouteDrawEvent);
    this.engine.on("progress", onProgressEvent);

    const offscreen = document.createElement("canvas");
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) throw new Error("Failed to create offscreen 2D context");

    const scaleX = targetW / Math.max(canvas.clientWidth, 1);
    const scaleY = targetH / Math.max(canvas.clientHeight, 1);

    try {
      if (useWebCodecs) {
        try {
          return await this.exportWithWebCodecs(
            offscreen, offCtx, canvas, scaleX, scaleY,
            targetW, targetH, totalFrames, totalDuration, fps, onProgress
          );
        } catch (webCodecsError) {
          console.warn("WebCodecs export failed, falling back to server:", webCodecsError);
          // Fallback will report "server" encoding method via progress callbacks
          // Reset state for server fallback
          this.engine.seekTo(0);
          this.hideAllSegments();
          return await this.exportWithServer(
            offscreen, offCtx, canvas, scaleX, scaleY,
            totalFrames, totalDuration, fps, signal, onProgress
          );
        }
      } else {
        return await this.exportWithServer(
          offscreen, offCtx, canvas, scaleX, scaleY,
          totalFrames, totalDuration, fps, signal, onProgress
        );
      }
    } finally {
      this.restoreAllSegments();
      this.engine.getIconAnimator().hide();

      this.engine.off("routeDrawProgress", onRouteDrawEvent);
      this.engine.off("progress", onProgressEvent);
    }
  }

  /** Capture a single frame onto the offscreen canvas */
  private async captureFrame(
    offCtx: CanvasRenderingContext2D,
    offscreen: HTMLCanvasElement,
    canvas: HTMLCanvasElement,
    scaleX: number,
    scaleY: number,
    captured: { routeDraw: AnimationEvent | null; progress: AnimationEvent | null },
    frameIndex: number,
    fps: number,
    totalDuration: number
  ): Promise<void> {
    const time = frameIndex / fps;
    const progress = time / totalDuration;

    captured.routeDraw = null;
    captured.progress = null;

    this.engine.seekTo(Math.min(progress, 1));
    this.applyRouteDrawFromCapture(captured);
    await this.waitForMapIdle();

    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
    this.drawVehicleIcon(offCtx, scaleX, scaleY);
    this.drawCityLabelFromCapture(offCtx, offscreen.width, scaleX, captured, this.settings.cityLabelSize ?? 18, this.settings.cityLabelLang ?? "en");
    this.drawPhotos(offCtx, offscreen.width, offscreen.height, scaleX, captured);
  }

  private async exportWithWebCodecs(
    offscreen: HTMLCanvasElement,
    offCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    scaleX: number,
    scaleY: number,
    targetW: number,
    targetH: number,
    totalFrames: number,
    totalDuration: number,
    fps: number,
    onProgress: ProgressCallback
  ): Promise<Blob | null> {
    const captured = { routeDraw: null as AnimationEvent | null, progress: null as AnimationEvent | null };
    const onRouteDrawEvent = (e: AnimationEvent) => { captured.routeDraw = e; };
    const onProgressEvent = (e: AnimationEvent) => { captured.progress = e; };
    this.engine.on("routeDrawProgress", onRouteDrawEvent);
    this.engine.on("progress", onProgressEvent);

    const webCodecsExporter = new WebCodecsExporter({
      width: targetW,
      height: targetH,
      fps,
    });

    try {
      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled) return null;

        await this.captureFrame(offCtx, offscreen, canvas, scaleX, scaleY, captured, i, fps, totalDuration);
        webCodecsExporter.addFrame(offscreen, i);

        onProgress({
          phase: "capturing",
          current: i + 1,
          total: totalFrames,
          encodingMethod: "webcodecs",
        });
      }

      if (this.cancelled) return null;

      onProgress({ phase: "encoding", current: 0, total: 1, encodingMethod: "webcodecs" });
      const blob = await webCodecsExporter.finalize();
      onProgress({ phase: "done", current: 1, total: 1, encodingMethod: "webcodecs" });
      return blob;
    } finally {
      this.engine.off("routeDrawProgress", onRouteDrawEvent);
      this.engine.off("progress", onProgressEvent);
    }
  }

  private async exportWithServer(
    offscreen: HTMLCanvasElement,
    offCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    scaleX: number,
    scaleY: number,
    totalFrames: number,
    totalDuration: number,
    fps: number,
    signal: AbortSignal,
    onProgress: ProgressCallback
  ): Promise<Blob | null> {
    const captured = { routeDraw: null as AnimationEvent | null, progress: null as AnimationEvent | null };
    const onRouteDrawEvent = (e: AnimationEvent) => { captured.routeDraw = e; };
    const onProgressEvent = (e: AnimationEvent) => { captured.progress = e; };
    this.engine.on("routeDrawProgress", onRouteDrawEvent);
    this.engine.on("progress", onProgressEvent);

    try {
      const startRes = await fetch("/api/encode-video/start", {
        method: "POST",
        signal,
      });
      if (!startRes.ok) {
        throw new Error("Failed to start encoding session");
      }
      const { sessionId } = (await startRes.json()) as { sessionId: string };

      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled) return null;

        await this.captureFrame(offCtx, offscreen, canvas, scaleX, scaleY, captured, i, fps, totalDuration);

        const blob = await new Promise<Blob>((resolve, reject) => {
          offscreen.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error("Frame capture failed")),
            "image/jpeg",
            0.92
          );
        });

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
          encodingMethod: "server",
        });
      }

      if (this.cancelled) return null;

      onProgress({ phase: "encoding", current: 0, total: 1, encodingMethod: "server" });

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

      onProgress({ phase: "encoding", current: 1, total: 1, encodingMethod: "server" });

      const mp4Blob = await response.blob();
      onProgress({ phase: "done", current: 1, total: 1, encodingMethod: "server" });

      return mp4Blob;
    } finally {
      this.engine.off("routeDrawProgress", onRouteDrawEvent);
      this.engine.off("progress", onProgressEvent);
    }
  }

  private waitForMapIdle(): Promise<void> {
    return new Promise((resolve) => {
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

      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        if (checkReady() || elapsed >= 5000) {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      const onIdle = () => {
        clearInterval(interval);
        resolve();
      };
      this.map.once("idle", onIdle);
    });
  }
}
