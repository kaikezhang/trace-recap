import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import lottie from "lottie-web";
import type { AnimationItem } from "lottie-web";
import type { AnimationGroup, AnimationPhase, TransportMode } from "@/types";

const BASE_SIZE = 52;

/** All Lottie animations face right (east = 90°). Rotation offset to convert bearing to CSS rotation. */
const LOTTIE_FACING_OFFSET = 90;

export interface IconState {
  visible: boolean;
  position: [number, number] | null;
  /** Current transport mode (used by VideoExporter to identify the active Lottie) */
  mode: TransportMode | null;
  size: number;
  opacity: number;
  /** Current bearing in degrees (0 = north). Used for rotation during canvas compositing. */
  bearing: number;
}

export class IconAnimator {
  private map: mapboxgl.Map;
  private groups: AnimationGroup[];
  private marker: mapboxgl.Marker | null = null;
  private containerEl: HTMLDivElement;
  private lottieEl: HTMLDivElement;

  private currentMode: TransportMode | null = null;
  private currentBearing: number = 0;
  private lottieInstances: Map<TransportMode, AnimationItem> = new Map();
  private activeInstance: AnimationItem | null = null;
  private lottieFrame: number = 0;

  /** Offscreen canvas + Lottie instances for video export compositing */
  private canvasEl: HTMLCanvasElement | null = null;
  private canvasInstances: Map<TransportMode, AnimationItem> = new Map();

  private lastState: IconState = {
    visible: false,
    position: null,
    mode: null,
    size: BASE_SIZE,
    opacity: 1,
    bearing: 0,
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

    // Inner element that holds the Lottie SVG and gets rotated for direction
    this.lottieEl = document.createElement("div");
    this.lottieEl.style.cssText = `
      width:100%;height:100%;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));
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

  /** Load (or retrieve cached) Lottie animation for a transport mode in the SVG marker */
  private loadLottie(mode: TransportMode): AnimationItem {
    const existing = this.lottieInstances.get(mode);
    if (existing) return existing;

    const instance = lottie.loadAnimation({
      container: this.lottieEl,
      renderer: "svg",
      loop: true,
      autoplay: false,
      path: `/lottie/${mode}.json`,
    });

    this.lottieInstances.set(mode, instance);
    return instance;
  }

  /** Switch to a different transport mode's Lottie animation */
  private setMode(mode: TransportMode) {
    if (mode === this.currentMode) return;

    // Hide current animation's SVG
    if (this.activeInstance) {
      this.activeInstance.stop();
      const wrapper = (this.activeInstance as AnimationItem & { wrapper?: HTMLElement }).wrapper;
      if (wrapper) wrapper.style.display = "none";
    }

    this.currentMode = mode;
    this.activeInstance = this.loadLottie(mode);
    const wrapper = (this.activeInstance as AnimationItem & { wrapper?: HTMLElement }).wrapper;
    if (wrapper) wrapper.style.display = "block";
    this.activeInstance.play();
  }

  /** Rotate the Lottie element to match the travel bearing */
  private setDirection(bearing: number) {
    this.currentBearing = bearing;
    // Lottie icons face right (90°), so offset by 90 to align with map bearing
    this.lottieEl.style.transform = `rotate(${bearing - LOTTIE_FACING_OFFSET}deg)`;
  }

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

    const mode = this.getTransportModeAtProgress(group, totalLength, phase, progress);
    this.setMode(mode);

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
    this.setDirection(bearing);

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
      mode: this.currentMode,
      size,
      opacity: showIcon ? opacity : 0,
      bearing,
    };
  }

  getState(): IconState {
    return { ...this.lastState };
  }

  /**
   * Ensure the offscreen canvas Lottie renderer is ready for a given mode.
   * Used by VideoExporter for frame-accurate canvas compositing.
   */
  ensureCanvasRenderer(mode: TransportMode): Promise<HTMLCanvasElement> {
    if (!this.canvasEl) {
      this.canvasEl = document.createElement("canvas");
      this.canvasEl.width = BASE_SIZE * 2;
      this.canvasEl.height = BASE_SIZE * 2;
    }

    if (this.canvasInstances.has(mode)) {
      return Promise.resolve(this.canvasEl);
    }

    // Clear any prior content from the canvas for this new mode load
    const ctx = this.canvasEl.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    const canvas = this.canvasEl;

    return new Promise<HTMLCanvasElement>((resolve) => {
      // Cast needed: lottie-web types don't expose the canvas `context` option
      // in their overload signatures, but lottie-web supports it at runtime.
      const instance = lottie.loadAnimation({
        renderer: "canvas",
        loop: true,
        autoplay: false,
        path: `/lottie/${mode}.json`,
        rendererSettings: {
          context: canvas.getContext("2d")!,
          preserveAspectRatio: "xMidYMid meet",
        },
      } as Parameters<typeof lottie.loadAnimation>[0]);
      this.canvasInstances.set(mode, instance);
      instance.addEventListener("DOMLoaded", () => {
        resolve(canvas);
      });
    });
  }

  /**
   * Draw the current Lottie frame onto an export canvas context.
   * Called by VideoExporter instead of drawing a static PNG.
   */
  drawToCanvas(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    size: number,
  ): void {
    const state = this.lastState;
    if (!state.visible || !state.position || state.opacity <= 0 || !state.mode) return;

    const canvasInstance = this.canvasInstances.get(state.mode);
    if (!canvasInstance || !this.canvasEl) return;

    // Advance the Lottie frame on the canvas renderer
    this.lottieFrame = (this.lottieFrame + 1) % Math.max(canvasInstance.totalFrames, 1);
    canvasInstance.goToAndStop(this.lottieFrame, true);

    const prev = ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = state.opacity;
    ctx.translate(px, py);
    // Rotate to match bearing (Lottie faces right = 90°)
    ctx.rotate((state.bearing - LOTTIE_FACING_OFFSET) * Math.PI / 180);
    ctx.drawImage(this.canvasEl, -size / 2, -size / 2, size, size);
    ctx.restore();
    ctx.globalAlpha = prev;
  }

  private getTransportModeAtProgress(
    group: AnimationGroup,
    totalLength: number,
    phase: AnimationPhase,
    progress: number
  ): TransportMode {
    if (group.segments.length <= 1) return group.segments[0].transportMode;
    if (phase === "ARRIVE" || phase === "ZOOM_IN") {
      return group.segments[group.segments.length - 1].transportMode;
    }
    if (phase === "HOVER") {
      return group.segments[0].transportMode;
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
        return seg.transportMode;
      }
    }

    return group.segments[group.segments.length - 1].transportMode;
  }

  hide() {
    if (this.activeInstance) {
      this.activeInstance.pause();
    }
    this.containerEl.style.display = "none";
  }

  destroy() {
    // Destroy SVG marker instances
    for (const instance of this.lottieInstances.values()) {
      instance.stop();
      instance.destroy();
    }
    this.lottieInstances.clear();
    this.activeInstance = null;
    this.currentMode = null;

    // Destroy canvas renderer instances
    for (const instance of this.canvasInstances.values()) {
      instance.stop();
      instance.destroy();
    }
    this.canvasInstances.clear();
    this.canvasEl = null;

    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
