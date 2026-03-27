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
      "width:36px;height:36px;transition:transform 0.1s ease;";
  }

  private ensureMarker() {
    if (!this.marker) {
      this.marker = new mapboxgl.Marker({
        element: this.iconEl,
        anchor: "center",
      })
        .setLngLat([0, 0])
        .addTo(this.map);
    }
  }

  private setIcon(mode: string) {
    if (mode === this.currentMode) return;
    this.currentMode = mode;
    // Use emoji as fallback since SVG loading in markers is complex
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
    this.iconEl.style.fontSize = "28px";
    this.iconEl.style.lineHeight = "36px";
    this.iconEl.style.textAlign = "center";
  }

  update(
    segmentIndex: number,
    phase: AnimationPhase,
    progress: number
  ) {
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

    let position: [number, number];
    let rotation = 0;

    switch (phase) {
      case "HOVER": {
        position = routeLine.coordinates[0] as [number, number];
        break;
      }
      case "ZOOM_OUT": {
        position = routeLine.coordinates[0] as [number, number];
        break;
      }
      case "FLY": {
        const along = turf.along(line, progress * totalLength);
        position = along.geometry.coordinates as [number, number];

        // Look ahead for rotation
        const aheadDist = Math.min((progress + 0.02) * totalLength, totalLength);
        const ahead = turf.along(line, aheadDist);
        rotation = turf.bearing(along, ahead);
        break;
      }
      case "ZOOM_IN": {
        position = routeLine.coordinates[
          routeLine.coordinates.length - 1
        ] as [number, number];
        break;
      }
      case "ARRIVE": {
        position = routeLine.coordinates[
          routeLine.coordinates.length - 1
        ] as [number, number];
        break;
      }
      default:
        position = routeLine.coordinates[0] as [number, number];
    }

    this.marker!.setLngLat(position);

    // Only rotate for flight mode (other modes look better upright)
    if (seg.transportMode === "flight") {
      this.iconEl.style.transform = `rotate(${rotation}deg)`;
    } else {
      this.iconEl.style.transform = "";
    }
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
