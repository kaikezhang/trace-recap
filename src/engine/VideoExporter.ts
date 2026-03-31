import * as turf from "@turf/turf";
import type mapboxgl from "mapbox-gl";
import type { ExportSettings, Photo, PhotoAnimation } from "@/types";
import { AnimationEngine } from "./AnimationEngine";
import type { AnimationEvent } from "./AnimationEngine";
import {
  setSegmentSourceData,
  SEGMENT_LAYER_PREFIX,
  SEGMENT_GLOW_LAYER_PREFIX,
  SEGMENT_SOURCE_PREFIX,
} from "@/components/editor/routeSegmentSources";
import { resolvePhotoAnimations } from "@/lib/photoAnimation";
import { isSolidStyle, resolveIconVariant } from "@/lib/transportIcons";
import type { IconDirection } from "@/lib/transportIcons";
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

export class VideoExporter {
  private engine: AnimationEngine;
  private map: mapboxgl.Map;
  private settings: ExportSettings;
  private cancelled = false;
  private abortController: AbortController | null = null;
  private photoImages: Map<string, PreloadedPhoto> = new Map();
  /** Track when photos first appeared (frame index) per group, for enter animation timing */
  private photoShowStartFrame: Map<number, number> = new Map();

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

  /** Initialize icon renderers for all transport modes (Lottie for outline/soft, PNG for solid) */
  private async preloadIcons(): Promise<void> {
    const iconAnimator = this.engine.getIconAnimator();
    const seen = new Set<string>();
    const iconVariants = this.engine.getSegments().filter((segment) => {
      const key = `${segment.transportMode}:${resolveIconVariant(segment.transportMode, segment.iconVariant)}:${segment.iconStyle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const directions: IconDirection[] = ["up", "down", "left", "right"];

    const promises: Promise<unknown>[] = [];
    for (const segment of iconVariants) {
      if (isSolidStyle(segment.iconStyle)) {
        // Solid style: preload all 4 directional PNG variants
        for (const dir of directions) {
          promises.push(iconAnimator.ensurePngImage(segment.transportMode, dir));
        }
      } else {
        // Lottie styles: preload canvas renderer
        promises.push(
          iconAnimator.ensureCanvasRenderer(
            segment.transportMode,
            segment.iconStyle,
            segment.iconVariant,
          ),
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

  /** Composite the vehicle icon (PNG or Lottie) onto the offscreen 2D canvas */
  private drawVehicleIcon(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number
  ): void {
    const iconAnimator = this.engine.getIconAnimator();
    const state = iconAnimator.getState();

    if (!state.visible || !state.position || state.opacity <= 0) return;

    const point = this.map.project(state.position);
    const px = point.x * scaleX;
    const py = point.y * scaleY;
    const sz = state.size * scaleX;

    iconAnimator.drawToCanvas(ctx, px, py, sz);
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

  /** Draw "CityA → CityB" route label at bottom of canvas during FLY phase */
  private drawRouteLabel(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    captured: { progress: AnimationEvent | null },
    baseFontSize: number = 14
  ): void {
    const progress = captured.progress;
    if (!progress) return;
    // Only show during FLY phase (not during ARRIVE/HOVER when city label shows)
    if (progress.phase !== "FLY") return;
    if (progress.cityLabel) return; // city label is showing, don't overlap

    const groups = this.engine.getGroups();
    const group = groups[progress.groupIndex];
    if (!group) return;

    const fromName = group.fromLoc.name;
    const toName = group.toLoc.name;
    if (!fromName || !toName) return;

    const label = `${fromName} → ${toName}`;
    const fontSize = baseFontSize * scaleX;
    const font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(label);

    const padH = 16 * scaleX;
    const padV = 8 * scaleX;
    const boxWidth = padH + metrics.width + padH;
    const boxHeight = padV + fontSize * 1.2 + padV;
    const x = (canvasWidth - boxWidth) / 2;
    const bottomPercent = this.settings.routeLabelBottomPercent ?? 15;
    const y = canvasHeight - Math.max(80 * scaleX, canvasHeight * bottomPercent / 100) - boxHeight;
    const radius = boxHeight / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 8 * scaleX;
    ctx.shadowOffsetY = 2 * scaleX;

    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, radius);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.restore();

    ctx.font = font;
    ctx.fillStyle = "#374151";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + padH, y + boxHeight / 2);
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

  /** Cubic ease-out: matches framer-motion's default easeOut */
  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /** Compute per-photo canvas transforms for enter animation */
  private getEnterTransform(
    style: PhotoAnimation,
    progress: number, // 0→1 eased
    index: number,
    total: number,
  ): { opacity: number; scaleX: number; scaleY: number; translateX: number; translateY: number; rotate: number; blur: number } {
    const p = progress;
    switch (style) {
      case "none":
        return { opacity: 1, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "fade":
        return { opacity: p, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "scale":
        return {
          opacity: p,
          scaleX: 0.6 + 0.4 * p,
          scaleY: 0.6 + 0.4 * p,
          translateX: 0,
          translateY: 60 * (1 - p),
          rotate: 0,
          blur: 8 * (1 - p),
        };
      case "slide":
        return {
          opacity: p,
          scaleX: 1,
          scaleY: 1,
          translateX: (index % 2 === 0 ? -80 : 80) * (1 - p),
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "flip":
        // Simulate flip via horizontal scale (1→0→1 mapped from rotateY 90→0)
        return {
          opacity: p,
          scaleX: Math.abs(Math.cos((1 - p) * Math.PI / 2)),
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "scatter": {
        const angle = (index / Math.max(total, 1)) * 2 * Math.PI;
        const dist = 200;
        return {
          opacity: p,
          scaleX: 0.4 + 0.6 * p,
          scaleY: 0.4 + 0.6 * p,
          translateX: Math.cos(angle) * dist * (1 - p),
          translateY: Math.sin(angle) * dist * (1 - p),
          rotate: (index % 2 === 0 ? -30 : 30) * (1 - p),
          blur: 0,
        };
      }
      case "typewriter":
        return {
          opacity: p,
          scaleX: 0.8 + 0.2 * p,
          scaleY: 0.8 + 0.2 * p,
          translateX: 0,
          translateY: 20 * (1 - p),
          rotate: 0,
          blur: 0,
        };
    }
  }

  /** Compute per-photo canvas transforms for exit animation */
  private getExitTransform(
    style: PhotoAnimation,
    exitProgress: number, // 0→1 overall exit
    photoExitT: number, // 0→1 per-photo staggered
    index: number,
    total: number,
  ): { opacity: number; scaleX: number; scaleY: number; translateX: number; translateY: number; rotate: number; blur: number } {
    const t = photoExitT;
    switch (style) {
      case "none":
        return { opacity: 1 - exitProgress, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "fade":
        return { opacity: 1 - t, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "scale":
        return {
          opacity: 1 - t,
          scaleX: 1 - t * 0.4,
          scaleY: 1 - t * 0.4,
          translateX: 0,
          translateY: -t * 60,
          rotate: t * (index % 2 === 0 ? -12 : 12),
          blur: t * 6,
        };
      case "slide":
        return {
          opacity: 1 - t,
          scaleX: 1,
          scaleY: 1,
          translateX: (index % 2 === 0 ? -1 : 1) * t * 120,
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "flip":
        return {
          opacity: 1 - t * 0.8,
          scaleX: Math.abs(Math.cos(t * Math.PI / 2)),
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "scatter": {
        const angle = (index / 4) * 2 * Math.PI;
        const dist = 200;
        return {
          opacity: 1 - t,
          scaleX: 1 - t * 0.5,
          scaleY: 1 - t * 0.5,
          translateX: Math.cos(angle) * dist * t,
          translateY: Math.sin(angle) * dist * t,
          rotate: (index % 2 === 0 ? -25 : 25) * t,
          blur: t * 4,
        };
      }
      case "typewriter":
        return {
          opacity: 1 - t,
          scaleX: 1 - t * 0.2,
          scaleY: 1 - t * 0.2,
          translateX: 0,
          translateY: t * -30,
          rotate: 0,
          blur: 0,
        };
    }
  }

  /** Draw photo overlays onto the offscreen canvas during ARRIVE phases */
  private drawPhotos(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    captured: { progress: AnimationEvent | null },
    frameIndex: number,
    fps: number,
  ): void {
    const progress = captured.progress;
    if (!progress || !progress.showPhotos) return;

    const groups = this.engine.getGroups();
    const group = groups[progress.groupIndex];
    if (!group) return;

    // During ARRIVE: show current destination's photos
    // During HOVER/ZOOM_OUT/FLY fade-out: show PREVIOUS destination's photos (they're fading out)
    let photoLoc;
    if (progress.phase === "ARRIVE") {
      photoLoc = group.toLoc;
    } else if (progress.groupIndex > 0) {
      // Fading out previous group's photos
      photoLoc = groups[progress.groupIndex - 1].toLoc;
    } else {
      photoLoc = group.toLoc;
    }

    const photos: Photo[] = photoLoc.photos;
    if (photos.length === 0) return;

    const layout = photoLoc.photoLayout;
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
          layout.customProportions,
          layout.layoutSeed
        )
      : computeAutoLayout(layoutMetas, containerAspect, gapPx, widthPx);
    const count = loaded.length;
    const isPolaroid = layout?.template === "polaroid";

    // --- Photo animation timing ---
    const {
      enterAnimation: enterAnimStyle,
      exitAnimation: exitAnimStyle,
    } = resolvePhotoAnimations(layout, this.settings.photoAnimation ?? "scale");
    const groupIdx = progress.groupIndex;

    // Track when photos first appeared for this group
    if (!this.photoShowStartFrame.has(groupIdx)) {
      this.photoShowStartFrame.set(groupIdx, frameIndex);
    }
    const enterStartFrame = this.photoShowStartFrame.get(groupIdx)!;

    // Enter animation: ~0.4s per photo, with per-photo stagger
    const enterDurationSec = 0.4;
    const enterDurationFrames = enterDurationSec * fps;

    // Exit: derive from photoOpacity (1 = fully visible, 0 = fully gone)
    const exitProgress = 1 - (progress.photoOpacity ?? 1); // 0 = no exit, 1 = fully exited

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

      // --- Compute animation transform for this photo ---
      let animTransform: { opacity: number; scaleX: number; scaleY: number; translateX: number; translateY: number; rotate: number; blur: number };

      if (exitProgress > 0) {
        // Exit animations always run during fade-out; "none" maps to opacity-only parity with PhotoOverlay.
        const staggerOffset = count > 1 ? (count - 1 - i) / (count - 1) * 0.4 : 0;
        const photoExitT = Math.max(0, Math.min(1, (exitProgress - staggerOffset) / (1 - staggerOffset + 0.01)));
        animTransform = this.getExitTransform(exitAnimStyle, exitProgress, photoExitT, i, count);
      } else if (enterAnimStyle !== "none") {
        // Enter animation with per-photo stagger
        const staggerDelaySec = enterAnimStyle === "typewriter" ? i * 0.2 : i * 0.08;
        const staggerDelayFrames = staggerDelaySec * fps;
        const elapsed = frameIndex - enterStartFrame - staggerDelayFrames;
        const rawProgress = Math.max(0, Math.min(1, elapsed / enterDurationFrames));
        const easedProgress = this.easeOut(rawProgress);
        animTransform = this.getEnterTransform(enterAnimStyle, easedProgress, i, count);
      } else {
        animTransform = { opacity: 1, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      }

      // Skip fully transparent photos
      if (animTransform.opacity <= 0) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = animTransform.opacity;
      if (animTransform.blur > 0) {
        ctx.filter = `blur(${animTransform.blur * scaleX}px)`;
      }
      ctx.translate(centerX + animTransform.translateX * scaleX, centerY + animTransform.translateY * scaleX);
      ctx.rotate((rotation + animTransform.rotate) * Math.PI / 180);
      ctx.scale(animTransform.scaleX, animTransform.scaleY);

      if (isPolaroid) {
        // Polaroid: white card with thicker bottom padding and shadow
        const polPadSide = frameW * 0.04;
        const polPadBottom = frameH * 0.10;
        const polPadTop = frameW * 0.04;
        const polRadius = 4 * scaleX;

        // Drop shadow for the white frame
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 16 * scaleX;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4 * scaleX;

        // White frame
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.roundRect(-frameW / 2, -frameH / 2, frameW, frameH, polRadius);
        ctx.fill();

        // Reset shadow before drawing image
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Image area inside the white frame
        const imgAreaX = -frameW / 2 + polPadSide;
        const imgAreaY = -frameH / 2 + polPadTop;
        const imgAreaW = frameW - polPadSide * 2;
        const imgAreaH = frameH - polPadTop - polPadBottom;

        // Fit image within the area (contain)
        const imgAspect = preloaded.aspect;
        const areaAspect = imgAreaW / imgAreaH;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgAspect > areaAspect) {
          drawW = imgAreaW;
          drawH = imgAreaW / imgAspect;
          drawX = imgAreaX;
          drawY = imgAreaY + (imgAreaH - drawH) / 2;
        } else {
          drawH = imgAreaH;
          drawW = imgAreaH * imgAspect;
          drawX = imgAreaX + (imgAreaW - drawW) / 2;
          drawY = imgAreaY;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);
        ctx.clip();
        ctx.drawImage(preloaded.img, drawX, drawY, drawW, drawH);
        ctx.restore();

        if (hasCaption) {
          ctx.font = `${captionFontSize}px system-ui, -apple-system, sans-serif`;
          ctx.fillStyle = "#374151";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            photo.caption!,
            0,
            imgAreaY + imgAreaH + (polPadBottom - polPadTop) / 2,
            imgAreaW
          );
        }
      } else {
        // Default: direct image with rounded corners
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
    this.photoShowStartFrame.clear();
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
            targetW, targetH, totalFrames, totalDuration, fps, onProgress, captured
          );
        } catch (webCodecsError) {
          console.warn("WebCodecs export failed, falling back to server:", webCodecsError);
          // Fallback will report "server" encoding method via progress callbacks
          // Reset state for server fallback
          this.engine.seekTo(0);
          this.hideAllSegments();
          return await this.exportWithServer(
            offscreen, offCtx, canvas, scaleX, scaleY,
            totalFrames, totalDuration, fps, signal, onProgress, captured
          );
        }
      } else {
        return await this.exportWithServer(
          offscreen, offCtx, canvas, scaleX, scaleY,
          totalFrames, totalDuration, fps, signal, onProgress, captured
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
    this.drawRouteLabel(offCtx, offscreen.width, offscreen.height, scaleX, captured, this.settings.routeLabelSize ?? 14);
    this.drawPhotos(offCtx, offscreen.width, offscreen.height, scaleX, captured, frameIndex, fps);

    // Clear photo start tracking when photos stop showing so re-entry is tracked fresh
    const capturedProgress = captured.progress as AnimationEvent | null;
    if (!capturedProgress || !capturedProgress.showPhotos) {
      this.photoShowStartFrame.clear();
    }
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
    onProgress: ProgressCallback,
    captured: { routeDraw: AnimationEvent | null; progress: AnimationEvent | null }
  ): Promise<Blob | null> {
    const webCodecsExporter = new WebCodecsExporter({
      width: targetW,
      height: targetH,
      fps,
    });

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
    onProgress: ProgressCallback,
    captured: { routeDraw: AnimationEvent | null; progress: AnimationEvent | null }
  ): Promise<Blob | null> {
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
  }

  private waitForMapIdle(): Promise<void> {
    return new Promise((resolve) => {
      this.map.triggerRepaint();

      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      // Use 'render' event for speed — fires after each repaint, much faster
      // than 'idle' which waits for all tiles/resources to settle.
      // For export, tiles are typically already cached from preview playback.
      this.map.once("render", done);

      // Short safety timeout — tiles should already be cached
      setTimeout(done, 200);
    });
  }
}
