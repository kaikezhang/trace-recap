import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import type { Segment, AnimationPhase, TransportMode } from "@/types";

// Inline SVG icons — all point NORTH (up) by default
// so setRotation(bearing) will orient them correctly
const ICON_SVGS: Record<TransportMode, string> = {
  flight: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2L24 16H36L20 38L4 16H16L20 2Z" fill="#6366f1" stroke="#4338ca" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="20" cy="18" r="2.5" fill="white"/>
  </svg>`,
  car: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="8" width="16" height="24" rx="4" fill="#f59e0b" stroke="#d97706" stroke-width="1.5"/>
    <rect x="14" y="10" width="12" height="6" rx="2" fill="#fef3c7"/>
    <circle cx="16" cy="28" r="2" fill="#78716c"/>
    <circle cx="24" cy="28" r="2" fill="#78716c"/>
  </svg>`,
  train: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="6" width="20" height="28" rx="4" fill="#10b981" stroke="#059669" stroke-width="1.5"/>
    <rect x="13" y="9" width="14" height="8" rx="2" fill="#d1fae5"/>
    <circle cx="14" cy="30" r="2" fill="#78716c"/>
    <circle cx="26" cy="30" r="2" fill="#78716c"/>
  </svg>`,
  bus: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="6" width="20" height="28" rx="4" fill="#8b5cf6" stroke="#7c3aed" stroke-width="1.5"/>
    <rect x="12" y="8" width="16" height="10" rx="2" fill="#ede9fe"/>
    <circle cx="14" cy="30" r="2" fill="#78716c"/>
    <circle cx="26" cy="30" r="2" fill="#78716c"/>
  </svg>`,
  ferry: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 24C8 24 12 18 20 18C28 18 32 24 32 24L30 32H10L8 24Z" fill="#06b6d4" stroke="#0891b2" stroke-width="1.5"/>
    <rect x="17" y="10" width="6" height="8" rx="1" fill="#ecfeff" stroke="#06b6d4" stroke-width="1"/>
  </svg>`,
  walk: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="8" r="4" fill="#ec4899"/>
    <path d="M20 12V24L16 34" stroke="#db2777" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 24L24 34" stroke="#db2777" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M14 18L20 14L26 18" stroke="#db2777" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  bicycle: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="26" r="6" stroke="#0d9488" stroke-width="2" fill="none"/>
    <circle cx="28" cy="26" r="6" stroke="#0d9488" stroke-width="2" fill="none"/>
    <path d="M12 26L18 12H24L28 26" stroke="#14b8a6" stroke-width="2" stroke-linecap="round"/>
    <circle cx="18" cy="10" r="2.5" fill="#14b8a6"/>
  </svg>`,
};

export class IconAnimator {
  private map: mapboxgl.Map;
  private segments: Segment[];
  private marker: mapboxgl.Marker | null = null;
  private iconEl: HTMLDivElement;
  private currentMode: string = "";

  constructor(map: mapboxgl.Map, segments: Segment[]) {
    this.map = map;
    this.segments = segments;

    this.iconEl = document.createElement("div");
    this.iconEl.style.cssText =
      "width:44px;height:44px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));pointer-events:none;";
  }

  private ensureMarker() {
    if (!this.marker) {
      this.marker = new mapboxgl.Marker({
        element: this.iconEl,
        anchor: "center",
        // rotationAlignment "map" makes the icon rotate with map bearing
        // but since bearing is always 0, "viewport" also works
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([0, 0])
        .addTo(this.map);
    }
  }

  private setIcon(mode: TransportMode) {
    if (mode === this.currentMode) return;
    this.currentMode = mode;
    this.iconEl.innerHTML = ICON_SVGS[mode] || ICON_SVGS.flight;
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

    switch (phase) {
      case "HOVER": {
        position = coords[0] as [number, number];
        // Point toward next point on route
        const nextPt = coords[Math.min(5, coords.length - 1)] as [number, number];
        bearing = turf.bearing(turf.point(position), turf.point(nextPt));
        break;
      }
      case "ZOOM_OUT": {
        // Move slightly along route
        const earlyProgress = progress * 0.05;
        const along = turf.along(line, earlyProgress * totalLength);
        position = along.geometry.coordinates as [number, number];
        const lookAhead = turf.along(
          line,
          Math.min(0.1, earlyProgress + 0.05) * totalLength
        );
        bearing = turf.bearing(along, lookAhead);
        break;
      }
      case "FLY": {
        const along = turf.along(line, progress * totalLength);
        position = along.geometry.coordinates as [number, number];
        // Look ahead for smooth bearing
        const aheadDist = Math.min((progress + 0.05) * totalLength, totalLength);
        const ahead = turf.along(line, aheadDist);
        bearing = turf.bearing(along, ahead);
        break;
      }
      case "ZOOM_IN": {
        position = coords[coords.length - 1] as [number, number];
        showIcon = progress < 0.5;
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
    // setRotation: degrees clockwise from north
    // Our SVG icons point NORTH by default, so bearing maps directly
    this.marker!.setRotation(bearing);
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
