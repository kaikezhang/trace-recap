import * as turf from "@turf/turf";
import type mapboxgl from "mapbox-gl";
import type {
  Location,
  Segment,
  AnimationGroup,
  SegmentTiming,
  AnimationPhase,
} from "@/types";
import { CameraController } from "./CameraController";
import { IconAnimator } from "./IconAnimator";
import { PHASE_DURATIONS, TARGET_DURATION } from "@/lib/constants";

export type AnimationEventType =
  | "progress"
  | "phaseChange"
  | "segmentChange"
  | "complete"
  | "routeDrawProgress";

export interface AnimationEvent {
  type: AnimationEventType;
  time: number;
  progress: number;
  segmentIndex: number;
  phase: AnimationPhase;
  cityLabel: string | null;
  showPhotos: boolean;
  /** For routeDrawProgress: fraction of route drawn (0-1) */
  routeDrawFraction?: number;
  /** The animation group index for this event */
  groupIndex: number;
  /** All segment indices in the current group (for route drawing) */
  groupSegmentIndices: number[];
}

type AnimationListener = (event: AnimationEvent) => void;

/** Build animation groups by merging segments connected by waypoints */
function buildAnimationGroups(
  locations: Location[],
  segments: Segment[]
): AnimationGroup[] {
  if (segments.length === 0) return [];

  const groups: AnimationGroup[] = [];
  let currentSegments: Segment[] = [];
  let currentLocations: Location[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const fromLoc = locations.find((l) => l.id === seg.fromId)!;
    const toLoc = locations.find((l) => l.id === seg.toId)!;

    if (currentSegments.length === 0) {
      currentSegments = [seg];
      currentLocations = [fromLoc, toLoc];
    } else {
      // The "from" of this segment is the "to" of the previous one.
      // If that connecting location is a waypoint, merge into the current group.
      if (fromLoc.isWaypoint) {
        currentSegments.push(seg);
        currentLocations.push(toLoc);
      } else {
        // Finalize the current group
        groups.push(finalizeGroup(currentSegments, currentLocations));
        currentSegments = [seg];
        currentLocations = [fromLoc, toLoc];
      }
    }
  }

  // Finalize last group
  if (currentSegments.length > 0) {
    groups.push(finalizeGroup(currentSegments, currentLocations));
  }

  return groups;
}

function finalizeGroup(
  segments: Segment[],
  allLocations: Location[]
): AnimationGroup {
  // Merge geometries: concatenate all segment coordinates into one LineString
  let mergedGeometry: GeoJSON.LineString | null = null;

  const allGeometries = segments.map((s) => s.geometry).filter(Boolean) as GeoJSON.LineString[];
  if (allGeometries.length > 0) {
    const mergedCoords: number[][] = [];
    for (let i = 0; i < allGeometries.length; i++) {
      const coords = allGeometries[i].coordinates;
      const startIdx = i === 0 ? 0 : 1; // Skip first coord on subsequent segments
      for (let j = startIdx; j < coords.length; j++) {
        const coord = coords[j];
        if (mergedCoords.length > 0) {
          const prevLng = mergedCoords[mergedCoords.length - 1][0];
          let lng = coord[0];
          // Unwrap longitude to keep continuous with previous point
          while (lng - prevLng > 180) lng -= 360;
          while (lng - prevLng < -180) lng += 360;
          mergedCoords.push([lng, coord[1]]);
        } else {
          mergedCoords.push([...coord]);
        }
      }
    }
    if (mergedCoords.length >= 2) {
      mergedGeometry = { type: "LineString", coordinates: mergedCoords };
    }
  }

  return {
    segments: [...segments],
    fromLoc: allLocations[0],
    toLoc: allLocations[allLocations.length - 1],
    allLocations: [...allLocations],
    mergedGeometry,
  };
}

export class AnimationEngine {
  private map: mapboxgl.Map;
  private locations: Location[];
  private segments: Segment[];
  private groups: AnimationGroup[];
  private timeline: SegmentTiming[];
  private totalDuration: number;
  private camera: CameraController;
  private iconAnimator: IconAnimator;
  private listeners: Map<AnimationEventType, AnimationListener[]>;

  // Map from group index to the original segment indices
  private groupSegmentIndices: number[][];

  private animFrameId: number | null = null;
  private startTime: number | null = null;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;

  constructor(
    map: mapboxgl.Map,
    locations: Location[],
    segments: Segment[]
  ) {
    this.map = map;
    this.locations = locations;
    this.segments = segments;
    this.listeners = new Map();

    // Build animation groups
    this.groups = buildAnimationGroups(locations, segments);

    // Build segment index mapping
    this.groupSegmentIndices = this.groups.map((group) =>
      group.segments.map((seg) => segments.indexOf(seg))
    );

    this.camera = new CameraController(this.groups);
    this.iconAnimator = new IconAnimator(map, this.groups);
    this.timeline = this.computeTimeline();
    this.totalDuration = this.computeTotalDuration();
  }

