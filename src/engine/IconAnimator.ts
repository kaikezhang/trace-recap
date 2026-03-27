import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import type { Segment, AnimationPhase } from "@/types";

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
      "width:48px;height:48px;font-size:36px;line-height:48px;text-align:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));pointer-events:none;";
  }

  private ensureMarker() {
    if (!this.marker) {
      this.marker = new mapboxgl.Marker({
        element: this.iconEl,
        anchor: "center",
        pitchAlignment: "map",
        rotationAlignment: "map",
      })
        .setLngLat([0, 0])
        .addTo(this.map);
    }
  }

  private setIcon(mode: string) {
    if (mode === this.currentMode) return;
    this.currentMode = mode;
    const icons: Record<string, string> = {
      flight: "\u2708\uFE0F",
      car: "\uD83D\uDE97",
      train: "\uD83D\uDE84",
      bus: "\uD83D\uDE8C",
      ferry: "\u26F4\uFE0F",
      walk: "\uD83D\uDEB6",
      bicycle: "\uD83D\uDEB2",
    };
    this.iconEl.textContent = icons[mode] || "\u2708\uFE0F";
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

    this.iconEl.style.display = "block";

    const line = turf.lineString(routeLine.coordinates);
    const totalLength = turf.length(line);
    const coords = routeLine.coordinates;

    let position: [number, number];
    let rotation = 0;
    let showIcon = true;

    switch (phase) {
      case "HOVER": {
        position = coords[0] as [number, number];
        // Point in the direction of travel
        const nextPt = coords[Math.min(5, coords.length - 1)] as [number, number];
        rotation = turf.bearing(turf.point(position), turf.point(nextPt));
        break;
      }
      case "ZOOM_OUT": {
        // Icon starts moving slightly along the route during zoom out
        const earlyProgress = progress * 0.05; // move 5% of route during zoom-out
        const along = turf.along(line, earlyProgress * totalLength);
        position = along.geometry.coordinates as [number, number];
        const lookAhead = turf.along(line, Math.min(0.1, earlyProgress + 0.05) * totalLength);
        rotation = turf.bearing(along, lookAhead);
        break;
      }
      case "FLY": {
        const along = turf.along(line, progress * totalLength);
        position = along.geometry.coordinates as [number, number];

        // Look ahead for smooth rotation
        const aheadDist = Math.min((progress + 0.05) * totalLength, totalLength);
        const ahead = turf.along(line, aheadDist);
        rotation = turf.bearing(along, ahead);
        break;
      }
      case "ZOOM_IN": {
        // Icon at destination
        position = coords[coords.length - 1] as [number, number];
        showIcon = progress < 0.5; // fade out halfway through zoom-in
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
    this.marker!.setRotation(rotation);
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
