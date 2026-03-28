import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import type { AnimationGroup, AnimationPhase, TransportMode } from "@/types";

// 4 direction variants per transport mode
// Bearing ranges: right (315-45°), down (45-135°), left (135-225°), up (225-315°)
type Direction = "right" | "down" | "left" | "up";

function bearingToDirection(bearing: number): Direction {
  // turf.bearing: 0°=North, 90°=East, 180°=South, 270°=West
  // Map to icon direction:
  //   North (315°-45°)  → up icon
  //   East  (45°-135°)  → right icon
  //   South (135°-225°) → down icon
  //   West  (225°-315°) → left icon
  const b = ((bearing % 360) + 360) % 360;
  if (b >= 315 || b < 45) return "up";
  if (b >= 45 && b < 135) return "right";
  if (b >= 135 && b < 225) return "down";
  return "left";
}

function getIconPath(mode: TransportMode, direction: Direction): string {
  return `/icons/${mode}-${direction}.png`;
}

const BASE_SIZE = 52;

export interface IconState {
  visible: boolean;
  position: [number, number] | null;
  iconSrc: string;
  size: number;
  opacity: number;
}

export class IconAnimator {
  private map: mapboxgl.Map;
  private groups: AnimationGroup[];
  private marker: mapboxgl.Marker | null = null;
  private iconEl: HTMLDivElement;
  private imgEl: HTMLImageElement;
  private currentIconKey: string = "";
  private lastState: IconState = {
    visible: false,
    position: null,
    iconSrc: "",
    size: BASE_SIZE,
    opacity: 1,
  };

  constructor(map: mapboxgl.Map, groups: AnimationGroup[]) {
    this.map = map;
    this.groups = groups;

    this.iconEl = document.createElement("div");
    this.iconEl.style.cssText = `
      width:${BASE_SIZE}px;height:${BASE_SIZE}px;
      pointer-events:none;
      transition:opacity 0.3s ease;
      display:flex;align-items:center;justify-content:center;
    `;

    this.imgEl = document.createElement("img");
    this.imgEl.style.cssText = `
      width:100%;height:100%;
      object-fit:contain;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));
    `;
    this.iconEl.appendChild(this.imgEl);
  }

  private ensureMarker() {
    if (!this.marker) {
      this.marker = new mapboxgl.Marker({
        element: this.iconEl,
        anchor: "center",
        // No rotation — we use directional icon variants instead
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([0, 0])
        .addTo(this.map);
    }
  }

  private setIcon(mode: TransportMode, direction: Direction) {
    const key = `${mode}-${direction}`;
    if (key === this.currentIconKey) return;
    this.currentIconKey = key;
    this.imgEl.src = getIconPath(mode, direction);
  }

  update(groupIndex: number, phase: AnimationPhase, progress: number) {
    const group = this.groups[groupIndex];
    if (!group) return;

    this.ensureMarker();

    const routeLine = group.mergedGeometry;
    if (!routeLine || routeLine.coordinates.length < 2) {
      this.iconEl.style.display = "none";
      return;
    }

    const line = turf.lineString(routeLine.coordinates);
    const totalLength = turf.length(line);
    const coords = routeLine.coordinates;

    // Fixed bearing for the entire group: from start to end
    const startPt = coords[0] as [number, number];
    const endPt = coords[coords.length - 1] as [number, number];
    const bearing = turf.bearing(turf.point(startPt), turf.point(endPt));
    const direction = bearingToDirection(bearing);

    // Determine which sub-segment the current position is on for the correct icon
    const mode = this.getTransportModeAtProgress(group, totalLength, phase, progress);
    this.setIcon(mode, direction);

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
    // NO rotation — directional variant handles it
    this.marker!.setRotation(0);

    const size = Math.round(BASE_SIZE * scale);
    this.iconEl.style.width = `${size}px`;
    this.iconEl.style.height = `${size}px`;
    this.iconEl.style.opacity = showIcon ? String(opacity) : "0";
    this.iconEl.style.display = showIcon ? "block" : "none";

    // Store state for canvas compositing (video export)
    this.lastState = {
      visible: showIcon && opacity > 0,
      position,
      iconSrc: this.imgEl.src,
      size,
      opacity: showIcon ? opacity : 0,
    };
  }

  getState(): IconState {
    return { ...this.lastState };
  }

  private getTransportModeAtProgress(
    group: AnimationGroup,
    totalLength: number,
    phase: AnimationPhase,
    progress: number
  ): TransportMode {
    // For single-segment groups or non-FLY phases, use the first/last segment
    if (group.segments.length <= 1) return group.segments[0].transportMode;
    if (phase === "ARRIVE" || phase === "ZOOM_IN") {
      return group.segments[group.segments.length - 1].transportMode;
    }
    if (phase === "HOVER") {
      return group.segments[0].transportMode;
    }

    // For FLY and ZOOM_OUT, determine position along the merged route
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
    this.iconEl.style.display = "none";
  }

  destroy() {
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
