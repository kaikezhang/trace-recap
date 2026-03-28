import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import type { Segment, AnimationPhase, TransportMode } from "@/types";

// 4 direction variants per transport mode
// Bearing ranges: right (315-45°), down (45-135°), left (135-225°), up (225-315°)
type Direction = "right" | "down" | "left" | "up";

function bearingToDirection(bearing: number): Direction {
  // Normalize bearing to 0-360
  const b = ((bearing % 360) + 360) % 360;
  if (b >= 315 || b < 45) return "right";
  if (b >= 45 && b < 135) return "down";
  if (b >= 135 && b < 225) return "left";
  return "up";
}

function getIconPath(mode: TransportMode, direction: Direction): string {
  return `/icons/${mode}-${direction}.png`;
}

const BASE_SIZE = 52;

export class IconAnimator {
  private map: mapboxgl.Map;
  private segments: Segment[];
  private marker: mapboxgl.Marker | null = null;
  private iconEl: HTMLDivElement;
  private imgEl: HTMLImageElement;
  private currentIconKey: string = "";

  constructor(map: mapboxgl.Map, segments: Segment[]) {
    this.map = map;
    this.segments = segments;

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

  update(segmentIndex: number, phase: AnimationPhase, progress: number) {
    const seg = this.segments[segmentIndex];
    if (!seg) return;

    this.ensureMarker();

    const routeLine = seg.geometry;
    if (!routeLine || routeLine.coordinates.length < 2) {
      this.iconEl.style.display = "none";
      return;
    }

    const line = turf.lineString(routeLine.coordinates);
    const totalLength = turf.length(line);
    const coords = routeLine.coordinates;

    // Fixed bearing for the entire segment: from start to end
    const startPt = coords[0] as [number, number];
    const endPt = coords[coords.length - 1] as [number, number];
    const bearing = turf.bearing(turf.point(startPt), turf.point(endPt));
    const direction = bearingToDirection(bearing);

    // Set the correct directional icon (no CSS rotation needed!)
    this.setIcon(seg.transportMode, direction);

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
