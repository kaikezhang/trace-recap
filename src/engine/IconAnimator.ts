import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import lottie from "lottie-web";
import type { AnimationItem } from "lottie-web";
import {
  bearingToDirection,
  getTransportIconAssetKey,
  getTransportIconAssetPath,
  getTransportIconPngPath,
  isSolidStyle,
} from "@/lib/transportIcons";
import type { IconDirection } from "@/lib/transportIcons";
import type {
  AnimationGroup,
  AnimationPhase,
  Segment,
  TransportIconStyle,
  TransportMode,
} from "@/types";

const BASE_SIZE = 52;

/** All Lottie animations face right (east = 90°). Rotation offset to convert bearing to CSS rotation. */
const LOTTIE_FACING_OFFSET = 90;

export interface IconState {
  visible: boolean;
  position: [number, number] | null;
  /** Current transport mode (used by VideoExporter to identify the active icon) */
  mode: TransportMode | null;
  iconStyle: TransportIconStyle | null;
  size: number;
  opacity: number;
  /** Current bearing in degrees (0 = north). Used for Lottie rotation during canvas compositing. */
  bearing: number;
  /** For solid style: the current PNG icon path (used by VideoExporter for canvas compositing) */
  pngSrc: string | null;
}

export class IconAnimator {
  private map: mapboxgl.Map;
  private groups: AnimationGroup[];
  private marker: mapboxgl.Marker | null = null;
  private containerEl: HTMLDivElement;

  // --- Solid (PNG) elements ---
  private imgEl: HTMLImageElement;
  private currentPngKey: string = "";

  // --- Lottie elements ---
  private lottieEl: HTMLDivElement;
  private currentMode: TransportMode | null = null;
  private currentIconStyle: TransportIconStyle | null = null;
  private currentBearing: number = 0;
  private lottieInstances: Map<string, AnimationItem> = new Map();
  private activeInstance: AnimationItem | null = null;
  private lottieFrame: number = 0;

  /** Offscreen canvas + Lottie instances for video export compositing */
  private canvasEl: HTMLCanvasElement | null = null;
  private canvasInstances: Map<string, AnimationItem> = new Map();

  /** Cached PNG images for video export compositing (solid style) */
  private pngImages: Map<string, HTMLImageElement> = new Map();

  /** Whether the current rendering uses solid (PNG) or Lottie */
  private usingSolid: boolean = false;

  private lastState: IconState = {
    visible: false,
    position: null,
    mode: null,
    iconStyle: null,
    size: BASE_SIZE,
    opacity: 1,
    bearing: 0,
    pngSrc: null,
  };

  constructor(map: mapboxgl.Map, groups: AnimationGroup[]) {
    this.map = map;
    this.groups = groups;

    // Container for the Mapbox marker
    this.containerEl = document.createElement("div");
    this.containerEl.style.cssText = `
      width:${BASE_SIZE}px;height:${BASE_SIZE}px;
      pointer-events:none;
      transition:opacity 0.3s ease;
      display:flex;align-items:center;justify-content:center;
    `;

    // PNG image element (solid style — directional variants, no rotation)
    this.imgEl = document.createElement("img");
    this.imgEl.style.cssText = `
      width:100%;height:100%;
      object-fit:contain;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));
      display:none;
    `;
    this.containerEl.appendChild(this.imgEl);

    // Lottie container element (outline/soft styles — rotated via CSS)
    this.lottieEl = document.createElement("div");
    this.lottieEl.style.cssText = `
      width:100%;height:100%;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));
      display:none;
    `;
    this.containerEl.appendChild(this.lottieEl);
  }

