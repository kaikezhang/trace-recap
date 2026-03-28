import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import type { Segment, AnimationPhase, TransportMode } from "@/types";

// PNG icon paths (served from /public/icons/)
// All icons face RIGHT (east = bearing 90°) by default
const ICON_PATHS: Record<TransportMode, string> = {
  flight: "/icons/flight.png",
  car: "/icons/car.png",
  train: "/icons/train.png",
  bus: "/icons/bus.png",
  ferry: "/icons/ferry.png",
  walk: "/icons/walk.png",
  bicycle: "/icons/bicycle.png",
};

// Icons face right (east), so bearing 90° = no rotation needed
// To point the icon in the direction of travel (bearing from turf),
// we subtract 90° because turf bearing is clockwise from north
const ICON_BEARING_OFFSET = -90;

const BASE_SIZE = 52;

export class IconAnimator {
  private map: mapboxgl.Map;
  private segments: Segment[];
  private marker: mapboxgl.Marker | null = null;
  private iconEl: HTMLDivElement;
  private imgEl: HTMLImageElement;
  private currentMode: string = "";
  private prevBearing: number = 0;

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
        rotationAlignment: "map",
        pitchAlignment: "map",
      })
        .setLngLat([0, 0])
        .addTo(this.map);
    }
  }

  private setIcon(mode: TransportMode) {
    if (mode === this.currentMode) return;
    this.currentMode = mode;
    this.imgEl.src = ICON_PATHS[mode] || ICON_PATHS.flight;
  }

  update(segmentIndex: number, phase: AnimationPhase, progress: number) {
    const seg = this.segments[segmentIndex];
    if (!seg) return;

    this.ensureMarker();
    this.setIcon(seg.transportMode);

    const routeLine = seg.geometry;
    if (!routeLine || routeLine.coordinates.length < 2) {
      this.iconEl.style.display = "none";
      return;
    }

    const line = turf.lineString(routeLine.coordinates);
    const totalLength = turf.length(line);
    const coords = routeLine.coordinates;

    let position: [number, number];
    let bearing = 0;
    let showIcon = true;
    let scale = 1.0;
    let opacity = 1.0;

    switch (phase) {
      case "HOVER": {
        position = coords[0] as [number, number];
        const nextPt = coords[Math.min(5, coords.length - 1)] as [number, number];
        bearing = turf.bearing(turf.point(position), turf.point(nextPt));
        break;
      }
      case "ZOOM_OUT": {
        const earlyProgress = progress * 0.05;
        const along = turf.along(line, earlyProgress * totalLength);
        position = along.geometry.coordinates as [number, number];
        const lookAhead = turf.along(line, Math.min(0.1, earlyProgress + 0.05) * totalLength);
        bearing = turf.bearing(along, lookAhead);
        scale = lerp(1.0, 1.15, progress);
        break;
      }
      case "FLY": {
        const along = turf.along(line, progress * totalLength);
        position = along.geometry.coordinates as [number, number];
        const aheadDist = Math.min((progress + 0.05) * totalLength, totalLength);
        const ahead = turf.along(line, aheadDist);
        const rawBearing = turf.bearing(along, ahead);
        // Smooth bearing changes to avoid jerky rotation
        bearing = smoothBearing(this.prevBearing, rawBearing, 0.15);
        scale = 1.15;
        break;
      }
      case "ZOOM_IN": {
        position = coords[coords.length - 1] as [number, number];
        bearing = this.prevBearing; // Keep last bearing
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

    this.prevBearing = bearing;
    this.marker!.setLngLat(position);

    // Apply rotation: turf.bearing gives clockwise from north
    // Our icons face right (east = 90° from north)
    // So rotation = bearing + offset
    this.marker!.setRotation(bearing + ICON_BEARING_OFFSET);

    // Apply scale
    const size = Math.round(BASE_SIZE * scale);
    this.iconEl.style.width = `${size}px`;
    this.iconEl.style.height = `${size}px`;

    // Apply opacity
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

function smoothBearing(current: number, target: number, smoothing: number): number {
  // Handle angle wrapping
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return current + diff * smoothing;
}