  getGroups(): AnimationGroup[] {
    return this.groups;
  }

  getIconAnimator(): IconAnimator {
    return this.iconAnimator;
  }

  getSegments(): Segment[] {
    return this.segments;
  }

  private computeTimeline(): SegmentTiming[] {
    const n = this.groups.length;
    if (n === 0) return [];

    // Each group gets ~4s base + proportional fly time
    // Minimum 20s, scales with number of stops
    const totalTarget = Math.min(
      TARGET_DURATION.max,
      Math.max(TARGET_DURATION.min, n * 4)
    );

    const arriveTime = PHASE_DURATIONS.ARRIVE;
    const photoTime = PHASE_DURATIONS.PHOTO_DISPLAY;

    const timeline: SegmentTiming[] = [];
    let currentTime = 0;

    let totalFixed = 0;
    for (let i = 0; i < n; i++) {
      const hoverTime = this.camera.getHoverDuration(i);
      totalFixed += hoverTime + arriveTime;
      const toLoc = this.groups[i].toLoc;
      if (toLoc.photos.length > 0) {
        totalFixed += photoTime;
      }
    }

    const totalVariable = Math.max(totalTarget - totalFixed, n * 1.5);

    // Compute each group's merged route length for proportional FLY timing
    const groupLengths = this.groups.map((g) => {
      if (g.mergedGeometry && g.mergedGeometry.coordinates.length >= 2) {
        try {
          return turf.length(turf.lineString(g.mergedGeometry.coordinates));
        } catch {
          return 0;
        }
      }
      return 0;
    });
    const totalRouteLength = groupLengths.reduce((sum, l) => sum + l, 0);

    for (let i = 0; i < n; i++) {
      const group = this.groups[i];
      const hasPhotos = group.toLoc.photos.length > 0;

      // Distribute variable time proportionally to route length
      const proportion = totalRouteLength > 0
        ? groupLengths[i] / totalRouteLength
        : 1 / n;
      const variableForGroup = totalVariable * proportion;

      const hoverTime = this.camera.getHoverDuration(i);
      // Minimum 1.5s for variable portion so short legs aren't invisible
      const effectiveVariable = Math.max(variableForGroup, 1.5);
      const zoomOutDur = effectiveVariable * 0.2;
      const flyDur = effectiveVariable * 0.65;  // longer fly, zoom happens during fly
      const zoomInDur = effectiveVariable * 0.15; // shorter, just final settle
      const arriveDur = arriveTime + (hasPhotos ? photoTime : 0);

      const phases: SegmentTiming["phases"] = [
        { phase: "HOVER", startTime: currentTime, duration: hoverTime },
        {
          phase: "ZOOM_OUT",
          startTime: currentTime + hoverTime,
          duration: zoomOutDur,
        },
        {
          phase: "FLY",
          startTime: currentTime + hoverTime + zoomOutDur,
          duration: flyDur,
        },
        {
          phase: "ZOOM_IN",
          startTime: currentTime + hoverTime + zoomOutDur + flyDur,
          duration: zoomInDur,
        },
        {
          phase: "ARRIVE",
          startTime:
            currentTime + hoverTime + zoomOutDur + flyDur + zoomInDur,
          duration: arriveDur,
        },
      ];

      const segDuration =
        hoverTime + zoomOutDur + flyDur + zoomInDur + arriveDur;

      // Use the first segment's id as the timeline entry id
      timeline.push({
        segmentId: group.segments[0].id,
        startTime: currentTime,
        duration: segDuration,
        phases,
      });

      currentTime += segDuration;
    }

    return timeline;
  }

  private computeTotalDuration(): number {
    if (this.timeline.length === 0) return 0;
    const last = this.timeline[this.timeline.length - 1];
    return last.startTime + last.duration;
  }

  getTimeline(): SegmentTiming[] {
    return this.timeline;
  }

  getTotalDuration(): number {
    return this.totalDuration;
  }

  on(event: AnimationEventType, listener: AnimationListener) {
    const list = this.listeners.get(event) || [];
    list.push(listener);
    this.listeners.set(event, list);
  }

  private emit(event: AnimationEvent) {
    const list = this.listeners.get(event.type) || [];
    for (const fn of list) fn(event);
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.startTime = performance.now() - this.pausedAt * 1000;
    this.tick();
  }