  private ensureMarker() {
    if (!this.marker) {
      this.marker = new mapboxgl.Marker({
        element: this.containerEl,
        anchor: "center",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([0, 0])
        .addTo(this.map);
    }
  }

  // ── Solid (PNG) icon management ──

  private setSolidIcon(mode: TransportMode, direction: IconDirection) {
    const key = `${mode}-${direction}`;
    if (key === this.currentPngKey && this.usingSolid) return;

    // Switch visibility: show PNG, hide Lottie
    if (!this.usingSolid) {
      this.hideLottie();
      this.imgEl.style.display = "block";
      this.lottieEl.style.display = "none";
      this.usingSolid = true;
    }

    this.currentPngKey = key;
    this.currentMode = null;
    this.currentIconStyle = null;
    this.imgEl.src = getTransportIconPngPath(mode, direction);
  }

  // ── Lottie icon management ──

  private hideLottie() {
    if (this.activeInstance) {
      this.activeInstance.stop();
      const wrapper = (this.activeInstance as AnimationItem & { wrapper?: HTMLElement }).wrapper;
      if (wrapper) wrapper.style.display = "none";
    }
  }

  /** Load (or retrieve cached) Lottie animation for a transport mode in the SVG marker */
  private loadLottie(
    mode: TransportMode,
    iconStyle: TransportIconStyle,
  ): AnimationItem {
    const key = getTransportIconAssetKey(mode, iconStyle);
    const existing = this.lottieInstances.get(key);
    if (existing) return existing;

    const instance = lottie.loadAnimation({
      container: this.lottieEl,
      renderer: "svg",
      loop: true,
      autoplay: false,
      path: getTransportIconAssetPath(mode, iconStyle),
    });

    this.lottieInstances.set(key, instance);
    return instance;
  }

  /** Switch to a Lottie animation (outline/soft styles) */
  private setLottieMode(mode: TransportMode, iconStyle: TransportIconStyle) {
    // Switch visibility: hide PNG, show Lottie
    if (this.usingSolid) {
      this.imgEl.style.display = "none";
      this.lottieEl.style.display = "block";
      this.usingSolid = false;
    }

    if (mode === this.currentMode && iconStyle === this.currentIconStyle) return;

    // Hide current animation's SVG
    this.hideLottie();

    this.currentMode = mode;
    this.currentIconStyle = iconStyle;
    this.activeInstance = this.loadLottie(mode, iconStyle);
    const wrapper = (this.activeInstance as AnimationItem & { wrapper?: HTMLElement }).wrapper;
    if (wrapper) wrapper.style.display = "block";
    this.activeInstance.play();
  }

  /** Rotate the Lottie element to match the travel bearing */
  private setLottieDirection(bearing: number) {
    this.currentBearing = bearing;
    this.lottieEl.style.transform = `rotate(${bearing - LOTTIE_FACING_OFFSET}deg)`;
  }

  // ── Unified update ──

  update(groupIndex: number, phase: AnimationPhase, progress: number) {
    const group = this.groups[groupIndex];
    if (!group) return;

    this.ensureMarker();

    const routeLine = group.mergedGeometry;
    if (!routeLine || routeLine.coordinates.length < 2) {
      this.containerEl.style.display = "none";
      return;
    }

    const line = turf.lineString(routeLine.coordinates);
    const totalLength = turf.length(line);
    const coords = routeLine.coordinates;

    const startPt = coords[0] as [number, number];
    const endPt = coords[coords.length - 1] as [number, number];

    const activeSegment = this.getSegmentAtProgress(
      group,
      totalLength,
      phase,
      progress,
    );
    const mode = activeSegment.transportMode;
    const iconStyle = activeSegment.iconStyle;

    // Compute bearing for direction
    let bearing: number;
    if (mode === "flight") {
      const midIdx = Math.floor(coords.length / 2);
      const midPt = coords[midIdx] as [number, number];
      const isSecondHalf = (phase === "FLY" && progress > 0.5) || phase === "ZOOM_IN" || phase === "ARRIVE";
      bearing = isSecondHalf
        ? turf.bearing(turf.point(midPt), turf.point(endPt))
        : turf.bearing(turf.point(startPt), turf.point(midPt));
    } else {
      bearing = turf.bearing(turf.point(startPt), turf.point(endPt));
    }

    // Choose rendering path based on icon style
    let pngSrc: string | null = null;
    if (isSolidStyle(iconStyle)) {
      const direction = bearingToDirection(bearing);
      this.setSolidIcon(mode, direction);
      pngSrc = getTransportIconPngPath(mode, direction);
    } else {
      this.setLottieMode(mode, iconStyle);
      this.setLottieDirection(bearing);
    }

    let position: [number, number];
    let showIcon = true;
    let scale = 1.0;
    let opacity = 1.0;

    switch (phase) {
      case "HOVER": {
        position = coords[0] as [number, number];
        break;
      }
      case "ZOOM_OUT": {
        const earlyProgress = progress * 0.05;
        const along = turf.along(line, earlyProgress * totalLength);
        position = along.geometry.coordinates as [number, number];
        scale = lerp(1.0, 1.15, progress);
        break;
      }
      case "FLY": {
        const along = turf.along(line, progress * totalLength);
        position = along.geometry.coordinates as [number, number];
        scale = 1.15;
        break;
      }
      case "ZOOM_IN": {
        position = coords[coords.length - 1] as [number, number];
        opacity = lerp(1.0, 0.0, progress);
        scale = lerp(1.15, 0.9, progress);
        break;
      }
      case "ARRIVE": {
        showIcon = false;
        position = coords[coords.length - 1] as [number, number];
        break;
      }
      default:
        position = coords[0] as [number, number];
    }

    this.marker!.setLngLat(position);
    this.marker!.setRotation(0);

    const size = Math.round(BASE_SIZE * scale);
    this.containerEl.style.width = `${size}px`;
    this.containerEl.style.height = `${size}px`;
    this.containerEl.style.opacity = showIcon ? String(opacity) : "0";
    this.containerEl.style.display = showIcon ? "block" : "none";

    this.lastState = {
      visible: showIcon && opacity > 0,
      position,
      mode,
      iconStyle,
      size,
      opacity: showIcon ? opacity : 0,
      bearing,
      pngSrc,
    };
  }

  getState(): IconState {
    return { ...this.lastState };
  }

  // ── Video export: canvas rendering ──

  /**
   * Ensure the offscreen canvas Lottie renderer is ready for a given mode.
   * Used by VideoExporter for frame-accurate canvas compositing (Lottie styles only).
   */
  ensureCanvasRenderer(
    mode: TransportMode,
    iconStyle: TransportIconStyle,
  ): Promise<HTMLCanvasElement> {
    if (!this.canvasEl) {
      this.canvasEl = document.createElement("canvas");
      this.canvasEl.width = BASE_SIZE * 2;
      this.canvasEl.height = BASE_SIZE * 2;
    }

    const key = getTransportIconAssetKey(mode, iconStyle);

    if (this.canvasInstances.has(key)) {
      return Promise.resolve(this.canvasEl);
    }

    const ctx = this.canvasEl.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    const canvas = this.canvasEl;

    return new Promise<HTMLCanvasElement>((resolve) => {
      const instance = lottie.loadAnimation({
        renderer: "canvas",
        loop: true,
        autoplay: false,
        path: getTransportIconAssetPath(mode, iconStyle),
        rendererSettings: {
          context: canvas.getContext("2d")!,
          preserveAspectRatio: "xMidYMid meet",
        },
      } as Parameters<typeof lottie.loadAnimation>[0]);
      this.canvasInstances.set(key, instance);
      instance.addEventListener("DOMLoaded", () => {
        resolve(canvas);
      });
    });
  }

  /**
   * Pre-load a PNG icon for video export compositing (solid style).
   * Returns a promise that resolves when the image is loaded.
   */
  ensurePngImage(mode: TransportMode, direction: IconDirection): Promise<void> {
    const src = getTransportIconPngPath(mode, direction);
    if (this.pngImages.has(src)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.pngImages.set(src, img);
        resolve();
      };
      img.onerror = () => {
        // Silently skip — icon won't render during export
        resolve();
      };
      img.src = src;
    });
  }

