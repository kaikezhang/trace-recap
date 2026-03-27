import * as turf from "@turf/turf";
import BezierEasing from "bezier-easing";
import type mapboxgl from "mapbox-gl";
import type {
  Location,
  Segment,
  SegmentTiming,
  AnimationPhase,
  CameraState,
} from "@/types";
import { CameraController } from "./CameraController";
import { IconAnimator } from "./IconAnimator";
import { PHASE_DURATIONS, TARGET_DURATION } from "@/lib/constants";

export type AnimationEventType =
  | "progress"
  | "phaseChange"
  | "segmentChange"
  | "complete";

export interface AnimationEvent {
  type: AnimationEventType;
  time: number;
  progress: number;
  segmentIndex: number;
  phase: AnimationPhase;
  cityLabel: string | null;
  showPhotos: boolean;
}

type AnimationListener = (event: AnimationEvent) => void;

const easeInOut = BezierEasing(0.25, 0.1, 0.25, 1.0);

export class AnimationEngine {
  private map: mapboxgl.Map;
  private locations: Location[];
  private segments: Segment[];
  private timeline: SegmentTiming[];
  private totalDuration: number;
  private camera: CameraController;
  private iconAnimator: IconAnimator;
  private listeners: Map<AnimationEventType, AnimationListener[]>;

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
    this.camera = new CameraController(locations, segments);
    this.iconAnimator = new IconAnimator(map, segments);
    this.timeline = this.computeTimeline();
    this.totalDuration = this.computeTotalDuration();
  }

  private computeTimeline(): SegmentTiming[] {
    const n = this.segments.length;
    if (n === 0) return [];

    // Compute total target duration
    const totalTarget = Math.min(
      TARGET_DURATION.max,
      Math.max(TARGET_DURATION.min, n * 5)
    );

    // Fixed times
    const hoverTime = PHASE_DURATIONS.HOVER;
    const arriveTime = PHASE_DURATIONS.ARRIVE;
    const photoTime = PHASE_DURATIONS.PHOTO_DISPLAY;

    const timeline: SegmentTiming[] = [];
    let currentTime = 0;

    // First, compute total fixed time
    let totalFixed = 0;
    for (let i = 0; i < n; i++) {
      totalFixed += hoverTime + arriveTime;
      const toLoc = this.locations.find(
        (l) => l.id === this.segments[i].toId
      );
      if (toLoc && toLoc.photos.length > 0) {
        totalFixed += photoTime;
      }
    }

    const totalVariable = Math.max(totalTarget - totalFixed, n * 1.5);
    const variablePerSegment = totalVariable / n;

    for (let i = 0; i < n; i++) {
      const seg = this.segments[i];
      const toLoc = this.locations.find((l) => l.id === seg.toId);
      const hasPhotos = toLoc && toLoc.photos.length > 0;

      const zoomOutDur = variablePerSegment * 0.25;
      const flyDur = variablePerSegment * 0.45;
      const zoomInDur = variablePerSegment * 0.3;
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

      timeline.push({
        segmentId: seg.id,
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
      this.emit({
        type: "complete",
        time: this.totalDuration,
        progress: 1,
        segmentIndex: this.segments.length - 1,
        phase: "ARRIVE",
        cityLabel: null,
        showPhotos: false,
      });
      return;
    }

    this.renderFrame(elapsed);
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  renderFrame(time: number) {
    const clamped = Math.max(0, Math.min(time, this.totalDuration));
    const { segmentIndex, phase, phaseProgress } =
      this.resolveTimePosition(clamped);

    if (segmentIndex < 0) return;

    const seg = this.segments[segmentIndex];
    const fromLoc = this.locations.find((l) => l.id === seg.fromId)!;
    const toLoc = this.locations.find((l) => l.id === seg.toId)!;

    // Camera
    const cameraState = this.camera.getCameraState(
      segmentIndex,
      phase,
      easeInOut(phaseProgress)
    );
    this.map.jumpTo({
      center: cameraState.center,
      zoom: cameraState.zoom,
      bearing: cameraState.bearing,
      pitch: cameraState.pitch,
    });

    // Icon
    this.iconAnimator.update(segmentIndex, phase, phaseProgress);

    // City label
    let cityLabel: string | null = null;
    if (phase === "HOVER") cityLabel = fromLoc.name;
    else if (phase === "ARRIVE") cityLabel = toLoc.name;

    // Photos
    const showPhotos = phase === "ARRIVE" && toLoc.photos.length > 0;

    const progress = clamped / this.totalDuration;
    this.emit({
      type: "progress",
      time: clamped,
      progress,
      segmentIndex,
      phase,
      cityLabel,
      showPhotos,
    });
  }

  private resolveTimePosition(time: number): {
    segmentIndex: number;
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
              segmentIndex: i,
              phase: p.phase,
              phaseProgress: Math.min(1, phaseProgress),
            };
          }
        }
        // Fallback: last phase
        const lastPhase = st.phases[st.phases.length - 1];
        return { segmentIndex: i, phase: lastPhase.phase, phaseProgress: 1 };
      }
    }

    // Past end — last segment ARRIVE
    if (this.timeline.length > 0) {
      return {
        segmentIndex: this.timeline.length - 1,
        phase: "ARRIVE",
        phaseProgress: 1,
      };
    }
    return { segmentIndex: -1, phase: "HOVER", phaseProgress: 0 };
  }

  destroy() {
    this.pause();
    this.iconAnimator.destroy();
    this.listeners.clear();
  }
}