  pause() {
    this.isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  reset() {
    this.pause();
    this.pausedAt = 0;
    this.startTime = null;
    this.seekTo(0);
    this.iconAnimator.hide();
  }

  seekTo(progress: number) {
    const time = progress * this.totalDuration;
    this.pausedAt = time;
    if (this.isPlaying) {
      this.startTime = performance.now() - time * 1000;
    }
    this.renderFrame(time);
  }

  getCurrentTime(): number {
    return this.pausedAt;
  }

  private tick = () => {
    if (!this.isPlaying || this.startTime === null) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    this.pausedAt = elapsed;

    if (elapsed >= this.totalDuration) {
      this.renderFrame(this.totalDuration);
      this.isPlaying = false;
      const lastGroupIdx = this.groups.length - 1;
      this.emit({
        type: "complete",
        time: this.totalDuration,
        progress: 1,
        segmentIndex: this.segments.length - 1,
        phase: "ARRIVE",
        cityLabel: null,
        showPhotos: false,
        groupIndex: lastGroupIdx,
        groupSegmentIndices: this.groupSegmentIndices[lastGroupIdx] ?? [],
      });
      return;
    }

    this.renderFrame(elapsed);
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  renderFrame(time: number) {
    const clamped = Math.max(0, Math.min(time, this.totalDuration));
    const { groupIndex, phase, phaseProgress } =
      this.resolveTimePosition(clamped);

    if (groupIndex < 0) return;

    const group = this.groups[groupIndex];
    const segIndices = this.groupSegmentIndices[groupIndex];
    // Use last segment index in the group as the "current segment index" for compatibility
    const segmentIndex = segIndices[segIndices.length - 1];

    // Camera
    const cameraState = this.camera.getCameraState(
      groupIndex,
      phase,
      phaseProgress
    );
    this.map.jumpTo({
      center: cameraState.center,
      zoom: cameraState.zoom,
      bearing: cameraState.bearing,
      pitch: cameraState.pitch,
    });

    // Icon
    this.iconAnimator.update(groupIndex, phase, phaseProgress);

    // City label — only for destinations (group endpoints), not waypoints
    let cityLabel: string | null = null;
    if (phase === "HOVER") cityLabel = group.fromLoc.name;
    else if (phase === "ARRIVE") cityLabel = group.toLoc.name;

    // Photos
    const showPhotos = phase === "ARRIVE" && group.toLoc.photos.length > 0;

    const progress = clamped / this.totalDuration;
    this.emit({
      type: "progress",
      time: clamped,
      progress,
      segmentIndex,
      phase,
      cityLabel,
      showPhotos,
      groupIndex,
      groupSegmentIndices: segIndices,
    });

    // Route draw progress for all segments in the group
    if (phase === "HOVER" || phase === "ZOOM_OUT") {
      this.emit({
        type: "routeDrawProgress",
        time: clamped,
        progress,
        segmentIndex,
        phase,
        cityLabel: null,
        showPhotos: false,
        routeDrawFraction: 0,
        groupIndex,
        groupSegmentIndices: segIndices,
      });
    }

    if (phase === "FLY") {
      const easing = this.camera.getEasing("FLY");
      this.emit({
        type: "routeDrawProgress",
        time: clamped,
        progress,
        segmentIndex,
        phase,
        cityLabel: null,
        showPhotos: false,
        routeDrawFraction: easing(phaseProgress),
        groupIndex,
        groupSegmentIndices: segIndices,
      });
    } else if (phase === "ZOOM_IN" || phase === "ARRIVE") {
      this.emit({
        type: "routeDrawProgress",
        time: clamped,
        progress,
        segmentIndex,
        phase,
        cityLabel: null,
        showPhotos: false,
        routeDrawFraction: 1,
        groupIndex,
        groupSegmentIndices: segIndices,
      });
    }
  }

  private resolveTimePosition(time: number): {
    groupIndex: number;
    phase: AnimationPhase;
    phaseProgress: number;
  } {
    for (let i = 0; i < this.timeline.length; i++) {
      const st = this.timeline[i];
      if (time >= st.startTime && time <= st.startTime + st.duration) {
        for (const p of st.phases) {
          if (time >= p.startTime && time <= p.startTime + p.duration) {
            const phaseProgress =
              p.duration > 0 ? (time - p.startTime) / p.duration : 1;
            return {
              groupIndex: i,
              phase: p.phase,
              phaseProgress: Math.min(1, phaseProgress),
            };
          }
        }
        const lastPhase = st.phases[st.phases.length - 1];
        return { groupIndex: i, phase: lastPhase.phase, phaseProgress: 1 };
      }
    }

    if (this.timeline.length > 0) {
      return {
        groupIndex: this.timeline.length - 1,
        phase: "ARRIVE",
        phaseProgress: 1,
      };
    }
    return { groupIndex: -1, phase: "HOVER", phaseProgress: 0 };
  }

  destroy() {
    this.pause();
    this.iconAnimator.destroy();
    this.listeners.clear();
  }
}