  /**
   * Draw the current icon frame onto an export canvas context.
   * For solid style: draws the static PNG (no rotation — directional variants handle it).
   * For Lottie styles: draws the animated Lottie frame with bearing rotation.
   */
  drawToCanvas(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    size: number,
  ): void {
    const state = this.lastState;
    if (
      !state.visible ||
      !state.position ||
      state.opacity <= 0 ||
      !state.mode ||
      !state.iconStyle
    ) {
      return;
    }

    if (isSolidStyle(state.iconStyle)) {
      // Solid style: draw cached PNG (no rotation — directional variant is correct)
      if (!state.pngSrc) return;
      const img = this.pngImages.get(state.pngSrc);
      if (!img) return;

      const prev = ctx.globalAlpha;
      ctx.save();
      ctx.globalAlpha = state.opacity;
      ctx.drawImage(img, px - size / 2, py - size / 2, size, size);
      ctx.restore();
      ctx.globalAlpha = prev;
    } else {
      // Lottie style: draw animated frame with bearing rotation
      const canvasInstance = this.canvasInstances.get(
        getTransportIconAssetKey(state.mode, state.iconStyle),
      );
      if (!canvasInstance || !this.canvasEl) return;

      this.lottieFrame = (this.lottieFrame + 1) % Math.max(canvasInstance.totalFrames, 1);
      canvasInstance.goToAndStop(this.lottieFrame, true);

      const prev = ctx.globalAlpha;
      ctx.save();
      ctx.globalAlpha = state.opacity;
      ctx.translate(px, py);
      ctx.rotate((state.bearing - LOTTIE_FACING_OFFSET) * Math.PI / 180);
      ctx.drawImage(this.canvasEl, -size / 2, -size / 2, size, size);
      ctx.restore();
      ctx.globalAlpha = prev;
    }
  }

  private getSegmentAtProgress(
    group: AnimationGroup,
    totalLength: number,
    phase: AnimationPhase,
    progress: number
  ): Segment {
    if (group.segments.length <= 1) return group.segments[0];
    if (phase === "ARRIVE" || phase === "ZOOM_IN") {
      return group.segments[group.segments.length - 1];
    }
    if (phase === "HOVER") {
      return group.segments[0];
    }

    const distance = phase === "ZOOM_OUT"
      ? progress * 0.05 * totalLength
      : progress * totalLength;

    let accumulated = 0;
    for (const seg of group.segments) {
      if (!seg.geometry || seg.geometry.coordinates.length < 2) continue;
      const segLength = turf.length(turf.lineString(seg.geometry.coordinates));
      accumulated += segLength;
      if (distance <= accumulated) {
        return seg;
      }
    }

    return group.segments[group.segments.length - 1];
  }

  hide() {
    if (this.activeInstance) {
      this.activeInstance.pause();
    }
    this.containerEl.style.display = "none";
  }

  destroy() {
    // Destroy SVG marker Lottie instances
    for (const instance of this.lottieInstances.values()) {
      instance.stop();
      instance.destroy();
    }
    this.lottieInstances.clear();
    this.activeInstance = null;
    this.currentMode = null;
    this.currentIconStyle = null;

    // Destroy canvas renderer Lottie instances
    for (const instance of this.canvasInstances.values()) {
      instance.stop();
      instance.destroy();
    }
    this.canvasInstances.clear();
    this.canvasEl = null;

    // Clear PNG image cache
    this.pngImages.clear();

    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
