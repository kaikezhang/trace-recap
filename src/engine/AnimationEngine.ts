import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
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
  cityLabelZh: string | null;
  showPhotos: boolean;
  /** Opacity for photo overlay (0-1), used for fade-out transition */
  photoOpacity: number;
  /** For routeDrawProgress: fraction of route drawn (0-1) */
  routeDrawFraction?: number;
  /** The animation group index for this event */
  groupIndex: number;
  /** All segment indices in the current group (for route drawing) */
  groupSegmentIndices: number[];
  /** Scene transition progress (0-1): 0 = fully outgoing, 1 = fully incoming.
   *  Only set during the transition window between locations. */
  sceneTransitionProgress?: number;
  /** Group index of the outgoing (departing) location during a scene transition */
  outgoingGroupIndex?: number;
  /** Group index of the incoming (arriving) location during a scene transition */
  incomingGroupIndex?: number;
  /** Bearing from outgoing to incoming location (degrees), for wipe direction */
  transitionBearing?: number;
}

type AnimationListener = (event: AnimationEvent) => void;

/** Build animation groups — one group per segment, no merging for waypoints.
 *  Each waypoint segment gets its own FLY phase with 0 hover/arrive time. */
function buildAnimationGroups(
  locations: Location[],
  segments: Segment[]
): AnimationGroup[] {
  if (segments.length === 0) return [];

  return segments.map((seg) => {
    const fromLoc = locations.find((l) => l.id === seg.fromId)!;
    const toLoc = locations.find((l) => l.id === seg.toId)!;
    return finalizeGroup([seg], [fromLoc, toLoc]);
  });
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
  private timingOverrides: Record<string, number>;

  private animFrameId: number | null = null;
  private startTime: number | null = null;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;

  constructor(
    map: mapboxgl.Map,
    locations: Location[],
    segments: Segment[],
    timingOverrides?: Record<string, number>
  ) {
    this.map = map;
    this.locations = locations;
    this.segments = segments;
    this.timingOverrides = timingOverrides ?? {};
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

  getLocations(): Location[] {
    return this.locations;
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
      const group = this.groups[i];
      const isFromWaypoint = group.fromLoc.isWaypoint;
      const isToWaypoint = group.toLoc.isWaypoint;
      const hoverTime = isFromWaypoint ? 0 : this.camera.getHoverDuration(i);
      const groupArrive = isToWaypoint ? 0 : arriveTime;
      totalFixed += hoverTime + groupArrive;
      if (!isToWaypoint && group.toLoc.photos.length > 0) {
        totalFixed += photoTime;
      }
    }

    const totalVariable = Math.max(totalTarget - totalFixed, n * 1.5);

    // Compute each group's merged route length for proportional FLY timing
    const groupLengths = this.groups.map((g) => {
      if (g.mergedGeometry && g.mergedGeometry.coordinates.length >= 2) {
        try {
          return length(lineString(g.mergedGeometry.coordinates));
        } catch {
          return 0;
        }
      }
      return 0;
    });
    const totalRouteLength = groupLengths.reduce((sum, l) => sum + l, 0);

    for (let i = 0; i < n; i++) {
      const group = this.groups[i];
      const isFromWaypoint = group.fromLoc.isWaypoint;
      const isToWaypoint = group.toLoc.isWaypoint;
      const hasPhotos = !isToWaypoint && group.toLoc.photos.length > 0;
      let hoverTime = isFromWaypoint ? 0 : this.camera.getHoverDuration(i);
      let arriveDur = isToWaypoint ? 0 : arriveTime + (hasPhotos ? photoTime : 0);

      // Check for timing override using the first segment's id
      const overrideKey = group.segments[0].id;
      const override = this.timingOverrides[overrideKey];

      let zoomOutDur: number;
      let flyDur: number;
      let zoomInDur: number;

      if (override !== undefined) {
        // Allow very short overrides (min 1.5s) — compress all phases proportionally
        const effectiveOverride = Math.max(override, 1.5);
        const totalFixed = hoverTime + arriveDur;
        if (effectiveOverride <= totalFixed) {
          // Ultra short: compress hover and arrive, minimal travel
          const scale = effectiveOverride / (totalFixed + 0.5);
          hoverTime = hoverTime * scale;
          arriveDur = arriveDur * scale;
          zoomOutDur = 0.1 * scale;
          flyDur = 0.2 * scale;
          zoomInDur = 0.1 * scale;
        } else {
          // Normal: fixed phases stay, remaining time for travel
          const travelTime = effectiveOverride - hoverTime - arriveDur;
          zoomOutDur = travelTime * 0.2;
          flyDur = travelTime * 0.65;
          zoomInDur = travelTime * 0.15;
        }
      } else {
        // Distribute variable time proportionally to route length
        const proportion = totalRouteLength > 0
          ? groupLengths[i] / totalRouteLength
          : 1 / n;
        const variableForGroup = totalVariable * proportion;
        // Minimum 1.5s for variable portion so short legs aren't invisible
        const effectiveVariable = Math.max(variableForGroup, 1.5);

        if (isFromWaypoint || isToWaypoint) {
          // Waypoint segments: no zoom, no stop — 100% FLY
          zoomOutDur = 0;
          zoomInDur = 0;
          flyDur = effectiveVariable;
        } else {
          // Normal segment: allocate most time to FLY
          zoomOutDur = effectiveVariable * 0.12;
          zoomInDur = effectiveVariable * 0.18;
          flyDur = effectiveVariable - zoomOutDur - zoomInDur; // ~70% to FLY
        }
      }

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
        segmentId: overrideKey,
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

  off(event: AnimationEventType, listener: AnimationListener) {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
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
        cityLabelZh: null,
        showPhotos: false,
        photoOpacity: 0,
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
    // Wrap longitude to [-180, 180] to prevent tile loading issues with unwrapped coords
    let lng = cameraState.center[0];
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;

    this.map.jumpTo({
      center: [lng, cameraState.center[1]],
      zoom: cameraState.zoom,
      bearing: cameraState.bearing,
      pitch: cameraState.pitch,
    });

    // Icon
    this.iconAnimator.update(groupIndex, phase, phaseProgress);

    // City label — only for non-waypoint locations
    let cityLabel: string | null = null;
    let cityLabelZh: string | null = null;
    if (phase === "HOVER" && !group.fromLoc.isWaypoint) {
      cityLabel = group.fromLoc.name;
      cityLabelZh = group.fromLoc.nameZh ?? null;
    } else if (phase === "ARRIVE" && !group.toLoc.isWaypoint) {
      cityLabel = group.toLoc.name;
      cityLabelZh = group.toLoc.nameZh ?? null;
    }

    // Photos: show during ARRIVE at full opacity.
    // Continue showing (fading out) during NEXT group's HOVER + ZOOM_OUT.
    let showPhotos = false;
    let photoOpacity = 0;

    // First city: show photos during HOVER phase of group 0
    if (groupIndex === 0 && phase === "HOVER" && group.fromLoc.photos.length > 0) {
      showPhotos = true;
      photoOpacity = 1;
    } else if (phase === "ARRIVE" && group.toLoc.photos.length > 0) {
      showPhotos = true;
      photoOpacity = 1;
    } else if (groupIndex > 0) {
      const prevGroup = this.groups[groupIndex - 1];
      if (prevGroup && prevGroup.toLoc.photos.length > 0) {
        if (phase === "HOVER") {
          // Fade out previous photos during HOVER
          showPhotos = true;
          photoOpacity = 1 - phaseProgress;
        } else if (phase === "ZOOM_OUT") {
          showPhotos = true;
          photoOpacity = Math.max(0, 0.3 * (1 - phaseProgress));
        }
      }
    }

    const progress = clamped / this.totalDuration;
    this.emit({
      type: "progress",
      time: clamped,
      progress,
      segmentIndex,
      phase,
      cityLabel,
      cityLabelZh,
      showPhotos,
      photoOpacity,
      groupIndex,
      groupSegmentIndices: segIndices,
      // Photos should disappear before the FLY phase and only reappear on ARRIVE.
      // Keeping scene transitions disabled prevents future cities from rendering early.
      sceneTransitionProgress: undefined,
      outgoingGroupIndex: undefined,
      incomingGroupIndex: undefined,
      transitionBearing: undefined,
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
        cityLabelZh: null,
        showPhotos: false,
        photoOpacity: 0,
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
        cityLabelZh: null,
        showPhotos: false,
        photoOpacity: 0,
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
        cityLabelZh: null,
        showPhotos: false,
        photoOpacity: 0,
        routeDrawFraction: 1,
        groupIndex,
        groupSegmentIndices: segIndices,
      });
    }
  }

  resolveTimePosition(time: number): {
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
