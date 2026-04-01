import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import type mapboxgl from "mapbox-gl";
import type {
  ExportSettings,
  FreePhotoTransform,
  Photo,
  PhotoAnimation,
  PhotoFrameStyle,
  PhotoLayout,
  PhotoStyle,
  SceneTransition,
} from "@/types";
import { AnimationEngine } from "./AnimationEngine";
import type { AnimationEvent } from "./AnimationEngine";
import {
  setSegmentSourceData,
  SEGMENT_LAYER_PREFIX,
  SEGMENT_GLOW_LAYER_PREFIX,
  SEGMENT_SOURCE_PREFIX,
} from "@/components/editor/routeSegmentSources";
import {
  resolvePhotoAnimations,
  resolvePhotoStyle,
  getKenBurnsTransform,
  KEN_BURNS_DURATION_SEC,
  getBloomTransform,
  getBloomExitTransform,
  BLOOM_ENTER_DURATION_SEC,
  computeBloomFanLayout,
  BLOOM_EXIT_DURATION_SEC,
} from "@/lib/photoAnimation";
import { isSolidStyle, resolveIconVariant } from "@/lib/transportIcons";
import type { IconDirection } from "@/lib/transportIcons";
import { computeAutoLayout, computeTemplateLayout, type PhotoRect } from "@/lib/photoLayout";
import { getExportViewportSize } from "@/lib/viewportRatio";
import { isWebCodecsSupported, WebCodecsExporter } from "./WebCodecsExporter";
import { isMediaRecorderSupported, MediaRecorderExporter } from "./MediaRecorderExporter";
import { useUIStore } from "@/stores/uiStore";
import {
  BREADCRUMB_SOURCE_ID,
  BREADCRUMB_LAYER_ID,
  getBreadcrumbImageId,
  createCircularImageFromElement,
} from "@/components/editor/BreadcrumbTrail";
import { useProjectStore } from "@/stores/projectStore";
import { resolveSceneTransition, computeDissolveOpacity, computeBlurDissolve, computeWipeProgress } from "@/lib/sceneTransition";
import { computePortalLayout, computePortalPhaseProgress } from "@/lib/portalLayout";
import { computeTripStats, getSortedTransportModes, TRANSPORT_MODE_EMOJI } from "@/lib/tripStats";
import { computeCityLabelTopPercent } from "@/lib/cityLabelPosition";
import { DEFAULT_CAPTION_BG_COLOR } from "@/lib/constants";
import {
  frameStyleUsesInlineCaption,
  getPhotoFrameRotation,
  getPhotoFrameStyleConfig,
} from "@/lib/frameStyles";
import {
  computeAlbumPageGrid,
  getAlbumStyleConfig,
  splitPhotosAcrossPages,
} from "@/lib/albumStyles";

export type ExportProgress = {
  phase: "capturing" | "uploading" | "encoding" | "done";
  current: number;
  total: number;
  encodingMethod?: "webcodecs" | "mediarecorder" | "server";
};

type ProgressCallback = (progress: ExportProgress) => void;

interface PreloadedPhoto {
  img: HTMLImageElement;
  aspect: number; // naturalWidth / naturalHeight
  failed?: boolean; // true if the original image failed to load (placeholder)
}

interface ExportCaptionDisplay {
  text: string;
  fontFamily: string;
  fontSizePx: number;
  color: string;
  bgColor: string;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ParsedShadow {
  inset: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

type ExportAlbumPhase =
  | "pre-open"
  | "fly-to-album"
  | "album-open"
  | "album-hold"
  | "album-to-visited";

interface ExportAlbumTiming {
  groupIndex: number;
  locationId: string;
  preOpenStart: number;
  sequenceStart: number;
  flyDuration: number;
  openDuration: number;
  holdDuration: number;
  morphDuration: number;
  sequenceEnd: number;
  nextFlyStart: number;
}

interface ExportAlbumState extends ExportAlbumTiming {
  phase: ExportAlbumPhase;
  phaseProgress: number;
}

interface AlbumPinMetrics {
  width: number;
  height: number;
  labelCenterY: number;
  bookCenterY: number;
  convergenceY: number;
}

const EXPORT_ALBUM_PHASE_DURATIONS = {
  flyToAlbum: 0.4,
  albumOpen: 0.3,
  albumHold: 0.5,
  albumToVisited: 0.4,
} as const;

const EXPORT_ALBUM_TOTAL_DURATION =
  EXPORT_ALBUM_PHASE_DURATIONS.flyToAlbum +
  EXPORT_ALBUM_PHASE_DURATIONS.albumOpen +
  EXPORT_ALBUM_PHASE_DURATIONS.albumHold +
  EXPORT_ALBUM_PHASE_DURATIONS.albumToVisited;

const EXPORT_ALBUM_PIN_GEOMETRY = {
  width: 420,
  height: 252,
  labelGap: 8,
  labelHeight: 18,
  tailGap: 4,
  tailHeight: 10,
} as const;

function getFreeTransformMap(layout?: PhotoLayout): Map<string, FreePhotoTransform> {
  return new Map((layout?.mode === "free" ? layout.freeTransforms : undefined)?.map((transform) => [transform.photoId, transform]) ?? []);
}

function getOrderedPhotosForLayout(photos: Photo[], layout?: PhotoLayout): Photo[] {
  if (layout?.mode === "free" && layout.freeTransforms && layout.freeTransforms.length > 0) {
    const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
    return [...layout.freeTransforms]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((transform) => photoMap.get(transform.photoId))
      .filter((photo): photo is Photo => !!photo);
  }

  if (layout?.order && layout.order.length > 0) {
    const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
    const ordered = layout.order
      .map((id) => photoMap.get(id))
      .filter((photo): photo is Photo => !!photo);
    for (const photo of photos) {
      if (!ordered.find((orderedPhoto) => orderedPhoto.id === photo.id)) ordered.push(photo);
    }
    return ordered;
  }

  return photos;
}

export class VideoExporter {
  private engine: AnimationEngine;
  private map: mapboxgl.Map;
  private settings: ExportSettings;
  private cancelled = false;
  private abortController: AbortController | null = null;
  private photoImages: Map<string, PreloadedPhoto> = new Map();
  /** Track when photos first appeared (frame index) per group, for enter animation timing */
  private photoShowStartFrame: Map<number, number> = new Map();
  /** Track visited location IDs during export for chapter pin rendering */
  private exportVisitedLocationIds: Set<string> = new Set();
  /** Track the frame index when each location first became visited (for pop-in animation) */
  private visitedPinFirstFrame: Map<string, number> = new Map();
  /** Current arrival location ID during export */
  private exportCurrentArrivalId: string | null = null;
  /** Breadcrumbs accumulated during export (mirrors preview behavior) */
  private exportBreadcrumbs: Array<{
    locationId: string;
    coordinates: [number, number];
    heroPhotoUrl: string;
    addedAtFrame: number;
  }> = [];
  /** Track previous showPhotos state for breadcrumb emission during export */
  private prevExportShowPhotos = false;
  private prevExportPhotoLocationId: string | null = null;
  /** Frame counter for trip stats bar fade/slide-in animation */
  private tripStatsBarAge: number = 0;

  constructor(
    engine: AnimationEngine,
    map: mapboxgl.Map,
    settings: ExportSettings
  ) {
    this.engine = engine;
    this.map = map;
    this.settings = settings;
  }

  cancel() {
    this.cancelled = true;
    this.abortController?.abort();
  }

  /** Initialize icon renderers for all transport modes (Lottie for outline/soft, PNG for solid) */
  private async preloadIcons(): Promise<void> {
    const iconAnimator = this.engine.getIconAnimator();
    const seen = new Set<string>();
    const iconVariants = this.engine.getSegments().filter((segment) => {
      const key = `${segment.transportMode}:${resolveIconVariant(segment.transportMode, segment.iconVariant)}:${segment.iconStyle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const directions: IconDirection[] = ["up", "down", "left", "right"];

    const promises: Promise<unknown>[] = [];
    for (const segment of iconVariants) {
      if (isSolidStyle(segment.iconStyle)) {
        // Solid style: preload all 4 directional PNG variants
        for (const dir of directions) {
          promises.push(iconAnimator.ensurePngImage(segment.transportMode, dir));
        }
      } else {
        // Lottie styles: preload canvas renderer
        promises.push(
          iconAnimator.ensureCanvasRenderer(
            segment.transportMode,
            segment.iconStyle,
            segment.iconVariant,
          ),
        );
      }
    }
    await Promise.all(promises);
  }

  /** Pre-load all photo images so they're ready for canvas compositing */
  private async preloadPhotos(): Promise<void> {
    const locations = this.engine.getLocations();
    const urls = new Set<string>();
    for (const loc of locations) {
      for (const photo of loc.photos) {
        urls.add(photo.url);
      }
    }

    const promises: Promise<void>[] = [];
    for (const url of urls) {
      if (this.photoImages.has(url)) continue;
      promises.push(
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.photoImages.set(url, {
              img,
              aspect: img.naturalWidth / img.naturalHeight,
            });
            resolve();
          };
          img.onerror = () => {
            const placeholder = this.createPlaceholderImage(240, 180);
            this.photoImages.set(url, {
              img: placeholder,
              aspect: 240 / 180,
              failed: true,
            });
            resolve();
          };
          img.src = url;
        })
      );
    }
    await Promise.all(promises);
  }

  /** Create a placeholder HTMLImageElement for failed photo loads */
  private createPlaceholderImage(w: number, h: number): HTMLImageElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    cx.fillStyle = "#d1d5db";
    cx.fillRect(0, 0, w, h);
    const m = 40;
    cx.strokeStyle = "#9ca3af";
    cx.lineWidth = 6;
    cx.lineCap = "round";
    cx.beginPath();
    cx.moveTo(m, m);
    cx.lineTo(w - m, h - m);
    cx.moveTo(w - m, m);
    cx.lineTo(m, h - m);
    cx.stroke();
    const iconW = 50;
    const iconH = 36;
    const ix = (w - iconW) / 2;
    const iy = (h - iconH) / 2;
    cx.strokeStyle = "#6b7280";
    cx.lineWidth = 3;
    cx.strokeRect(ix, iy, iconW, iconH);
    cx.beginPath();
    cx.arc(w / 2, h / 2, 10, 0, Math.PI * 2);
    cx.stroke();

    const img = new Image();
    img.src = c.toDataURL();
    return img;
  }

  /** Hide all segment layers and reset source data before export starts */
  private hideAllSegments(): void {
    const segments = this.engine.getSegments();
    for (const seg of segments) {
      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      if (this.map.getLayer(layerId))
        this.map.setLayoutProperty(layerId, "visibility", "none");
      if (this.map.getLayer(glowLayerId))
        this.map.setLayoutProperty(glowLayerId, "visibility", "none");
      setSegmentSourceData(this.map, seg.id, null);
    }
  }

  /** Restore all segments to fully visible with full geometry */
  private restoreAllSegments(): void {
    const segments = this.engine.getSegments();
    for (const seg of segments) {
      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      if (this.map.getLayer(layerId))
        this.map.setLayoutProperty(layerId, "visibility", "visible");
      if (this.map.getLayer(glowLayerId))
        this.map.setLayoutProperty(glowLayerId, "visibility", "visible");
      setSegmentSourceData(this.map, seg.id, seg.geometry);
    }
  }

  private applyRouteDrawProgress(event: AnimationEvent): void {
    const segments = this.engine.getSegments();
    const fraction = event.routeDrawFraction ?? 0;
    const groupSegIndices = event.groupSegmentIndices;

    const firstGroupSegIdx = groupSegIndices[0];
    for (let i = 0; i < firstGroupSegIdx; i++) {
      const pastSeg = segments[i];
      const pastLid = SEGMENT_LAYER_PREFIX + pastSeg.id;
      const pastGlid = SEGMENT_GLOW_LAYER_PREFIX + pastSeg.id;
      if (this.map.getLayer(pastLid))
        this.map.setLayoutProperty(pastLid, "visibility", "visible");
      if (this.map.getLayer(pastGlid))
        this.map.setLayoutProperty(pastGlid, "visibility", "visible");
      setSegmentSourceData(this.map, pastSeg.id, pastSeg.geometry);
    }

    const group = this.engine.getGroups()[event.groupIndex];
    if (!group) return;
    const mergedGeom = group.mergedGeometry;
    const mergedLength =
      mergedGeom && mergedGeom.coordinates.length > 1
        ? length(lineString(mergedGeom.coordinates))
        : 0;

    let accumulatedLength = 0;
    const drawnDistance = fraction * mergedLength;

    for (let gi = 0; gi < groupSegIndices.length; gi++) {
      const segIdx = groupSegIndices[gi];
      const seg = segments[segIdx];
      if (!seg?.geometry || seg.geometry.coordinates.length < 2) continue;
      if (!this.map.getSource(`${SEGMENT_SOURCE_PREFIX}${seg.id}`)) continue;

      const segLength = length(lineString(seg.geometry.coordinates));
      const segStart = accumulatedLength;
      const segEnd = accumulatedLength + segLength;
      accumulatedLength = segEnd;

      const layerId = SEGMENT_LAYER_PREFIX + seg.id;
      const glowLayerId = SEGMENT_GLOW_LAYER_PREFIX + seg.id;
      if (this.map.getLayer(layerId))
        this.map.setLayoutProperty(layerId, "visibility", "visible");
      if (this.map.getLayer(glowLayerId))
        this.map.setLayoutProperty(glowLayerId, "visibility", "visible");

      if (drawnDistance >= segEnd) {
        setSegmentSourceData(this.map, seg.id, seg.geometry);
      } else if (drawnDistance > segStart) {
        const segFraction = (drawnDistance - segStart) / segLength;
        setSegmentSourceData(this.map, seg.id, seg.geometry, segFraction);
      } else {
        setSegmentSourceData(this.map, seg.id, seg.geometry, 0);
      }
    }

    const lastGroupSegIdx = groupSegIndices[groupSegIndices.length - 1];
    for (let i = lastGroupSegIdx + 1; i < segments.length; i++) {
      const futureSeg = segments[i];
      const futureLid = SEGMENT_LAYER_PREFIX + futureSeg.id;
      const futureGlid = SEGMENT_GLOW_LAYER_PREFIX + futureSeg.id;
      if (this.map.getLayer(futureLid))
        this.map.setLayoutProperty(futureLid, "visibility", "none");
      if (this.map.getLayer(futureGlid))
        this.map.setLayoutProperty(futureGlid, "visibility", "none");
    }
  }

  /** Composite the vehicle icon (PNG or Lottie) onto the offscreen 2D canvas */
  private drawVehicleIcon(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number
  ): void {
    const iconAnimator = this.engine.getIconAnimator();
    const state = iconAnimator.getState();

    if (!state.visible || !state.position || state.opacity <= 0) return;

    const point = this.map.project(state.position);
    const px = point.x * scaleX;
    const py = point.y * scaleY;
    const sz = state.size * scaleX;

    iconAnimator.drawToCanvas(ctx, px, py, sz);
  }

  /** Update the Mapbox breadcrumb source with animated scale/opacity for export */
  private updateBreadcrumbMapSource(frameIndex: number, fps: number): void {
    const source = this.map.getSource(BREADCRUMB_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;

    const breadcrumbsEnabled = useUIStore.getState().breadcrumbsEnabled;
    const chapterPinsEnabled = useUIStore.getState().chapterPinsEnabled;
    // When chapter pins are enabled, visited locations are drawn on the canvas
    // by drawChapterPins/drawVisitedChapterPin. Suppress the Mapbox breadcrumb
    // layer to avoid rendering duplicate circle pins on top of each other.
    if (!breadcrumbsEnabled || chapterPinsEnabled || this.exportBreadcrumbs.length === 0) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const animFrames = Math.round(0.3 * fps); // ~300ms of animation

    const features: GeoJSON.Feature<GeoJSON.Point>[] =
      this.exportBreadcrumbs.map((bc, i) => {
        const isNewest = i === this.exportBreadcrumbs.length - 1;
        const settledOpacity = isNewest ? 0.8 : 0.7;

        const elapsed = frameIndex - bc.addedAtFrame;
        const t = Math.min(1, animFrames > 0 ? elapsed / animFrames : 1);
        // Cubic ease-out matching preview
        const ease = 1 - Math.pow(1 - t, 3);

        const scale = 2 - ease; // 2 → 1
        const opacity = 1 - ease * (1 - settledOpacity); // 1 → settled

        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: bc.coordinates,
          },
          properties: {
            imageId: getBreadcrumbImageId(bc.locationId),
            scale,
            opacity,
          },
        };
      });

    source.setData({ type: "FeatureCollection", features });
  }

  /** Ensure the breadcrumb layer is positioned below route segment layers */
  private ensureBreadcrumbLayerOrder(): void {
    if (!this.map.getLayer(BREADCRUMB_LAYER_ID)) return;
    const style = this.map.getStyle();
    if (!style?.layers) return;
    for (const layer of style.layers) {
      if (
        layer.id.startsWith("segment-glow-") ||
        layer.id.startsWith("segment-")
      ) {
        try {
          this.map.moveLayer(BREADCRUMB_LAYER_ID, layer.id);
        } catch {
          /* already in position */
        }
        return;
      }
    }
  }

  /** Update breadcrumb tracking during export based on animation progress events */
  private updateExportBreadcrumbs(event: AnimationEvent, frameIndex: number): void {
    const wasShowingPhotos = this.prevExportShowPhotos;
    const prevLocId = this.prevExportPhotoLocationId;

    if (wasShowingPhotos && !event.showPhotos && prevLocId) {
      const locations = this.engine.getLocations();
      const loc = locations.find((l) => l.id === prevLocId);
      if (loc && loc.photos.length > 0 && !this.exportBreadcrumbs.some((b) => b.locationId === loc.id)) {
        // Register circular image with the map if not already present
        const imgId = getBreadcrumbImageId(loc.id);
        if (!this.map.hasImage(imgId)) {
          const preloaded = this.photoImages.get(loc.photos[0].url);
          if (preloaded) {
            const imageData = createCircularImageFromElement(
              preloaded.img,
              preloaded.aspect,
              64, // 2x size for retina
              4,  // 2x border
            );
            this.map.addImage(imgId, imageData, { pixelRatio: 2 });
          }
        }

        this.exportBreadcrumbs.push({
          locationId: loc.id,
          coordinates: loc.coordinates,
          heroPhotoUrl: loc.photos[0].url,
          addedAtFrame: frameIndex,
        });
      }
    }

    this.prevExportShowPhotos = event.showPhotos;
    if (event.showPhotos && event.phase === "ARRIVE") {
      const segments = this.engine.getSegments();
      const seg = segments[event.segmentIndex];
      this.prevExportPhotoLocationId = seg?.toId ?? null;
    }
  }

  /** Draw city name label on the offscreen 2D canvas, matching the preview style */
  private drawCityLabel(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    label: string,
    topPercent: number,
    baseFontSize: number = 18,
    accentColor: string = "#6366f1"
  ): void {
    const fontSize = baseFontSize * scaleX;
    const font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(label);

    const padH = 20 * scaleX;
    const padV = 10 * scaleX;
    const dotRadius = 4 * scaleX;
    const dotGap = 8 * scaleX;
    const textWidth = metrics.width;
    const boxWidth = padH + dotRadius * 2 + dotGap + textWidth + padH;
    const boxHeight = padV + 22 * scaleX + padV;
    const x = (canvasWidth - boxWidth) / 2;
    const y = (canvasHeight * topPercent) / 100;
    const radius = 8 * scaleX;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 8 * scaleX;
    ctx.shadowOffsetY = 2 * scaleX;

    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, radius);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1 * scaleX;
    ctx.stroke();
    ctx.restore();

    const dotX = x + padH + dotRadius;
    const dotY = y + boxHeight / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.font = font;
    ctx.fillStyle = "#1e293b";
    ctx.textBaseline = "middle";
    ctx.fillText(label, dotX + dotRadius + dotGap, dotY);
  }

  private getExportAlbumTailDuration(): number {
    const groups = this.engine.getGroups();
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup.toLoc.isWaypoint || lastGroup.toLoc.photos.length === 0) {
      return 0;
    }
    return EXPORT_ALBUM_TOTAL_DURATION;
  }

  private getAlbumPinMetrics(scale: number): AlbumPinMetrics {
    const width = EXPORT_ALBUM_PIN_GEOMETRY.width * scale;
    const height = EXPORT_ALBUM_PIN_GEOMETRY.height * scale;
    const labelCenterY =
      -(
        EXPORT_ALBUM_PIN_GEOMETRY.tailHeight +
        EXPORT_ALBUM_PIN_GEOMETRY.tailGap +
        EXPORT_ALBUM_PIN_GEOMETRY.labelHeight / 2
      ) * scale;
    const bookCenterY =
      -(
        EXPORT_ALBUM_PIN_GEOMETRY.tailHeight +
        EXPORT_ALBUM_PIN_GEOMETRY.tailGap +
        EXPORT_ALBUM_PIN_GEOMETRY.labelHeight +
        EXPORT_ALBUM_PIN_GEOMETRY.labelGap +
        EXPORT_ALBUM_PIN_GEOMETRY.height / 2
      ) * scale;

    return {
      width,
      height,
      labelCenterY,
      bookCenterY,
      convergenceY: bookCenterY + height * 0.18,
    };
  }

  private getAlbumSequenceTiming(
    groupIndex: number,
    exportDuration: number,
  ): ExportAlbumTiming | null {
    const groups = this.engine.getGroups();
    const group = groups[groupIndex];
    if (!group || group.toLoc.isWaypoint || group.toLoc.photos.length === 0) {
      return null;
    }

    const timeline = this.engine.getTimeline();
    const entry = timeline[groupIndex];
    const arrivePhase = entry?.phases.find((phase) => phase.phase === "ARRIVE");
    if (!arrivePhase) return null;

    const nextEntry = timeline[groupIndex + 1];
    const nextFly = nextEntry?.phases.find((phase) => phase.phase === "FLY");
    const sequenceStart = arrivePhase.startTime + arrivePhase.duration;
    const nextFlyStart = nextFly?.startTime ?? exportDuration;
    const availableDuration = Math.max(0, nextFlyStart - sequenceStart);
    if (availableDuration <= 0) return null;

    const durationScale = Math.min(1, availableDuration / EXPORT_ALBUM_TOTAL_DURATION);
    const flyDuration = EXPORT_ALBUM_PHASE_DURATIONS.flyToAlbum * durationScale;
    const openDuration = EXPORT_ALBUM_PHASE_DURATIONS.albumOpen * durationScale;
    const holdDuration = EXPORT_ALBUM_PHASE_DURATIONS.albumHold * durationScale;
    const morphDuration = EXPORT_ALBUM_PHASE_DURATIONS.albumToVisited * durationScale;

    return {
      groupIndex,
      locationId: group.toLoc.id,
      preOpenStart: arrivePhase.startTime + arrivePhase.duration * 0.8,
      sequenceStart,
      flyDuration,
      openDuration,
      holdDuration,
      morphDuration,
      sequenceEnd: sequenceStart + flyDuration + openDuration + holdDuration + morphDuration,
      nextFlyStart,
    };
  }

  private getActiveAlbumState(
    renderTime: number,
    exportDuration: number,
  ): ExportAlbumState | null {
    const groups = this.engine.getGroups();

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const timing = this.getAlbumSequenceTiming(groupIndex, exportDuration);
      if (!timing) continue;

      if (renderTime >= timing.preOpenStart && renderTime < timing.sequenceStart) {
        const preOpenDuration = Math.max(timing.sequenceStart - timing.preOpenStart, 0.0001);
        return {
          ...timing,
          phase: "pre-open",
          phaseProgress: Math.max(0, Math.min(1, (renderTime - timing.preOpenStart) / preOpenDuration)),
        };
      }

      if (renderTime < timing.sequenceStart || renderTime >= timing.sequenceEnd) {
        continue;
      }

      let cursor = timing.sequenceStart;
      if (renderTime < cursor + timing.flyDuration) {
        return {
          ...timing,
          phase: "fly-to-album",
          phaseProgress: Math.max(0, Math.min(1, (renderTime - cursor) / Math.max(timing.flyDuration, 0.0001))),
        };
      }
      cursor += timing.flyDuration;

      if (renderTime < cursor + timing.openDuration) {
        return {
          ...timing,
          phase: "album-open",
          phaseProgress: Math.max(0, Math.min(1, (renderTime - cursor) / Math.max(timing.openDuration, 0.0001))),
        };
      }
      cursor += timing.openDuration;

      if (renderTime < cursor + timing.holdDuration) {
        return {
          ...timing,
          phase: "album-hold",
          phaseProgress: Math.max(0, Math.min(1, (renderTime - cursor) / Math.max(timing.holdDuration, 0.0001))),
        };
      }
      cursor += timing.holdDuration;

      return {
        ...timing,
        phase: "album-to-visited",
        phaseProgress: Math.max(0, Math.min(1, (renderTime - cursor) / Math.max(timing.morphDuration, 0.0001))),
      };
    }

    return null;
  }

  /** Update chapter pin tracking state — derived from current time so seek is correct */
  private updateChapterPinState(
    progress: AnimationEvent | null,
    renderTime: number,
    exportDuration: number,
    frameIndex?: number,
  ): void {
    if (!progress) return;
    const groups = this.engine.getGroups();
    const tl = this.engine.getTimeline();
    const t = renderTime;

    this.exportVisitedLocationIds.clear();
    this.exportCurrentArrivalId = null;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const entry = tl[i];
      if (!entry) continue;

      // First location: arrival during HOVER of group 0, visited after
      if (i === 0 && !group.fromLoc.isWaypoint) {
        const hover = entry.phases.find((p) => p.phase === "HOVER");
        if (hover) {
          const hoverEnd = hover.startTime + hover.duration;
          if (t >= hover.startTime && t < hoverEnd) {
            this.exportCurrentArrivalId = group.fromLoc.id;
          } else if (t >= hoverEnd) {
            this.exportVisitedLocationIds.add(group.fromLoc.id);
          }
        }
      }

      // toLoc: with photos, keep the chapter in an album state until the export-side
      // book-to-visited morph completes. Without photos, keep the legacy pin card.
      if (!group.toLoc.isWaypoint) {
        const arrive = entry.phases.find((p) => p.phase === "ARRIVE");
        if (arrive) {
          const arriveEnd = arrive.startTime + arrive.duration;
          const albumTiming = this.getAlbumSequenceTiming(i, exportDuration);
          const hasPhotos = group.toLoc.photos.length > 0;

          if (hasPhotos && albumTiming) {
            if (t >= albumTiming.preOpenStart && t < albumTiming.sequenceEnd) {
              this.exportCurrentArrivalId = group.toLoc.id;
            } else if (t >= albumTiming.sequenceEnd) {
              this.exportVisitedLocationIds.add(group.toLoc.id);
            }
          } else if (t >= arrive.startTime && t < arriveEnd) {
            this.exportCurrentArrivalId = group.toLoc.id;
          } else if (t >= arriveEnd) {
            this.exportVisitedLocationIds.add(group.toLoc.id);
          }
        }
      }
    }

    // Track when each location first became visited (for pop-in animation)
    if (frameIndex !== undefined) {
      for (const locId of this.exportVisitedLocationIds) {
        if (!this.visitedPinFirstFrame.has(locId)) {
          this.visitedPinFirstFrame.set(locId, frameIndex);
        }
      }
    }
  }

  /** Draw chapter pins on the export canvas */
  private drawChapterPins(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number,
    renderTime: number,
    exportDuration: number,
    frameIndex?: number,
    fps?: number,
  ): void {
    if (!useUIStore.getState().chapterPinsEnabled) return;

    const locations = this.engine.getLocations();
    const albumState = this.getActiveAlbumState(renderTime, exportDuration);
    const animDurationFrames = fps ? Math.round(0.3 * fps) : 9; // ~300ms pop-in

    for (const loc of locations) {
      if (loc.isWaypoint) continue;
      const isActive = loc.id === this.exportCurrentArrivalId;
      const isVisited = this.exportVisitedLocationIds.has(loc.id);
      if (!isActive && !isVisited) continue;

      const point = this.map.project(loc.coordinates as [number, number]);
      const px = point.x * scaleX;
      const py = point.y * scaleY;

      if (albumState && loc.id === albumState.locationId) {
        this.drawAlbumChapterPin(ctx, loc, px, py, scaleX, albumState);
      } else if (isActive) {
        this.drawActiveChapterPin(ctx, loc, px, py, scaleX);
      } else {
        // Pop-in animation: scale from 2→1 and opacity from 1→0.7 (matching preview breadcrumb)
        const firstFrame = this.visitedPinFirstFrame.get(loc.id);
        let popScale = 1;
        let popOpacity = 0.7;
        if (firstFrame !== undefined && frameIndex !== undefined && frameIndex - firstFrame < animDurationFrames) {
          const t = Math.min(1, animDurationFrames > 0 ? (frameIndex - firstFrame) / animDurationFrames : 1);
          const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
          popScale = 2 - ease; // 2 → 1
          popOpacity = 1 - ease * 0.3; // 1 → 0.7
        }
        this.drawVisitedChapterPin(ctx, loc, px, py, scaleX, {
          opacity: popOpacity,
          scaleMultiplier: popScale,
        });
      }
    }
  }

  /** Draw an active (current arrival) chapter pin card on canvas */
  private drawActiveChapterPin(
    ctx: CanvasRenderingContext2D,
    loc: { name: string; chapterTitle?: string; chapterDate?: string; chapterNote?: string; chapterEmoji?: string; photos: { url: string }[] },
    cx: number,
    cy: number,
    scale: number,
  ): void {
    const title = loc.chapterTitle || loc.name;
    const photoSize = 48 * scale;
    const padH = 8 * scale;
    const padV = 8 * scale;
    const gap = 8 * scale;
    const maxTextWidth = 120 * scale;

    const titleFont = `700 ${14 * scale}px system-ui, -apple-system, sans-serif`;
    const subFont = `400 ${12 * scale}px system-ui, -apple-system, sans-serif`;

    ctx.font = titleFont;
    const titleWidth = Math.min(ctx.measureText(title).width, maxTextWidth);
    let textBlockHeight = 14 * scale * 1.2;

    if (loc.chapterDate) {
      textBlockHeight += 12 * scale * 1.3;
    }
    if (loc.chapterNote) {
      textBlockHeight += 12 * scale * 1.3;
    }

    const cardWidth = padH + photoSize + gap + Math.max(titleWidth, 40 * scale) + padH;
    const cardHeight = Math.max(padV + textBlockHeight + padV, photoSize + padV * 2);
    const cardX = cx - cardWidth / 2;
    const cardY = cy - cardHeight - 8 * scale; // above the pin point
    const radius = 8 * scale;

    // Card background
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, radius);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, radius);
    ctx.stroke();

    // Photo circle
    const photoCX = cardX + padH + photoSize / 2;
    const photoCY = cardY + cardHeight / 2;
    const photoRadius = photoSize / 2;

    const coverUrl = loc.photos[0]?.url;
    const preloaded = coverUrl ? this.photoImages.get(coverUrl) : undefined;

    ctx.save();
    ctx.beginPath();
    ctx.arc(photoCX, photoCY, photoRadius, 0, Math.PI * 2);
    ctx.clip();
    if (preloaded) {
      const img = preloaded.img;
      const aspect = preloaded.aspect;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      let sx = 0;
      let sy = 0;
      if (aspect > 1) {
        sw = sh;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = sw;
        sy = (img.naturalHeight - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, photoCX - photoRadius, photoCY - photoRadius, photoSize, photoSize);
    } else {
      ctx.fillStyle = "#e0e7ff";
      ctx.fill();
      // Emoji fallback
      const emoji = loc.chapterEmoji || "📍";
      ctx.font = `${20 * scale}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";
      ctx.fillText(emoji, photoCX, photoCY);
    }
    ctx.restore();

    // Emoji stamp in bottom-right corner when photo exists (matching preview)
    if (loc.chapterEmoji && preloaded) {
      ctx.font = `${14 * scale}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(loc.chapterEmoji, photoCX + photoRadius * 0.6, photoCY + photoRadius * 0.6);
    }

    // White border around photo
    ctx.beginPath();
    ctx.arc(photoCX, photoCY, photoRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Text
    const textX = cardX + padH + photoSize + gap;
    let textY = cardY + padV + 14 * scale;

    ctx.font = titleFont;
    ctx.fillStyle = "#111827";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(title, textX, textY, maxTextWidth);

    if (loc.chapterDate) {
      textY += 12 * scale * 1.4;
      ctx.font = subFont;
      ctx.fillStyle = "#6b7280";
      ctx.fillText(loc.chapterDate, textX, textY, maxTextWidth);
    }

    if (loc.chapterNote) {
      textY += 12 * scale * 1.4;
      ctx.font = subFont;
      ctx.fillStyle = "#4b5563";
      ctx.fillText(loc.chapterNote, textX, textY, maxTextWidth);
    }

    // Pin tail
    ctx.beginPath();
    ctx.moveTo(cx, cardY + cardHeight);
    ctx.lineTo(cx, cardY + cardHeight + 8 * scale);
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1 * scale;
    ctx.stroke();
  }

  /** Draw a visited (small) chapter pin on canvas */
  private drawVisitedChapterPin(
    ctx: CanvasRenderingContext2D,
    loc: { name: string; chapterTitle?: string; chapterEmoji?: string; photos: { url: string }[] },
    cx: number,
    cy: number,
    scale: number,
    options?: {
      opacity?: number;
      scaleMultiplier?: number;
    },
  ): void {
    const title = loc.chapterTitle || loc.name;
    const photoSize = 32 * scale;
    const photoRadius = photoSize / 2;
    const opacity = options?.opacity ?? 1;
    const scaleMultiplier = options?.scaleMultiplier ?? 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleMultiplier, scaleMultiplier);
    ctx.globalAlpha = 0.5 * opacity;

    // Photo circle
    const coverUrl = loc.photos[0]?.url;
    const preloaded = coverUrl ? this.photoImages.get(coverUrl) : undefined;

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -photoRadius - 4 * scale, photoRadius, 0, Math.PI * 2);
    ctx.clip();
    if (preloaded) {
      const img = preloaded.img;
      const aspect = preloaded.aspect;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      let sx = 0;
      let sy = 0;
      if (aspect > 1) {
        sw = sh;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = sw;
        sy = (img.naturalHeight - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, -photoRadius, -photoSize - 4 * scale, photoSize, photoSize);
    } else {
      ctx.fillStyle = "#e0e7ff";
      ctx.fill();
      const emoji = loc.chapterEmoji || "📍";
      ctx.font = `${14 * scale}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";
      ctx.fillText(emoji, 0, -photoRadius - 4 * scale);
    }
    ctx.restore();
    ctx.globalAlpha = 0.5 * opacity;

    // White border
    ctx.beginPath();
    ctx.arc(0, -photoRadius - 4 * scale, photoRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Title
    ctx.font = `500 ${10 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#374151";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(title, 0, 2 * scale, 80 * scale);

    ctx.restore();
  }

  private drawAlbumChapterPin(
    ctx: CanvasRenderingContext2D,
    loc: {
      name: string;
      chapterTitle?: string;
      chapterEmoji?: string;
      photos: Photo[];
    },
    cx: number,
    cy: number,
    scale: number,
    albumState: ExportAlbumState,
  ): void {
    const metrics = this.getAlbumPinMetrics(scale);
    const title = loc.chapterTitle || loc.name;
    const titleLabel = loc.chapterEmoji ? `${loc.chapterEmoji} ${title}` : title;
    const revealScale = albumState.openDuration / EXPORT_ALBUM_PHASE_DURATIONS.albumOpen;
    const revealCompleteElapsed =
      albumState.openDuration +
      loc.photos.length * 0.12 * revealScale +
      Math.max(0.18 * revealScale, 0.12);

    let pinScale = 1;
    let pinOpacity = 1;
    let bookRotation = -3;
    let bookOffsetY = 0;
    let photoRevealElapsed = 0;
    let visitedOpacity = 0;
    let visitedScaleMultiplier = 1.18;

    switch (albumState.phase) {
      case "pre-open": {
        const eased = this.easeOut(albumState.phaseProgress);
        pinScale = 0.94 + 0.06 * eased;
        pinOpacity = 0.75 + 0.25 * eased;
        bookRotation = -1.6 * eased;
        break;
      }
      case "fly-to-album":
        bookRotation = -2.2;
        break;
      case "album-open": {
        const eased = this.easeOut(albumState.phaseProgress);
        bookRotation = -3 * eased;
        photoRevealElapsed = albumState.openDuration * albumState.phaseProgress;
        break;
      }
      case "album-hold":
        bookRotation = -3;
        photoRevealElapsed = revealCompleteElapsed;
        bookOffsetY = -1.5 * Math.sin(albumState.phaseProgress * Math.PI) * scale;
        break;
      case "album-to-visited": {
        const eased = this.easeOut(albumState.phaseProgress);
        pinScale = 1 - 0.28 * eased;
        pinOpacity = 1 - 0.3 * eased;
        bookRotation = -3 * (1 - eased);
        photoRevealElapsed = revealCompleteElapsed;
        visitedOpacity = eased;
        visitedScaleMultiplier = 1.24 - 0.24 * eased;
        break;
      }
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pinScale, pinScale);
    ctx.globalAlpha = pinOpacity;

    this.drawAlbumBook(ctx, {
      x: -metrics.width / 2,
      y: metrics.bookCenterY - metrics.height / 2 + bookOffsetY,
      width: metrics.width,
      height: metrics.height,
      scale,
      rotationDeg: bookRotation,
      photos: loc.photos,
      photoRevealElapsed,
      photoRevealScale: revealScale,
    });

    ctx.font = `500 ${13 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#44403c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(titleLabel, 0, metrics.labelCenterY, 180 * scale);

    ctx.beginPath();
    ctx.moveTo(0, -(EXPORT_ALBUM_PIN_GEOMETRY.tailHeight * scale));
    ctx.lineTo(0, 0);
    ctx.strokeStyle = "rgba(120, 113, 108, 0.55)";
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();

    ctx.restore();

    if (visitedOpacity > 0) {
      this.drawVisitedChapterPin(ctx, loc, cx, cy, scale, {
        opacity: visitedOpacity,
        scaleMultiplier: visitedScaleMultiplier,
      });
    }
  }

  private drawAlbumBook(
    ctx: CanvasRenderingContext2D,
    options: {
      x: number;
      y: number;
      width: number;
      height: number;
      scale: number;
      rotationDeg: number;
      photos: Photo[];
      photoRevealElapsed: number;
      photoRevealScale: number;
    },
  ): void {
    const albumStyle = useUIStore.getState().albumStyle;
    const albumCaptionsEnabled = useUIStore.getState().albumCaptionsEnabled;
    const frameStyle = this.settings.photoFrameStyle ?? "polaroid";
    const config = getAlbumStyleConfig(albumStyle);
    const shadow = this.parseShadow(config.shadow, {
      scale: options.scale,
      relativeTo: options.width,
      canvasWidth: options.width,
      canvasHeight: options.height,
    });
    const split = splitPhotosAcrossPages(options.photos.length);
    const leftPhotos = options.photos.slice(0, split.left);
    const rightPhotos = options.photos.slice(split.left);
    const pagePadding = config.pagePadding * options.scale;
    const spineWidth = config.spineWidth * options.scale;
    const borderRadius = config.borderRadius * options.scale;
    const borderWidth = config.borderWidth * options.scale;
    const pageWidth = options.width / 2;

    ctx.save();
    ctx.translate(options.x + options.width / 2, options.y + options.height / 2);
    ctx.rotate((options.rotationDeg * Math.PI) / 180);
    ctx.translate(-options.width / 2, -options.height / 2);

    if (shadow && !shadow.inset) {
      ctx.save();
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.offsetX;
      ctx.shadowOffsetY = shadow.offsetY;
      this.drawRoundedRectPath(ctx, 0, 0, options.width, options.height, borderRadius);
      ctx.fillStyle = config.pageColor;
      ctx.fill();
      ctx.restore();
    }

    this.drawRoundedRectPath(ctx, 0, 0, options.width, options.height, borderRadius);
    ctx.fillStyle = config.pageColor;
    ctx.fill();

    if (borderWidth > 0) {
      ctx.strokeStyle = config.borderColor;
      ctx.lineWidth = borderWidth;
      this.drawRoundedRectPath(ctx, borderWidth / 2, borderWidth / 2, options.width - borderWidth, options.height - borderWidth, Math.max(borderRadius - borderWidth / 2, 0));
      ctx.stroke();
    }

    const texture = ctx.createLinearGradient(0, 0, options.width, options.height);
    texture.addColorStop(0, "rgba(255,255,255,0.16)");
    texture.addColorStop(0.45, "rgba(255,255,255,0.05)");
    texture.addColorStop(1, config.noiseBlendColor ? `${config.noiseBlendColor}22` : "rgba(0,0,0,0.04)");
    this.drawRoundedRectPath(ctx, 0, 0, options.width, options.height, borderRadius);
    ctx.fillStyle = texture;
    ctx.fill();

    const leftPageX = 0;
    const rightPageX = pageWidth;

    const drawPage = (
      pageX: number,
      photos: Photo[],
      startIndex: number,
      align: "left" | "right",
    ) => {
      const innerX = pageX + pagePadding;
      const innerY = pagePadding;
      const innerW = pageWidth - pagePadding * 2;
      const innerH = options.height - pagePadding * 2;

      ctx.save();
      this.drawRoundedRectPath(ctx, innerX, innerY, innerW, innerH, Math.max(borderRadius - options.scale, 0));
      ctx.fillStyle = config.pageColor;
      ctx.fill();

      const pageGradient = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY);
      pageGradient.addColorStop(
        0,
        align === "left" ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)",
      );
      pageGradient.addColorStop(1, align === "left" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)");
      this.drawRoundedRectPath(ctx, innerX, innerY, innerW, innerH, Math.max(borderRadius - options.scale, 0));
      ctx.fillStyle = pageGradient;
      ctx.fill();

      if (photos.length === 0) {
        ctx.strokeStyle = `${config.spineColor}33`;
        ctx.lineWidth = 2 * options.scale;
        ctx.beginPath();
        ctx.moveTo(innerX + innerW * 0.18, innerY + innerH * 0.42);
        ctx.lineTo(innerX + innerW * 0.82, innerY + innerH * 0.42);
        ctx.moveTo(innerX + innerW * 0.28, innerY + innerH * 0.58);
        ctx.lineTo(innerX + innerW * 0.72, innerY + innerH * 0.58);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const grid = computeAlbumPageGrid(photos.length);
      const gap = config.gridGap * options.scale;
      const cellWidth = (innerW - gap * Math.max(grid.cols - 1, 0)) / Math.max(grid.cols, 1);
      const cellHeight = (innerH - gap * Math.max(grid.rows - 1, 0)) / Math.max(grid.rows, 1);

      photos.forEach((photo, index) => {
        const cell = grid.cells[index];
        if (!cell) return;

        const delay = startIndex * 0.12 * options.photoRevealScale + index * 0.12 * options.photoRevealScale;
        const fadeDuration = Math.max(0.18 * options.photoRevealScale, 0.12);
        const revealProgress = Math.max(
          0,
          Math.min(1, (options.photoRevealElapsed - delay) / fadeDuration),
        );
        if (revealProgress <= 0) return;

        const easedReveal = this.easeOut(revealProgress);
        const cellX = innerX + (cell.col - 1) * (cellWidth + gap);
        const cellY = innerY + (cell.row - 1) * (cellHeight + gap);
        const cellW = cellWidth * cell.colSpan + gap * (cell.colSpan - 1);
        const cellH = cellHeight * cell.rowSpan + gap * (cell.rowSpan - 1);
        const preloaded = this.photoImages.get(photo.url);

        ctx.save();
        ctx.globalAlpha *= easedReveal;
        ctx.translate(cellX + cellW / 2, cellY + cellH / 2);
        ctx.scale(0.96 + 0.04 * easedReveal, 0.96 + 0.04 * easedReveal);

        if (preloaded) {
          this.drawResolvedPhotoFrame(ctx, {
            photo,
            photoIndex: startIndex + index,
            preloaded,
            photoStyle: "classic",
            frameStyle,
            frameW: cellW,
            frameH: cellH,
            borderRadiusPx: 4,
            caption: {
              text: albumCaptionsEnabled ? photo.caption ?? "" : "",
              fontFamily: "system-ui",
              fontSizePx: Math.max(10 * options.scale, Math.min(cellW, cellH) * 0.08),
              color: "#ffffff",
              bgColor: DEFAULT_CAPTION_BG_COLOR,
              offsetX: 0,
              offsetY: 0,
              rotation: 0,
            },
            scaleX: options.scale,
            canvasWidth: options.width,
            canvasHeight: options.height,
            isFreeMode: false,
            kenBurnsProgress: null,
            focalPoint: photo.focalPoint ?? { x: 0.5, y: 0.5 },
          });
        } else {
          this.drawRoundedRect(ctx, -cellW / 2, -cellH / 2, cellW, cellH, 6 * options.scale, "rgba(0,0,0,0.08)");
        }

        ctx.restore();
      });

      ctx.restore();
    };

    drawPage(leftPageX, leftPhotos, 0, "left");
    drawPage(rightPageX, rightPhotos, split.left, "right");

    if (config.spineSpiral) {
      const spiralX = pageWidth - spineWidth / 2;
      ctx.strokeStyle = config.spineColor;
      ctx.lineWidth = 2 * options.scale;
      for (let loop = 0; loop < 14; loop += 1) {
        const y = 14 * options.scale + loop * 16 * options.scale;
        ctx.beginPath();
        ctx.arc(spiralX, y, 4.5 * options.scale, Math.PI * 0.5, Math.PI * 1.5);
        ctx.stroke();
      }
    } else {
      this.drawRoundedRect(ctx, pageWidth - spineWidth / 2, 4 * options.scale, spineWidth, options.height - 8 * options.scale, spineWidth / 2, config.spineColor);
      if (config.spineStitched) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5 * options.scale;
        ctx.setLineDash([4 * options.scale, 4 * options.scale]);
        ctx.beginPath();
        ctx.moveTo(pageWidth, 12 * options.scale);
        ctx.lineTo(pageWidth, options.height - 12 * options.scale);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (config.spineGoldAccent) {
        this.drawRoundedRect(
          ctx,
          pageWidth - 0.5 * options.scale,
          12 * options.scale,
          1.5 * options.scale,
          options.height - 24 * options.scale,
          1 * options.scale,
          "#c9a84c",
        );
      }
    }

    ctx.restore();
  }

  /** Draw "CityA → CityB" route label at bottom of canvas during FLY phase */
  private drawRouteLabel(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    captured: { progress: AnimationEvent | null },
    baseFontSize: number = 14
  ): void {
    const progress = captured.progress;
    if (!progress) return;
    // Only show during FLY phase (not during ARRIVE/HOVER when city label shows)
    if (progress.phase !== "FLY") return;
    if (progress.cityLabel) return; // city label is showing, don't overlap

    const groups = this.engine.getGroups();
    const group = groups[progress.groupIndex];
    if (!group) return;

    const lang = this.settings.cityLabelLang ?? "en";
    const fromName = lang === "zh" ? (group.fromLoc.nameZh || group.fromLoc.name) : group.fromLoc.name;
    const toName = lang === "zh" ? (group.toLoc.nameZh || group.toLoc.name) : group.toLoc.name;
    if (!fromName || !toName) return;

    const label = `${fromName} → ${toName}`;
    const fontSize = baseFontSize * scaleX;
    const font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(label);

    const padH = 16 * scaleX;
    const padV = 8 * scaleX;
    const boxWidth = padH + metrics.width + padH;
    const boxHeight = padV + fontSize * 1.2 + padV;
    const x = (canvasWidth - boxWidth) / 2;
    const bottomPercent = this.settings.routeLabelBottomPercent ?? 15;
    const y = canvasHeight - Math.max(80 * scaleX, canvasHeight * bottomPercent / 100) - boxHeight;
    const radius = boxHeight / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 8 * scaleX;
    ctx.shadowOffsetY = 2 * scaleX;

    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, radius);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.restore();

    ctx.font = font;
    ctx.fillStyle = "#374151";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + padH, y + boxHeight / 2);
  }

  /** Draw the trip stats bar at the bottom center of the canvas, matching the preview layout */
  private drawTripStats(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    captured: { progress: AnimationEvent | null; routeDraw: AnimationEvent | null }
  ): void {
    const progress = captured.progress;
    if (!progress) return;

    const tripStatsEnabled = useUIStore.getState().tripStatsEnabled;
    if (!tripStatsEnabled) return;

    const locations = this.engine.getLocations();
    const segments = this.engine.getSegments();

    // Issue 1 fix: read routeDrawFraction from routeDrawProgress event, not progress event
    let flyProgress = 0;
    if (progress.phase === "FLY") {
      if (captured.routeDraw?.routeDrawFraction !== undefined) {
        flyProgress = captured.routeDraw.routeDrawFraction;
      } else if (progress.routeDrawFraction !== undefined) {
        flyProgress = progress.routeDrawFraction;
      }
    }

    const stats = computeTripStats(
      locations,
      segments,
      progress.segmentIndex,
      progress.phase,
      flyProgress,
      progress.showPhotos
    );

    const sortedModes = getSortedTransportModes(stats.transportModes);

    // Issue 4 fix: render each section individually with separators, matching preview layout
    const fontSize = 13 * scaleX;
    const font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
    const gap = 10 * scaleX; // gap-2.5 equivalent
    const separatorW = 1 * scaleX;
    const padH = 16 * scaleX; // px-4 equivalent
    const padV = 6 * scaleX;

    // Format distance
    const distStr = stats.totalDistanceKm >= 1000
      ? `${(stats.totalDistanceKm / 1000).toFixed(1)}k km`
      : `${Math.round(stats.totalDistanceKm)} km`;

    // Build section labels
    const sections: string[] = [
      `📍 ${stats.citiesVisited}/${stats.totalCities} cities`,
      `📸 ${stats.photosShown} photos`,
      `🛣️ ${distStr}`,
    ];
    if (sortedModes.length > 0) {
      sections.push(sortedModes.map((m) => TRANSPORT_MODE_EMOJI[m] ?? m).join(" "));
    }

    // Measure each section width
    ctx.font = font;
    const sectionWidths = sections.map((s) => ctx.measureText(s).width);

    // Total bar width: padH + sections with gaps and separators + padH
    let contentWidth = 0;
    for (let i = 0; i < sectionWidths.length; i++) {
      contentWidth += sectionWidths[i];
      if (i < sectionWidths.length - 1) {
        contentWidth += gap + separatorW + gap; // gap | separator | gap
      }
    }

    const boxWidth = padH + contentWidth + padH;
    const boxHeight = padV + fontSize * 1.4 + padV;
    const x = (canvasWidth - boxWidth) / 2;
    const y = canvasHeight - 56 * scaleX - boxHeight;
    const radiusTop = 8 * scaleX;

    // Compute animation progress for fade/slide-in
    const barAge = this.tripStatsBarAge ?? 0;
    const fadeIn = Math.min(1, barAge / 10); // fade over ~10 frames (~0.3s at 30fps)
    const slideY = (1 - fadeIn) * 16 * scaleX;

    ctx.save();
    ctx.globalAlpha = fadeIn;

    // Background with slide offset
    ctx.beginPath();
    ctx.roundRect(x, y + slideY, boxWidth, boxHeight, [radiusTop, radiusTop, 0, 0]);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();

    // Draw each section individually
    ctx.font = font;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    const textY = y + slideY + boxHeight / 2;
    let cursorX = x + padH;

    for (let i = 0; i < sections.length; i++) {
      // Per-section staggered fade (later sections appear slightly after earlier ones)
      const sectionDelay = i * 3; // 3 frames stagger
      const sectionAge = Math.max(0, barAge - sectionDelay);
      const sectionAlpha = Math.min(1, sectionAge / 8);
      ctx.globalAlpha = fadeIn * sectionAlpha;

      ctx.fillStyle = "#ffffff";
      ctx.fillText(sections[i], cursorX, textY);
      cursorX += sectionWidths[i];

      // Draw separator between sections
      if (i < sections.length - 1) {
        cursorX += gap;
        ctx.globalAlpha = fadeIn * 0.2; // separator at 20% white opacity
        ctx.fillRect(cursorX, y + slideY + boxHeight / 2 - 7 * scaleX, separatorW, 14 * scaleX);
        cursorX += separatorW + gap;
      }
    }

    ctx.restore();

    // Track bar age for animation
    this.tripStatsBarAge = (this.tripStatsBarAge ?? 0) + 1;
  }

  private applyRouteDrawFromCapture(captured: { routeDraw: AnimationEvent | null }): void {
    if (captured.routeDraw) {
      this.applyRouteDrawProgress(captured.routeDraw);
    }
  }

  private drawCityLabelFromCapture(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    captured: { progress: AnimationEvent | null },
    baseFontSize: number = 18,
    lang: "en" | "zh" = "en"
  ): void {
    const labelEn = captured.progress?.cityLabel;
    const labelZh = captured.progress?.cityLabelZh;
    const label = lang === "zh" ? (labelZh || labelEn) : labelEn;
    if (label) {
      // Use mood color for the accent dot if available
      const progress = captured.progress;
      const segIdx = progress?.segmentIndex ?? -1;
      const accentColor = this.getSegmentAccentColor(segIdx);
      const baseTopPercent = this.settings.cityLabelTopPercent ?? 5;
      const topPercent = computeCityLabelTopPercent(
        baseTopPercent,
        progress?.showPhotos ?? false,
        progress?.photoOpacity ?? 0,
      );
      this.drawCityLabel(
        ctx,
        canvasWidth,
        canvasHeight,
        scaleX,
        label,
        topPercent,
        baseFontSize,
        accentColor,
      );
    }
  }

  /** Per-photo stagger delay in seconds, matching PhotoOverlay's getEnterAnimation */
  private getStaggerDelay(style: PhotoAnimation, index: number): number {
    switch (style) {
      case "none": return 0;
      case "fade": return index * 0.1;
      case "flip": return index * 0.1;
      case "scatter": return index * 0.06;
      case "typewriter": return index * 0.2;
      case "slide":
      case "scale":
      default: return index * 0.08;
    }
  }

  /** Get accent color for a segment — mood color if enabled, else default indigo */
  private getSegmentAccentColor(segmentIndex: number): string {
    const moodEnabled = useUIStore.getState().moodColorsEnabled;
    const segColors = useProjectStore.getState().segmentColors;
    if (moodEnabled && segColors[segmentIndex]) {
      return segColors[segmentIndex];
    }
    return "#6366f1";
  }

  /** Portal glow follows mood colors when available, otherwise falls back to white. */
  private getPortalAccentColor(segmentIndex: number): string {
    const moodEnabled = useUIStore.getState().moodColorsEnabled;
    const segColors = useProjectStore.getState().segmentColors;
    if (moodEnabled && segColors[segmentIndex]) {
      return segColors[segmentIndex];
    }
    return "#ffffff";
  }

  /** Cubic ease-out: matches framer-motion's default easeOut */
  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /** Compute per-photo canvas transforms for enter animation */
  private getEnterTransform(
    style: PhotoAnimation,
    progress: number, // 0→1 eased
    index: number,
    total: number,
  ): { opacity: number; scaleX: number; scaleY: number; translateX: number; translateY: number; rotate: number; blur: number } {
    const p = progress;
    switch (style) {
      case "none":
        return { opacity: 1, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "fade":
        return { opacity: p, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "scale":
        return {
          opacity: p,
          scaleX: 0.6 + 0.4 * p,
          scaleY: 0.6 + 0.4 * p,
          translateX: 0,
          translateY: 60 * (1 - p),
          rotate: 0,
          blur: 8 * (1 - p),
        };
      case "slide":
        return {
          opacity: p,
          scaleX: 1,
          scaleY: 1,
          translateX: (index % 2 === 0 ? -80 : 80) * (1 - p),
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "flip":
        // Simulate flip via horizontal scale (1→0→1 mapped from rotateY 90→0)
        return {
          opacity: p,
          scaleX: Math.abs(Math.cos((1 - p) * Math.PI / 2)),
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "scatter": {
        const angle = (index / Math.max(total, 1)) * 2 * Math.PI;
        const dist = 200;
        return {
          opacity: p,
          scaleX: 0.4 + 0.6 * p,
          scaleY: 0.4 + 0.6 * p,
          translateX: Math.cos(angle) * dist * (1 - p),
          translateY: Math.sin(angle) * dist * (1 - p),
          rotate: (index % 2 === 0 ? -30 : 30) * (1 - p),
          blur: 0,
        };
      }
      case "typewriter":
        return {
          opacity: p,
          scaleX: 0.8 + 0.2 * p,
          scaleY: 0.8 + 0.2 * p,
          translateX: 0,
          translateY: 20 * (1 - p),
          rotate: 0,
          blur: 0,
        };
    }
  }

  /** Compute per-photo canvas transforms for exit animation */
  private getExitTransform(
    style: PhotoAnimation,
    exitProgress: number, // 0→1 overall exit
    photoExitT: number, // 0→1 per-photo staggered
    index: number,
    total: number,
  ): { opacity: number; scaleX: number; scaleY: number; translateX: number; translateY: number; rotate: number; blur: number } {
    const t = photoExitT;
    switch (style) {
      case "none":
        return { opacity: 1 - exitProgress, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "fade":
        return { opacity: 1 - t, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      case "scale":
        return {
          opacity: 1 - t,
          scaleX: 1 - t * 0.4,
          scaleY: 1 - t * 0.4,
          translateX: 0,
          translateY: -t * 60,
          rotate: t * (index % 2 === 0 ? -12 : 12),
          blur: t * 6,
        };
      case "slide":
        return {
          opacity: 1 - t,
          scaleX: 1,
          scaleY: 1,
          translateX: (index % 2 === 0 ? -1 : 1) * t * 120,
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "flip":
        return {
          opacity: 1 - t * 0.8,
          scaleX: Math.abs(Math.cos(t * Math.PI / 2)),
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          rotate: 0,
          blur: 0,
        };
      case "scatter": {
        const angle = (index / 4) * 2 * Math.PI;
        const dist = 200;
        return {
          opacity: 1 - t,
          scaleX: 1 - t * 0.5,
          scaleY: 1 - t * 0.5,
          translateX: Math.cos(angle) * dist * t,
          translateY: Math.sin(angle) * dist * t,
          rotate: (index % 2 === 0 ? -25 : 25) * t,
          blur: t * 4,
        };
      }
      case "typewriter":
        return {
          opacity: 1 - t,
          scaleX: 1 - t * 0.2,
          scaleY: 1 - t * 0.2,
          translateX: 0,
          translateY: t * -30,
          rotate: 0,
          blur: 0,
        };
    }
  }

  private withAlpha(color: string, alpha: number): string {
    if (!color.startsWith("#")) return color;
    const raw = color.slice(1);
    const value = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
    if (value.length !== 6) return color;
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private drawCircularPhoto(
    ctx: CanvasRenderingContext2D,
    photo: Photo,
    preloaded: PreloadedPhoto,
    x: number,
    y: number,
    size: number,
    kenBurnsProgress: number,
    index: number,
  ): void {
    const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };
    const imgAspect = preloaded.aspect;
    let drawW: number;
    let drawH: number;
    let drawX: number;
    let drawY: number;

    if (imgAspect > 1) {
      drawH = size;
      drawW = size * imgAspect;
      drawX = x + (size - drawW) * fp.x;
      drawY = y;
    } else {
      drawW = size;
      drawH = size / imgAspect;
      drawX = x;
      drawY = y + (size - drawH) * fp.y;
    }

    const kb = getKenBurnsTransform(kenBurnsProgress, index, fp);
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.translate((kb.translateX * size) / 100, (kb.translateY * size) / 100);
    ctx.scale(kb.scale, kb.scale);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(preloaded.img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  private drawPortalPhotos(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    scaleY: number,
    loaded: { photo: Photo; preloaded: PreloadedPhoto }[],
    coordinates: [number, number],
    portalProgress: number,
    kenBurnsProgress: number,
    accentColor: string,
    options?: {
      alpha?: number;
      blur?: number;
      clip?: { direction: string; position: number } | null;
    },
  ): void {
    if (loaded.length === 0 || portalProgress <= 0) return;

    const projected = this.map.project(coordinates);
    const originX = projected.x * scaleX;
    const originY = projected.y * scaleY;
    const layout = computePortalLayout(loaded, canvasWidth, canvasHeight, originX, originY, portalProgress);
    if (layout.radius <= 0.5) return;

    if (options?.clip) {
      ctx.save();
      ctx.beginPath();
      const pos = options.clip.position;
      switch (options.clip.direction) {
        case "north":
          ctx.rect(0, 0, canvasWidth, pos * canvasHeight);
          break;
        case "south":
          ctx.rect(0, (1 - pos) * canvasHeight, canvasWidth, pos * canvasHeight);
          break;
        case "east":
          ctx.rect(0, 0, pos * canvasWidth, canvasHeight);
          break;
        case "west":
          ctx.rect((1 - pos) * canvasWidth, 0, pos * canvasWidth, canvasHeight);
          break;
      }
      ctx.clip();
    }

    ctx.save();
    ctx.globalAlpha = options?.alpha ?? 1;
    if ((options?.blur ?? 0) > 0) {
      ctx.filter = `blur(${(options?.blur ?? 0) * scaleX}px)`;
    }

    const hero = loaded[0];
    if (hero) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(originX, originY, layout.radius, 0, Math.PI * 2);
      ctx.clip();
      this.drawCircularPhoto(
        ctx,
        hero.photo,
        hero.preloaded,
        layout.heroRect.x,
        layout.heroRect.y,
        layout.heroRect.size,
        kenBurnsProgress,
        0,
      );
      ctx.restore();
    }

    const glowOuter = layout.ringRadius + 8 * scaleX;
    const glowInner = Math.max(layout.ringRadius - 4 * scaleX, 0);
    const glowGradient = ctx.createRadialGradient(originX, originY, glowInner, originX, originY, glowOuter);
    glowGradient.addColorStop(0, this.withAlpha(accentColor, 0));
    glowGradient.addColorStop(0.72, this.withAlpha(accentColor, layout.glowOpacity * 0.42));
    glowGradient.addColorStop(1, this.withAlpha(accentColor, 0));

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(originX, originY, glowOuter, 0, Math.PI * 2);
    ctx.arc(originX, originY, glowInner, 0, Math.PI * 2, true);
    ctx.fill("evenodd");

    ctx.strokeStyle = this.withAlpha(accentColor, Math.min(layout.glowOpacity * 0.95, 0.95));
    ctx.lineWidth = layout.ringWidth * scaleX;
    ctx.beginPath();
    ctx.arc(originX, originY, layout.ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    for (const satellite of layout.satellites) {
      const item = loaded[satellite.index + 1];
      if (!item || satellite.opacity <= 0 || satellite.scale <= 0) continue;

      const size = satellite.size * satellite.scale;
      const halfSize = size / 2;
      const drawX = satellite.x - halfSize;
      const drawY = satellite.y - halfSize;

      ctx.save();
      ctx.globalAlpha *= satellite.opacity;
      ctx.beginPath();
      ctx.arc(satellite.x, satellite.y, halfSize, 0, Math.PI * 2);
      ctx.clip();
      this.drawCircularPhoto(
        ctx,
        item.photo,
        item.preloaded,
        drawX,
        drawY,
        size,
        0.35,
        satellite.index + 1,
      );
      ctx.restore();

      ctx.save();
      ctx.globalAlpha *= satellite.opacity;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2 * scaleX;
      ctx.beginPath();
      ctx.arc(satellite.x, satellite.y, Math.max(halfSize - scaleX, 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    if (options?.clip) {
      ctx.restore();
    }
  }

  /** Draw photo overlays onto the offscreen canvas during ARRIVE phases */
  private drawPhotos(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    scaleY: number,
    captured: { progress: AnimationEvent | null },
    frameIndex: number,
    fps: number,
    renderTime: number,
    exportDuration: number,
  ): void {
    const progress = captured.progress;
    if (!progress) return;
    const albumState = this.getActiveAlbumState(renderTime, exportDuration);

    // During scene transitions, draw the outgoing photo set with transition opacity
    const isInSceneTransition = progress.sceneTransitionProgress !== undefined
      && progress.outgoingGroupIndex !== undefined;

    if (!isInSceneTransition) {
      const isAlbumFlyPhase = albumState?.phase === "fly-to-album";
      const isInitialHover = progress.groupIndex === 0 && progress.phase === "HOVER";
      if (!progress.showPhotos && !isAlbumFlyPhase) return;
      if (progress.phase !== "ARRIVE" && !isAlbumFlyPhase && !isInitialHover) return;
    }

    const groups = this.engine.getGroups();
    // When an album sequence is active (fly-to-album, album-open, etc.), use its
    // groupIndex directly. During the tail period (time > engineDuration) the engine
    // is clamped at seekTo(1) and progress.phase may no longer be "ARRIVE", causing
    // the fallback branch to compute groupIndex - 1 (wrong group). The albumState
    // always knows which group it belongs to, so prefer it.
    const groupIndex = isInSceneTransition
      ? progress.outgoingGroupIndex!
      : albumState
        ? albumState.groupIndex
        : progress.phase === "ARRIVE" || progress.groupIndex === 0
          ? progress.groupIndex
          : progress.groupIndex - 1;
    const group = groups[groupIndex];
    if (!group) return;

    const photoLoc =
      !isInSceneTransition && progress.groupIndex === 0 && progress.phase === "HOVER"
        ? group.fromLoc
        : group.toLoc;
    const isAlbumFlySequence = albumState?.phase === "fly-to-album" && albumState.groupIndex === groupIndex;
    if (
      albumState &&
      albumState.groupIndex === groupIndex &&
      albumState.phase !== "pre-open" &&
      !isAlbumFlySequence &&
      !isInSceneTransition
    ) {
      return;
    }

    const photos: Photo[] = photoLoc.photos;
    if (photos.length === 0) return;

    const layout = photoLoc.photoLayout;
    const gapPx = layout?.gap ?? 8;
    const borderRadiusPx = layout?.borderRadius ?? 8;

    const orderedPhotos = getOrderedPhotosForLayout(photos, layout);

    const loaded: { photo: Photo; preloaded: PreloadedPhoto }[] = [];
    for (const photo of orderedPhotos) {
      const preloaded = this.photoImages.get(photo.url);
      if (preloaded) {
        loaded.push({ photo, preloaded });
      }
    }
    if (loaded.length === 0) return;

    const insetW = canvasWidth * 0.95;
    const insetH = canvasHeight * 0.88;
    const insetX = (canvasWidth - insetW) / 2;
    const insetY = (canvasHeight - insetH) / 2;

    const captionScale = insetW / 1000;
    const captionFontSizeVal = (layout?.captionFontSize ?? 14) * captionScale;
    const captionFontFamilyVal = layout?.captionFontFamily ?? "system-ui";

    const containerAspect = insetW / insetH;
    const layoutMetas = loaded.map(({ photo, preloaded }) => ({
      id: photo.id,
      aspect: preloaded.aspect,
    }));
    const widthPx = insetW / scaleX;
    const freeTransformMap = getFreeTransformMap(layout);
    const rects = layout?.mode === "free" && layout.freeTransforms?.length
      ? loaded.reduce<PhotoRect[]>((acc, { photo }) => {
            const transform = freeTransformMap.get(photo.id);
            if (transform) {
              acc.push({
                x: transform.x,
                y: transform.y,
                width: transform.width,
                height: transform.height,
                rotation: transform.rotation,
              });
            }
            return acc;
          }, [])
      : layout?.mode === "manual" && layout.template
        ? computeTemplateLayout(
            layoutMetas,
            containerAspect,
            layout.template,
            gapPx,
            widthPx,
            layout.customProportions,
            layout.layoutSeed
          )
        : computeAutoLayout(layoutMetas, containerAspect, gapPx, widthPx);

    const count = loaded.length;
    const isFreeMode = layout?.mode === "free";
    const frameStyle = this.settings.photoFrameStyle ?? "polaroid";

    // --- Photo animation timing ---
    const {
      enterAnimation: enterAnimStyle,
      exitAnimation: exitAnimStyle,
    } = resolvePhotoAnimations(layout, this.settings.photoAnimation ?? "scale");
    const photoStyle: PhotoStyle = resolvePhotoStyle(layout, this.settings.photoStyle ?? "classic");

    if (photoStyle === "portal" && !isAlbumFlySequence) {
      let transitionOutgoingAlpha = 1;
      let transitionOutgoingBlur = 0;
      let outgoingClip: { direction: string; position: number } | null = null;

      if (isInSceneTransition) {
        const uiState = useUIStore.getState();
        const globalTransition = uiState.sceneTransition ?? "dissolve";
        const outgoingLayout = group.toLoc.photoLayout;
        const effectiveTransition: SceneTransition = resolveSceneTransition(outgoingLayout, globalTransition);

        if (effectiveTransition === "cut") return;

        const tp = progress.sceneTransitionProgress!;
        switch (effectiveTransition) {
          case "dissolve": {
            const { outgoing } = computeDissolveOpacity(tp);
            transitionOutgoingAlpha = outgoing;
            break;
          }
          case "blur-dissolve": {
            const { outgoing, blur } = computeBlurDissolve(tp);
            transitionOutgoingAlpha = outgoing;
            transitionOutgoingBlur = blur;
            break;
          }
          case "wipe": {
            const bearing = progress.transitionBearing ?? 0;
            const { wipePosition } = computeWipeProgress(tp, bearing);
            const normBearing = ((bearing % 360) + 360) % 360;
            let direction: string;
            if (normBearing >= 315 || normBearing < 45) direction = "north";
            else if (normBearing >= 45 && normBearing < 135) direction = "east";
            else if (normBearing >= 135 && normBearing < 225) direction = "south";
            else direction = "west";
            outgoingClip = { direction, position: 1 - wipePosition };
            break;
          }
        }
        if (transitionOutgoingAlpha <= 0) return;
      }

      const timeline = this.engine.getTimeline();
      const entry = timeline[groupIndex];
      const arrivePhase = entry?.phases.find((phase) => phase.phase === "ARRIVE");
      if (!arrivePhase || arrivePhase.duration <= 0) return;

      const arriveProgress = Math.max(0, Math.min(1, (progress.time - arrivePhase.startTime) / arrivePhase.duration));
      const portalProgress = isInSceneTransition
        ? Math.max(0, Math.min(1, 1 - progress.sceneTransitionProgress!))
        : computePortalPhaseProgress(arriveProgress);
      if (portalProgress <= 0) return;

      const kenBurnsProgress = Math.max(0, Math.min(1, (progress.time - arrivePhase.startTime) / KEN_BURNS_DURATION_SEC));
      this.drawPortalPhotos(
        ctx,
        canvasWidth,
        canvasHeight,
        scaleX,
        scaleY,
        loaded,
        photoLoc.coordinates,
        portalProgress,
        kenBurnsProgress,
        this.getPortalAccentColor(groupIndex),
        {
          alpha: transitionOutgoingAlpha,
          blur: transitionOutgoingBlur,
          clip: outgoingClip,
        },
      );
      return;
    }

    // --- Scene transition outgoing opacity/blur/clip ---
    let transitionOutgoingAlpha = 1;
    let transitionOutgoingBlur = 0;
    let outgoingClip: { direction: string; position: number } | null = null;

    if (isInSceneTransition) {
      const uiState = useUIStore.getState();
      const globalTransition = uiState.sceneTransition ?? "dissolve";
      const outgoingLayout = group.toLoc.photoLayout;
      const effectiveTransition: SceneTransition = resolveSceneTransition(outgoingLayout, globalTransition);

      if (effectiveTransition === "cut") return;

      const tp = progress.sceneTransitionProgress!;
      switch (effectiveTransition) {
        case "dissolve": {
          const { outgoing } = computeDissolveOpacity(tp);
          transitionOutgoingAlpha = outgoing;
          break;
        }
        case "blur-dissolve": {
          const { outgoing, blur } = computeBlurDissolve(tp);
          transitionOutgoingAlpha = outgoing;
          transitionOutgoingBlur = blur;
          break;
        }
        case "wipe": {
          const bearing = progress.transitionBearing ?? 0;
          const { wipePosition } = computeWipeProgress(tp, bearing);
          const normBearing = ((bearing % 360) + 360) % 360;
          let direction: string;
          if (normBearing >= 315 || normBearing < 45) direction = "north";
          else if (normBearing >= 45 && normBearing < 135) direction = "east";
          else if (normBearing >= 135 && normBearing < 225) direction = "south";
          else direction = "west";
          outgoingClip = { direction, position: 1 - wipePosition };
          break;
        }
      }
      if (transitionOutgoingAlpha <= 0) return;
    }

    // Apply canvas clip for outgoing wipe transition
    if (outgoingClip) {
      ctx.save();
      ctx.beginPath();
      const pos = outgoingClip.position;
      switch (outgoingClip.direction) {
        case "north":
          ctx.rect(0, 0, canvasWidth, pos * canvasHeight);
          break;
        case "south":
          ctx.rect(0, (1 - pos) * canvasHeight, canvasWidth, pos * canvasHeight);
          break;
        case "east":
          ctx.rect(0, 0, pos * canvasWidth, canvasHeight);
          break;
        case "west":
          ctx.rect((1 - pos) * canvasWidth, 0, pos * canvasWidth, canvasHeight);
          break;
      }
      ctx.clip();
    }

    // Ken Burns: compute elapsed time since ARRIVE start (seconds).
    // Per-photo progress is derived inside the loop to account for enter stagger.
    let kenBurnsElapsed = 0;
    if (photoStyle === "kenburns") {
      const timeline = this.engine.getTimeline();
      const entry = timeline[groupIndex];
      if (entry) {
        const arrivePhase = entry.phases.find((p: { phase: string }) => p.phase === "ARRIVE");
        if (arrivePhase) {
          kenBurnsElapsed = Math.max(0, progress.time - arrivePhase.startTime);
        }
      }
    }

    // Bloom: compute origin and elapsed time
    let bloomOriginCanvas: { x: number; y: number } | null = null;
    let bloomElapsed = 0;
    if (photoStyle === "bloom") {
      const projected = this.map.project(photoLoc.coordinates as [number, number]);
      // Map viewport coords → canvas coords
      const mapContainer = this.map.getContainer();
      const mapW = mapContainer.clientWidth || 1;
      const mapH = mapContainer.clientHeight || 1;
      bloomOriginCanvas = {
        x: (projected.x / mapW) * canvasWidth,
        y: (projected.y / mapH) * canvasHeight,
      };

      const timeline = this.engine.getTimeline();
      const entry = timeline[groupIndex];
      if (entry) {
        const arrivePhase = entry.phases.find((p: { phase: string }) => p.phase === "ARRIVE");
        if (arrivePhase) {
          bloomElapsed = Math.max(0, progress.time - arrivePhase.startTime);
        }
      }
    }

    // Fix #3: Override with radial fan layout for bloom style
    const effectiveRects = (() => {
      if (photoStyle !== "bloom" || !bloomOriginCanvas) return rects;
      const originFracX = (bloomOriginCanvas.x - insetX) / insetW;
      const originFracY = (bloomOriginCanvas.y - insetY) / insetH;
      return computeBloomFanLayout(
        originFracX,
        originFracY,
        layoutMetas.map((m) => ({ aspect: m.aspect })),
        insetW / scaleX,
        insetH / scaleX,
      );
    })();

    const albumConvergence = isAlbumFlySequence
      ? (() => {
          const projected = this.map.project(photoLoc.coordinates as [number, number]);
          const metrics = this.getAlbumPinMetrics(scaleX);
          return {
            x: projected.x * scaleX,
            y: projected.y * scaleY + metrics.convergenceY,
          };
        })()
      : null;
    const hasAlbumSequence = this.getAlbumSequenceTiming(groupIndex, exportDuration) !== null;

    const photoGroupIdx = groupIndex;

    // Track when photos first appeared for this group
    if (!this.photoShowStartFrame.has(photoGroupIdx)) {
      this.photoShowStartFrame.set(photoGroupIdx, frameIndex);
    }
    const enterStartFrame = this.photoShowStartFrame.get(photoGroupIdx)!;

    // Enter animation: ~0.4s per photo, with per-photo stagger
    const enterDurationSec = 0.4;
    const enterDurationFrames = enterDurationSec * fps;

    // Exit: derive from photoOpacity (1 = fully visible, 0 = fully gone)
    // During scene transitions, transition opacity is the sole driver — no per-photo exit animation.
    let exitProgress = 0;
    if (isAlbumFlySequence) {
      exitProgress = 0;
    } else if (isInSceneTransition) {
      // Scene transition handles fading via transitionOutgoingAlpha — no exit animation
      exitProgress = 0;
    } else if (progress.phase === "ARRIVE" && progress.progress > 0) {
      if (hasAlbumSequence) {
        exitProgress = 0;
      } else {
      // Compute phase progress within ARRIVE
      // Use photoOpacity if it's already fading, otherwise compute from timeline
      const opacity = progress.photoOpacity ?? 1;
      if (opacity < 1) {
        exitProgress = 1 - opacity;
      } else {
        // Check if we're in the last 30% of ARRIVE by checking time position
        // Use a simple heuristic: if groupIndex has photos and we're past 70% of arrive
        const timeline = this.engine.getTimeline();
        const entry = timeline[progress.groupIndex];
        if (entry) {
          const arrivePhase = entry.phases.find((p: { phase: string }) => p.phase === "ARRIVE");
          if (arrivePhase && arrivePhase.duration > 0) {
            const arriveProgress = (progress.time - arrivePhase.startTime) / arrivePhase.duration;
            if (arriveProgress > 0.7) {
              exitProgress = (arriveProgress - 0.7) / 0.3;
            }
          }
        }
      }
      }
    } else if (progress.phase !== "ARRIVE") {
      exitProgress = 1 - (progress.photoOpacity ?? 1);
    }

    // Bloom tether lines: drawn before photos so they appear behind
    if (photoStyle === "bloom" && bloomOriginCanvas && exitProgress <= 0 && !isAlbumFlySequence) {
      const bloomEnterProgress = Math.min(1, bloomElapsed / BLOOM_ENTER_DURATION_SEC);
      // Tether lines visible only when photos are settled (progress >= 1)
      const tetherAlpha = bloomEnterProgress >= 1 ? 0.3 * transitionOutgoingAlpha : 0;
      if (tetherAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = tetherAlpha;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5 * scaleX;
        ctx.lineCap = "round";
        for (let i = 0; i < effectiveRects.length; i++) {
          const rect = effectiveRects[i];
          const targetCX = insetX + (rect.x + rect.width / 2) * insetW;
          const targetCY = insetY + (rect.y + rect.height / 2) * insetH;
          const cpX = (bloomOriginCanvas.x + targetCX) / 2;
          const cpY = (bloomOriginCanvas.y + targetCY) / 2 - 20 * scaleX;
          ctx.beginPath();
          ctx.moveTo(bloomOriginCanvas.x, bloomOriginCanvas.y);
          ctx.quadraticCurveTo(cpX, cpY, targetCX, targetCY);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    for (let i = 0; i < effectiveRects.length; i++) {
      const rect = effectiveRects[i];
      const { photo, preloaded } = loaded[i];
      const freeTransform = freeTransformMap.get(photo.id);
      const captionDisplay = this.getCaptionDisplay(
        photo,
        freeTransform,
        captionFontFamilyVal,
        captionFontSizeVal,
        captionScale,
      );
      const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };

      const rx = insetX + rect.x * insetW;
      const ry = insetY + rect.y * insetH;
      const rw = rect.width * insetW;
      const rh = rect.height * insetH;

      const frameW = rw;
      const frameH = rh;

      // Use scatter rotation if provided, otherwise default tilts
      let rotation: number;
      if (rect.rotation != null) {
        rotation = rect.rotation;
      } else if (count <= 3) {
        if (i === 0) rotation = -2;
        else if (i === count - 1) rotation = 2;
        else rotation = 0;
      } else {
        rotation = i % 2 === 0 ? -1.5 : 1.5;
      }

      const centerX = rx + frameW / 2;
      const centerY = ry + frameH / 2;

      // --- Compute animation transform for this photo ---
      let animTransform: { opacity: number; scaleX: number; scaleY: number; translateX: number; translateY: number; rotate: number; blur: number };

      if (isAlbumFlySequence && albumConvergence) {
        const stagger = count > 1 ? (i / Math.max(count - 1, 1)) * 0.18 : 0;
        const localProgress = Math.max(
          0,
          Math.min(1, (albumState.phaseProgress - stagger) / Math.max(1 - stagger, 0.0001)),
        );
        const eased = this.easeOut(localProgress);
        animTransform = {
          opacity: 1 - 0.92 * eased,
          scaleX: 1 - 0.85 * eased,
          scaleY: 1 - 0.85 * eased,
          translateX: ((albumConvergence.x - centerX) / scaleX) * eased,
          translateY: ((albumConvergence.y - centerY) / scaleX) * eased,
          rotate: (i % 2 === 0 ? -8 : 8) * eased,
          blur: 2 * eased,
        };
      } else if (photoStyle === "bloom" && bloomOriginCanvas) {
        // Bloom: use geo-anchored transform
        const targetPx = { x: rx, y: ry, w: frameW, h: frameH };
        if (exitProgress > 0) {
          const bt = getBloomExitTransform(exitProgress, i, count, bloomOriginCanvas.x, bloomOriginCanvas.y, targetPx);
          animTransform = { opacity: bt.opacity, scaleX: bt.scale, scaleY: bt.scale, translateX: bt.translateX, translateY: bt.translateY, rotate: 0, blur: 0 };
        } else {
          const enterProgress = Math.min(1, bloomElapsed / BLOOM_ENTER_DURATION_SEC);
          const bt = getBloomTransform(enterProgress, i, count, bloomOriginCanvas.x, bloomOriginCanvas.y, targetPx);
          animTransform = { opacity: bt.opacity, scaleX: bt.scale, scaleY: bt.scale, translateX: bt.translateX, translateY: bt.translateY, rotate: 0, blur: 0 };
        }
      } else if (exitProgress > 0) {
        // Exit animations always run during fade-out; "none" maps to opacity-only parity with PhotoOverlay.
        const staggerOffset = count > 1 ? (count - 1 - i) / (count - 1) * 0.4 : 0;
        const photoExitT = Math.max(0, Math.min(1, (exitProgress - staggerOffset) / (1 - staggerOffset + 0.01)));
        animTransform = this.getExitTransform(exitAnimStyle, exitProgress, photoExitT, i, count);
      } else if (enterAnimStyle !== "none") {
        // Enter animation with per-photo stagger
        const staggerDelaySec = this.getStaggerDelay(enterAnimStyle, i);
        const staggerDelayFrames = staggerDelaySec * fps;
        const elapsed = frameIndex - enterStartFrame - staggerDelayFrames;
        const rawProgress = Math.max(0, Math.min(1, elapsed / enterDurationFrames));
        const easedProgress = this.easeOut(rawProgress);
        animTransform = this.getEnterTransform(enterAnimStyle, easedProgress, i, count);
      } else {
        animTransform = { opacity: 1, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotate: 0, blur: 0 };
      }

      // Skip fully transparent photos
      if (animTransform.opacity <= 0) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = animTransform.opacity * transitionOutgoingAlpha;
      const totalBlur = animTransform.blur + transitionOutgoingBlur;
      if (totalBlur > 0) {
        ctx.filter = `blur(${totalBlur * scaleX}px)`;
      }
      ctx.translate(centerX + animTransform.translateX * scaleX, centerY + animTransform.translateY * scaleX);
      ctx.rotate((rotation + animTransform.rotate) * Math.PI / 180);
      ctx.scale(animTransform.scaleX, animTransform.scaleY);
      const kbStagger = this.getStaggerDelay(enterAnimStyle, i);
      const kenBurnsProgress = photoStyle === "kenburns"
        ? Math.max(0, Math.min(1, (kenBurnsElapsed - kbStagger) / KEN_BURNS_DURATION_SEC))
        : null;

      this.drawResolvedPhotoFrame(ctx, {
        photo,
        photoIndex: i,
        preloaded,
        photoStyle,
        frameStyle,
        frameW,
        frameH,
        borderRadiusPx,
        caption: captionDisplay,
        scaleX,
        canvasWidth,
        canvasHeight,
        isFreeMode,
        kenBurnsProgress,
        focalPoint: fp,
      });

      ctx.restore();

      if (isFreeMode && captionDisplay.text.trim().length > 0) {
        this.drawFreeCaption(ctx, {
          caption: captionDisplay,
          x: insetX + (rect.x + rect.width / 2 + captionDisplay.offsetX) * insetW + animTransform.translateX * scaleX,
          y: insetY + (rect.y + rect.height / 2 + captionDisplay.offsetY) * insetH + animTransform.translateY * scaleX,
          opacity: animTransform.opacity * transitionOutgoingAlpha,
          blurPx: transitionOutgoingBlur * scaleX,
          maxWidth: Math.max(frameW, 160 * scaleX),
          scaleX,
        });
      }
    }

    // Restore clip if outgoing wipe was applied
    if (outgoingClip) {
      ctx.restore();
    }
  }

  /**
   * Draw incoming photo set during scene transitions (dissolve/blur-dissolve/wipe).
   * Composites the incoming location's photos with transition-appropriate opacity/blur/clip.
   */
  private drawSceneTransitionPhotos(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scaleX: number,
    scaleY: number,
    captured: { progress: AnimationEvent | null },
    _frameIndex: number,
    _fps: number,
  ): void {
    const progress = captured.progress;
    if (!progress) return;
    if (progress.sceneTransitionProgress === undefined) return;
    if (progress.incomingGroupIndex === undefined) return;

    // Get global scene transition setting
    const uiState = useUIStore.getState();
    const globalTransition = uiState.sceneTransition ?? "dissolve";

    const groups = this.engine.getGroups();

    // Resolve per-location transition from outgoing location
    const outgoingGroup = progress.outgoingGroupIndex !== undefined ? groups[progress.outgoingGroupIndex] : undefined;
    const outgoingLayout = outgoingGroup?.toLoc.photoLayout;
    const effectiveTransition: SceneTransition = resolveSceneTransition(outgoingLayout, globalTransition);

    if (effectiveTransition === "cut") return;

    const incomingGroup = groups[progress.incomingGroupIndex];
    if (!incomingGroup) return;

    const incomingPhotos: Photo[] = incomingGroup.toLoc.photos;
    if (incomingPhotos.length === 0) return;

    const transitionProgress = progress.sceneTransitionProgress;

    // Apply outgoing transition to the ALREADY drawn photos
    // We need to modulate what was just drawn by drawPhotos.
    // Since drawPhotos already drew the outgoing photos, we can't easily change their opacity retroactively.
    // Instead, for the export, we handle the transition by drawing the incoming photos with the appropriate opacity.
    // The outgoing photos' exit was already handled by drawPhotos via photoOpacity.

    // Compute incoming transition values
    let incomingOpacity = 1;
    let incomingBlur = 0;
    let clipPath: { direction: string; position: number } | null = null;

    switch (effectiveTransition) {
      case "dissolve": {
        const { incoming } = computeDissolveOpacity(transitionProgress);
        incomingOpacity = incoming;
        break;
      }
      case "blur-dissolve": {
        const { incoming, blur } = computeBlurDissolve(transitionProgress);
        incomingOpacity = incoming;
        incomingBlur = blur;
        break;
      }
      case "wipe": {
        const bearing = progress.transitionBearing ?? 0;
        const { wipePosition } = computeWipeProgress(transitionProgress, bearing);
        const normBearing = ((bearing % 360) + 360) % 360;
        let direction: string;
        if (normBearing >= 315 || normBearing < 45) direction = "north";
        else if (normBearing >= 45 && normBearing < 135) direction = "east";
        else if (normBearing >= 135 && normBearing < 225) direction = "south";
        else direction = "west";
        clipPath = { direction, position: wipePosition };
        break;
      }
    }

    if (incomingOpacity <= 0) return;

    // Draw incoming photos
    const layout = incomingGroup.toLoc.photoLayout;
    const gapPx = layout?.gap ?? 8;
    const borderRadiusPx = layout?.borderRadius ?? 8;

    const orderedPhotos = getOrderedPhotosForLayout(incomingPhotos, layout);

    const loaded: { photo: Photo; preloaded: PreloadedPhoto }[] = [];
    for (const photo of orderedPhotos) {
      const preloaded = this.photoImages.get(photo.url);
      if (preloaded) loaded.push({ photo, preloaded });
    }
    if (loaded.length === 0) return;

    const insetW = canvasWidth * 0.95;
    const insetH = canvasHeight * 0.88;
    const insetX = (canvasWidth - insetW) / 2;
    const insetY = (canvasHeight - insetH) / 2;

    const captionScale = insetW / 1000;
    const captionFontSizeVal = (layout?.captionFontSize ?? 14) * captionScale;
    const captionFontFamilyVal = layout?.captionFontFamily ?? "system-ui";

    const containerAspect = insetW / insetH;
    const layoutMetas = loaded.map(({ photo, preloaded }) => ({
      id: photo.id,
      aspect: preloaded.aspect,
    }));
    const widthPx = insetW / scaleX;
    const freeTransformMap = getFreeTransformMap(layout);
    const rects = layout?.mode === "free" && layout.freeTransforms?.length
      ? loaded.reduce<PhotoRect[]>((acc, { photo }) => {
            const transform = freeTransformMap.get(photo.id);
            if (transform) {
              acc.push({
                x: transform.x,
                y: transform.y,
                width: transform.width,
                height: transform.height,
                rotation: transform.rotation,
              });
            }
            return acc;
          }, [])
      : layout?.mode === "manual" && layout.template
        ? computeTemplateLayout(layoutMetas, containerAspect, layout.template, gapPx, widthPx, layout.customProportions, layout.layoutSeed)
        : computeAutoLayout(layoutMetas, containerAspect, gapPx, widthPx);
    const count = loaded.length;
    const isFreeMode = layout?.mode === "free";
    const frameStyle = this.settings.photoFrameStyle ?? "polaroid";
    const photoStyle: PhotoStyle = resolvePhotoStyle(layout, this.settings.photoStyle ?? "classic");
    if (photoStyle === "portal") {
      const portalProgress = computePortalPhaseProgress(transitionProgress);
      if (portalProgress <= 0 || incomingOpacity <= 0) return;

      this.drawPortalPhotos(
        ctx,
        canvasWidth,
        canvasHeight,
        scaleX,
        scaleY,
        loaded,
        incomingGroup.toLoc.coordinates,
        portalProgress,
        portalProgress,
        this.getPortalAccentColor(progress.incomingGroupIndex),
        {
          alpha: incomingOpacity,
          blur: incomingBlur,
          clip: clipPath,
        },
      );
      return;
    }

    // Apply canvas clip for wipe transition
    if (clipPath) {
      ctx.save();
      ctx.beginPath();
      const pos = clipPath.position;
      switch (clipPath.direction) {
        case "north":
          ctx.rect(0, (1 - pos) * canvasHeight, canvasWidth, pos * canvasHeight);
          break;
        case "south":
          ctx.rect(0, 0, canvasWidth, pos * canvasHeight);
          break;
        case "east":
          ctx.rect((1 - pos) * canvasWidth, 0, pos * canvasWidth, canvasHeight);
          break;
        case "west":
          ctx.rect(0, 0, pos * canvasWidth, canvasHeight);
          break;
      }
      ctx.clip();
    }

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const { photo, preloaded } = loaded[i];
      const freeTransform = freeTransformMap.get(photo.id);
      const captionDisplay = this.getCaptionDisplay(
        photo,
        freeTransform,
        captionFontFamilyVal,
        captionFontSizeVal,
        captionScale,
      );
      const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };

      const rx = insetX + rect.x * insetW;
      const ry = insetY + rect.y * insetH;
      const rw = rect.width * insetW;
      const rh = rect.height * insetH;
      const frameW = rw;
      const frameH = rh;

      let rotation: number;
      if (rect.rotation != null) {
        rotation = rect.rotation;
      } else if (count <= 3) {
        if (i === 0) rotation = -2;
        else if (i === count - 1) rotation = 2;
        else rotation = 0;
      } else {
        rotation = i % 2 === 0 ? -1.5 : 1.5;
      }

      const centerX = rx + frameW / 2;
      const centerY = ry + frameH / 2;

      ctx.save();
      ctx.globalAlpha = incomingOpacity;
      if (incomingBlur > 0) {
        ctx.filter = `blur(${incomingBlur * scaleX}px)`;
      }
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * Math.PI / 180);
      this.drawResolvedPhotoFrame(ctx, {
        photo,
        photoIndex: i,
        preloaded,
        photoStyle,
        frameStyle,
        frameW,
        frameH,
        borderRadiusPx,
        caption: captionDisplay,
        scaleX,
        canvasWidth,
        canvasHeight,
        isFreeMode,
        kenBurnsProgress: null,
        focalPoint: fp,
      });

      ctx.restore();

      if (isFreeMode && captionDisplay.text.trim().length > 0) {
        this.drawFreeCaption(ctx, {
          caption: captionDisplay,
          x: insetX + (rect.x + rect.width / 2 + captionDisplay.offsetX) * insetW,
          y: insetY + (rect.y + rect.height / 2 + captionDisplay.offsetY) * insetH,
          opacity: incomingOpacity,
          blurPx: incomingBlur * scaleX,
          maxWidth: Math.max(frameW, 160 * scaleX),
          scaleX,
        });
      }
    }

    // Restore clip if wipe was applied
    if (clipPath) {
      ctx.restore();
    }
  }

  private getCaptionDisplay(
    photo: Photo,
    transform: FreePhotoTransform | undefined,
    defaultFontFamily: string,
    defaultFontSizePx: number,
    scale: number,
  ): ExportCaptionDisplay {
    return {
      text: transform?.caption?.text ?? photo.caption ?? "",
      fontFamily: transform?.caption?.fontFamily ?? defaultFontFamily,
      fontSizePx: (transform?.caption?.fontSize ?? defaultFontSizePx / Math.max(scale, 0.0001)) * scale,
      color: transform?.caption?.color ?? "#ffffff",
      bgColor: transform?.caption?.bgColor ?? DEFAULT_CAPTION_BG_COLOR,
      offsetX: transform?.caption?.offsetX ?? 0,
      offsetY: transform?.caption?.offsetY ?? ((transform?.height ?? 0) / 2 + 0.04),
      rotation: transform?.caption?.rotation ?? 0,
    };
  }

  private getCanvasFontFamily(fontFamily: string): string {
    const normalized = fontFamily
      .replace(/var\([^)]+\)\s*,?\s*/g, "")
      .replace(/\s*,\s*,/g, ",")
      .trim()
      .replace(/^,\s*/, "");

    return normalized.length > 0 ? normalized : "system-ui";
  }

  private parseCssLengthToPx(
    value: string | undefined,
    options: {
      scale: number;
      relativeTo: number;
      canvasWidth: number;
      canvasHeight: number;
    },
  ): number {
    if (!value) return 0;

    const trimmed = value.trim();
    if (!trimmed) return 0;

    if (trimmed.startsWith("clamp(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(6, -1);
      const parts = inner.split(",").map((part) => part.trim());
      if (parts.length === 3) {
        const min = this.parseCssLengthToPx(parts[0], options);
        const preferred = this.parseCssLengthToPx(parts[1], options);
        const max = this.parseCssLengthToPx(parts[2], options);
        return Math.min(max, Math.max(min, preferred));
      }
    }

    if (trimmed.endsWith("%")) {
      const numeric = Number.parseFloat(trimmed.slice(0, -1));
      return Number.isFinite(numeric) ? (options.relativeTo * numeric) / 100 : 0;
    }

    if (trimmed.endsWith("vw")) {
      const numeric = Number.parseFloat(trimmed.slice(0, -2));
      return Number.isFinite(numeric) ? (options.canvasWidth * numeric) / 100 : 0;
    }

    if (trimmed.endsWith("vh")) {
      const numeric = Number.parseFloat(trimmed.slice(0, -2));
      return Number.isFinite(numeric) ? (options.canvasHeight * numeric) / 100 : 0;
    }

    if (trimmed.endsWith("rem")) {
      const numeric = Number.parseFloat(trimmed.slice(0, -3));
      return Number.isFinite(numeric) ? numeric * 16 * options.scale : 0;
    }

    if (trimmed.endsWith("px")) {
      const numeric = Number.parseFloat(trimmed.slice(0, -2));
      return Number.isFinite(numeric) ? numeric * options.scale : 0;
    }

    const numeric = Number.parseFloat(trimmed);
    return Number.isFinite(numeric) ? numeric * options.scale : 0;
  }

  private parseBoxSpacing(
    value: string | undefined,
    options: {
      scale: number;
      relativeTo: number;
      canvasWidth: number;
      canvasHeight: number;
    },
  ): BoxSpacing {
    const tokens = value?.trim().split(/\s+/).filter(Boolean) ?? [];
    const resolved = tokens.length > 0 ? tokens : ["0"];
    const lengths = resolved.map((token) => this.parseCssLengthToPx(token, options));

    switch (lengths.length) {
      case 1:
        return { top: lengths[0], right: lengths[0], bottom: lengths[0], left: lengths[0] };
      case 2:
        return { top: lengths[0], right: lengths[1], bottom: lengths[0], left: lengths[1] };
      case 3:
        return { top: lengths[0], right: lengths[1], bottom: lengths[2], left: lengths[1] };
      default:
        return {
          top: lengths[0],
          right: lengths[1],
          bottom: lengths[2],
          left: lengths[3],
        };
    }
  }

  private parseShadow(
    value: string | undefined,
    options: {
      scale: number;
      relativeTo: number;
      canvasWidth: number;
      canvasHeight: number;
    },
  ): ParsedShadow | null {
    if (!value || value === "none") return null;

    const inset = value.includes("inset");
    const colorMatch = value.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
    const color = colorMatch?.[0] ?? "rgba(0,0,0,0.18)";
    const remainder = value
      .replace(color, "")
      .replace(/\binset\b/g, "")
      .trim();
    const parts = remainder.split(/\s+/).filter(Boolean);

    return {
      inset,
      offsetX: this.parseCssLengthToPx(parts[0] ?? "0", options),
      offsetY: this.parseCssLengthToPx(parts[1] ?? "0", options),
      blur: this.parseCssLengthToPx(parts[2] ?? "0", options),
      color,
    };
  }

  private getWrappedTextLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number,
  ): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (maxWidth <= 0) return [trimmed];

    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      return [this.ellipsizeText(ctx, trimmed, maxWidth)];
    }

    const lines: string[] = [];
    let current = "";

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      const candidate = current.length > 0 ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || current.length === 0) {
        current = candidate;
        continue;
      }

      lines.push(current);
      if (lines.length === maxLines - 1) {
        const remaining = words.slice(index).join(" ");
        lines.push(this.ellipsizeText(ctx, remaining, maxWidth));
        return lines;
      }
      current = word;
    }

    if (current.length > 0) {
      lines.push(lines.length === maxLines - 1 ? this.ellipsizeText(ctx, current, maxWidth) : current);
    }

    return lines.slice(0, maxLines);
  }

  private ellipsizeText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string {
    if (ctx.measureText(text).width <= maxWidth) return text;

    let candidate = text.trim();
    while (candidate.length > 1 && ctx.measureText(`${candidate}...`).width > maxWidth) {
      candidate = candidate.slice(0, -1).trimEnd();
    }

    return candidate.length > 0 ? `${candidate}...` : text.slice(0, 1);
  }

  private drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, safeRadius);
  }

  private drawFilmStrip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    perforationColor: string,
    scaleX: number,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    const bandTop = y + height * 0.22;
    const bandHeight = height * 0.56;
    const step = 22 * scaleX;
    const slotWidth = 6 * scaleX;

    ctx.fillStyle = perforationColor;
    for (let cursor = x + 8 * scaleX; cursor < x + width - slotWidth; cursor += step) {
      ctx.fillRect(cursor, bandTop, slotWidth, bandHeight);
    }
  }

  private drawBorderlessVignette(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: string,
  ): void {
    ctx.save();
    this.drawRoundedRectPath(ctx, x, y, width, height, radius);
    ctx.clip();

    const gradient = ctx.createRadialGradient(
      x + width / 2,
      y + height / 2,
      Math.min(width, height) * 0.2,
      x + width / 2,
      y + height / 2,
      Math.max(width, height) * 0.78,
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  private drawFreeCaption(
    ctx: CanvasRenderingContext2D,
    options: {
      caption: ExportCaptionDisplay;
      x: number;
      y: number;
      opacity: number;
      blurPx: number;
      maxWidth: number;
      scaleX: number;
    },
  ): void {
    const text = options.caption.text.trim();
    if (!text) return;

    const fontFamily = this.getCanvasFontFamily(options.caption.fontFamily);
    const fontSize = options.caption.fontSizePx;
    const lineHeight = fontSize * 1.2;
    const paddingX = 8 * options.scaleX;
    const paddingY = 4 * options.scaleX;

    ctx.save();
    ctx.globalAlpha = options.opacity;
    if (options.blurPx > 0) {
      ctx.filter = `blur(${options.blurPx}px)`;
    }

    ctx.font = `${fontSize}px ${fontFamily}, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const rendered = this.ellipsizeText(ctx, text, Math.max(options.maxWidth - paddingX * 2, fontSize));
    const boxWidth = Math.min(options.maxWidth, ctx.measureText(rendered).width + paddingX * 2);
    const boxHeight = lineHeight + paddingY * 2;

    ctx.translate(options.x, options.y);
    ctx.rotate((options.caption.rotation * Math.PI) / 180);

    this.drawRoundedRectPath(ctx, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 6 * options.scaleX);
    ctx.fillStyle = options.caption.bgColor;
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 6 * options.scaleX;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = options.caption.color;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6 * options.scaleX;
    ctx.fillText(rendered, 0, 0, Math.max(boxWidth - paddingX * 2, fontSize));
    ctx.restore();
  }

  private drawResolvedPhotoFrame(
    ctx: CanvasRenderingContext2D,
    options: {
      photo: Photo;
      photoIndex: number;
      preloaded: PreloadedPhoto;
      photoStyle: PhotoStyle;
      frameStyle: PhotoFrameStyle;
      frameW: number;
      frameH: number;
      borderRadiusPx: number;
      caption: ExportCaptionDisplay;
      scaleX: number;
      canvasWidth: number;
      canvasHeight: number;
      isFreeMode: boolean;
      kenBurnsProgress: number | null;
      focalPoint: { x: number; y: number };
    },
  ): void {
    const frameConfig = getPhotoFrameStyleConfig(options.frameStyle);
    const decorativeRotation = options.isFreeMode
      ? 0
      : getPhotoFrameRotation(options.frameStyle, options.photo.id);
    const parseOptions = {
      scale: options.scaleX,
      relativeTo: options.frameW,
      canvasWidth: options.canvasWidth,
      canvasHeight: options.canvasHeight,
    };
    const framePadding = this.parseBoxSpacing(frameConfig.framePadding, parseOptions);
    const outerRadius = this.parseCssLengthToPx(frameConfig.outerBorderRadius, parseOptions);
    const configuredMediaRadius = this.parseCssLengthToPx(frameConfig.mediaBorderRadius, parseOptions);
    const mediaRadius = Math.max(configuredMediaRadius, options.borderRadiusPx * options.scaleX);
    const frameShadow = this.parseShadow(frameConfig.frameShadow, parseOptions);
    const hasInlineCaption = !options.isFreeMode
      && frameStyleUsesInlineCaption(options.frameStyle)
      && options.caption.text.trim().length > 0;
    const hasFooterCaption = !options.isFreeMode
      && !frameStyleUsesInlineCaption(options.frameStyle)
      && options.caption.text.trim().length > 0;

    const innerX = -options.frameW / 2 + framePadding.left;
    const innerY = -options.frameH / 2 + framePadding.top;
    const innerW = Math.max(0, options.frameW - framePadding.left - framePadding.right);

    let inlineCaptionHeight = 0;
    let inlineCaptionLines: string[] = [];
    let inlineCaptionFontSize = 0;
    let inlineCaptionLineHeight = 0;
    let inlineCaptionPadding: BoxSpacing = { top: 0, right: 0, bottom: 0, left: 0 };
    let inlineCaptionFontFamily = "system-ui";
    let inlineCaptionColor = frameConfig.inlineCaptionColor ?? "rgba(15, 23, 42, 0.82)";

    if (hasInlineCaption) {
      inlineCaptionPadding = this.parseBoxSpacing(frameConfig.inlineCaptionPadding, {
        ...parseOptions,
        relativeTo: innerW,
      });
      inlineCaptionFontSize = this.parseCssLengthToPx(frameConfig.inlineCaptionFontSize, {
        ...parseOptions,
        relativeTo: innerW,
      });
      inlineCaptionFontFamily = this.getCanvasFontFamily(
        frameConfig.inlineCaptionFontFamily ?? options.caption.fontFamily,
      );
      inlineCaptionLineHeight = inlineCaptionFontSize * 1.05;
      const inlineMinHeight = this.parseCssLengthToPx(frameConfig.inlineCaptionMinHeight, {
        ...parseOptions,
        relativeTo: options.frameH,
      });

      ctx.save();
      ctx.font = `${inlineCaptionFontSize}px ${inlineCaptionFontFamily}, -apple-system, sans-serif`;
      inlineCaptionLines = this.getWrappedTextLines(
        ctx,
        options.caption.text,
        Math.max(innerW - inlineCaptionPadding.left - inlineCaptionPadding.right, inlineCaptionFontSize),
        2,
      );
      ctx.restore();

      inlineCaptionHeight = Math.max(
        inlineMinHeight,
        inlineCaptionLines.length * inlineCaptionLineHeight + inlineCaptionPadding.top + inlineCaptionPadding.bottom,
      );
    }

    let footerHeight = 0;
    let footerLines: string[] = [];
    let footerLineHeight = 0;
    const footerPaddingX = 8 * options.scaleX;
    const footerPaddingY = 4 * options.scaleX;
    const footerMinHeight = options.caption.fontSizePx * 2;
    const captionFontFamily = this.getCanvasFontFamily(options.caption.fontFamily);

    if (hasFooterCaption) {
      footerLineHeight = options.caption.fontSizePx * 1.2;
      ctx.save();
      ctx.font = `${options.caption.fontSizePx}px ${captionFontFamily}, -apple-system, sans-serif`;
      footerLines = this.getWrappedTextLines(
        ctx,
        options.caption.text,
        Math.max(innerW - footerPaddingX * 2, options.caption.fontSizePx),
        2,
      );
      ctx.restore();

      footerHeight = Math.max(
        footerMinHeight,
        footerLines.length * footerLineHeight + footerPaddingY * 2,
      );
    }

    const mediaY = innerY;
    const mediaW = innerW;
    const mediaH = Math.max(0, options.frameH - framePadding.top - framePadding.bottom - inlineCaptionHeight - footerHeight);

    ctx.save();
    if (decorativeRotation !== 0) {
      ctx.rotate((decorativeRotation * Math.PI) / 180);
    }

    if (frameShadow && !frameShadow.inset) {
      ctx.save();
      ctx.shadowColor = frameShadow.color;
      ctx.shadowBlur = frameShadow.blur;
      ctx.shadowOffsetX = frameShadow.offsetX;
      ctx.shadowOffsetY = frameShadow.offsetY;
      this.drawRoundedRectPath(ctx, -options.frameW / 2, -options.frameH / 2, options.frameW, options.frameH, outerRadius);
      ctx.fillStyle = frameConfig.frameBackground === "transparent" ? "rgba(255,255,255,0.01)" : frameConfig.frameBackground;
      ctx.fill();
      ctx.restore();
    }

    if (frameConfig.frameBackground !== "transparent") {
      this.drawRoundedRectPath(ctx, -options.frameW / 2, -options.frameH / 2, options.frameW, options.frameH, outerRadius);
      ctx.fillStyle = frameConfig.frameBackground;
      ctx.fill();
    }

    if (
      options.frameStyle === "film-strip"
      && frameConfig.filmStripHeight
      && frameConfig.filmStripInset
      && frameConfig.filmStripColor
      && frameConfig.filmPerforation
    ) {
      const stripHeight = this.parseCssLengthToPx(frameConfig.filmStripHeight, {
        ...parseOptions,
        relativeTo: options.frameH,
      });
      const stripInset = this.parseCssLengthToPx(frameConfig.filmStripInset, {
        ...parseOptions,
        relativeTo: options.frameW,
      });
      const perforationMatch = frameConfig.filmPerforation.match(/rgba?\([^)]+\)/);
      const perforationColor = perforationMatch?.[0] ?? "rgba(248,250,252,0.92)";

      this.drawFilmStrip(
        ctx,
        -options.frameW / 2 + stripInset,
        -options.frameH / 2,
        Math.max(options.frameW - stripInset * 2, 0),
        stripHeight,
        frameConfig.filmStripColor,
        perforationColor,
        options.scaleX,
      );
      this.drawFilmStrip(
        ctx,
        -options.frameW / 2 + stripInset,
        options.frameH / 2 - stripHeight,
        Math.max(options.frameW - stripInset * 2, 0),
        stripHeight,
        frameConfig.filmStripColor,
        perforationColor,
        options.scaleX,
      );
    }

    if (mediaW > 0 && mediaH > 0) {
      const mediaAspect = mediaW / mediaH;
      const imageAspect = options.preloaded.aspect;
      let drawW: number;
      let drawH: number;
      let drawX: number;
      let drawY: number;

      if (options.photoStyle === "kenburns") {
        if (imageAspect > mediaAspect) {
          drawH = mediaH;
          drawW = mediaH * imageAspect;
        } else {
          drawW = mediaW;
          drawH = mediaW / imageAspect;
        }
        drawX = innerX + (mediaW - drawW) * options.focalPoint.x;
        drawY = mediaY + (mediaH - drawH) * options.focalPoint.y;
      } else {
        // Cover mode: fill the frame completely, crop overflow (matches CSS object-cover)
        if (imageAspect > mediaAspect) {
          drawH = mediaH;
          drawW = mediaH * imageAspect;
        } else {
          drawW = mediaW;
          drawH = mediaW / imageAspect;
        }
        drawX = innerX + (mediaW - drawW) * options.focalPoint.x;
        drawY = mediaY + (mediaH - drawH) * options.focalPoint.y;
      }

      ctx.save();
      this.drawRoundedRectPath(ctx, innerX, mediaY, mediaW, mediaH, mediaRadius);
      ctx.clip();

      if (options.photoStyle === "kenburns" && options.kenBurnsProgress !== null) {
        const kb = getKenBurnsTransform(options.kenBurnsProgress, options.photoIndex, options.focalPoint);
        const areaCX = innerX + mediaW / 2;
        const areaCY = mediaY + mediaH / 2;
        ctx.translate(areaCX, areaCY);
        ctx.translate((kb.translateX * mediaW) / 100, (kb.translateY * mediaH) / 100);
        ctx.scale(kb.scale, kb.scale);
        ctx.translate(-areaCX, -areaCY);
      }

      ctx.drawImage(options.preloaded.img, drawX, drawY, drawW, drawH);
      ctx.restore();

      if (frameConfig.vignetteShadow) {
        const vignetteShadow = this.parseShadow(frameConfig.vignetteShadow, {
          ...parseOptions,
          relativeTo: mediaW,
        });
        this.drawBorderlessVignette(
          ctx,
          innerX,
          mediaY,
          mediaW,
          mediaH,
          mediaRadius,
          vignetteShadow?.color ?? "rgba(0,0,0,0.06)",
        );
      }
    }

    if (hasInlineCaption && inlineCaptionHeight > 0) {
      const captionTop = mediaY + mediaH;
      ctx.save();
      ctx.font = `${inlineCaptionFontSize}px ${inlineCaptionFontFamily}, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = inlineCaptionColor;

      const textStartY =
        captionTop
        + Math.max(inlineCaptionHeight - inlineCaptionLines.length * inlineCaptionLineHeight, 0) / 2
        + inlineCaptionLineHeight / 2;

      inlineCaptionLines.forEach((line, index) => {
        ctx.fillText(
          line,
          innerX + mediaW / 2,
          textStartY + index * inlineCaptionLineHeight,
          Math.max(mediaW - inlineCaptionPadding.left - inlineCaptionPadding.right, inlineCaptionFontSize),
        );
      });
      ctx.restore();
    }

    if (hasFooterCaption && footerHeight > 0) {
      const footerY = mediaY + mediaH;
      this.drawRoundedRectPath(ctx, innerX, footerY, innerW, footerHeight, 6 * options.scaleX);
      ctx.fillStyle = DEFAULT_CAPTION_BG_COLOR;
      ctx.fill();

      ctx.save();
      ctx.font = `${options.caption.fontSizePx}px ${captionFontFamily}, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 3 * options.scaleX;

      const textStartY =
        footerY
        + Math.max(footerHeight - footerLines.length * footerLineHeight, 0) / 2
        + footerLineHeight / 2;

      footerLines.forEach((line, index) => {
        ctx.fillText(
          line,
          innerX + innerW / 2,
          textStartY + index * footerLineHeight,
          Math.max(innerW - footerPaddingX * 2, options.caption.fontSizePx),
        );
      });
      ctx.restore();
    }

    ctx.restore();
  }

  /** Draw a filled rounded rectangle */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  async export(onProgress: ProgressCallback): Promise<Blob | null> {
    const { fps } = this.settings;
    this.cancelled = false;
    this.abortController = new AbortController();
    this.photoShowStartFrame.clear();
    this.exportVisitedLocationIds.clear();
    this.visitedPinFirstFrame.clear();
    this.exportCurrentArrivalId = null;
    this.exportBreadcrumbs = [];
    this.prevExportShowPhotos = false;
    this.prevExportPhotoLocationId = null;
    this.tripStatsBarAge = 0;
    const { signal } = this.abortController;

    const engineDuration = this.engine.getTotalDuration();
    const totalDuration = engineDuration + this.getExportAlbumTailDuration();
    const totalFrames = Math.ceil(totalDuration * fps);
    const canvas = this.map.getCanvas();
    const useWebCodecs = isWebCodecsSupported();
    const useMediaRecorder = !useWebCodecs && isMediaRecorderSupported();

    const { width: targetW, height: targetH } = getExportViewportSize(
      this.settings.viewportRatio ?? "free",
      canvas.width,
      canvas.height,
      this.settings.resolution ?? "1080p",
    );

    await this.preloadIcons();
    await this.preloadPhotos();

    this.hideAllSegments();
    this.ensureBreadcrumbLayerOrder();
    // Clear breadcrumb source for fresh export
    const bcSource = this.map.getSource(BREADCRUMB_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (bcSource) {
      bcSource.setData({ type: "FeatureCollection", features: [] });
    }

    const captured = { routeDraw: null as AnimationEvent | null, progress: null as AnimationEvent | null };
    const onRouteDrawEvent = (e: AnimationEvent) => { captured.routeDraw = e; };
    const onProgressEvent = (e: AnimationEvent) => { captured.progress = e; };
    this.engine.on("routeDrawProgress", onRouteDrawEvent);
    this.engine.on("progress", onProgressEvent);

    const offscreen = document.createElement("canvas");
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) throw new Error("Failed to create offscreen 2D context");

    const scaleX = targetW / Math.max(canvas.clientWidth, 1);
    const scaleY = targetH / Math.max(canvas.clientHeight, 1);

    try {
      if (useWebCodecs) {
        try {
          return await this.exportWithWebCodecs(
            offscreen, offCtx, canvas, scaleX, scaleY,
            targetW, targetH, totalFrames, totalDuration, engineDuration, fps, onProgress, captured
          );
        } catch (webCodecsError) {
          console.warn("WebCodecs export failed, falling back:", webCodecsError);
          this.engine.seekTo(0);
          this.photoShowStartFrame.clear();
          this.hideAllSegments();
          // Try MediaRecorder before server
          if (isMediaRecorderSupported()) {
            try {
              return await this.exportWithMediaRecorder(
                offscreen, offCtx, canvas, scaleX, scaleY,
                totalFrames, totalDuration, engineDuration, fps, onProgress, captured
              );
            } catch (mrError) {
              console.warn("MediaRecorder export failed, falling back to server:", mrError);
              this.engine.seekTo(0);
              this.photoShowStartFrame.clear();
              this.hideAllSegments();
            }
          }
          return await this.exportWithServer(
            offscreen, offCtx, canvas, scaleX, scaleY,
            totalFrames, totalDuration, engineDuration, fps, signal, onProgress, captured
          );
        }
      } else if (useMediaRecorder) {
        try {
          return await this.exportWithMediaRecorder(
            offscreen, offCtx, canvas, scaleX, scaleY,
            totalFrames, totalDuration, engineDuration, fps, onProgress, captured
          );
        } catch (mrError) {
          console.warn("MediaRecorder export failed, falling back to server:", mrError);
          this.engine.seekTo(0);
          this.photoShowStartFrame.clear();
          this.hideAllSegments();
          return await this.exportWithServer(
            offscreen, offCtx, canvas, scaleX, scaleY,
            totalFrames, totalDuration, engineDuration, fps, signal, onProgress, captured
          );
        }
      } else {
        return await this.exportWithServer(
          offscreen, offCtx, canvas, scaleX, scaleY,
          totalFrames, totalDuration, engineDuration, fps, signal, onProgress, captured
        );
      }
    } finally {
      this.restoreAllSegments();
      this.engine.getIconAnimator().hide();
      // Clear export breadcrumb source so preview component can take over
      const bcSrc = this.map.getSource(BREADCRUMB_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (bcSrc) {
        bcSrc.setData({ type: "FeatureCollection", features: [] });
      }

      this.engine.off("routeDrawProgress", onRouteDrawEvent);
      this.engine.off("progress", onProgressEvent);
    }
  }

  /** Capture a single frame onto the offscreen canvas */
  private async captureFrame(
    offCtx: CanvasRenderingContext2D,
    offscreen: HTMLCanvasElement,
    canvas: HTMLCanvasElement,
    scaleX: number,
    scaleY: number,
    captured: { routeDraw: AnimationEvent | null; progress: AnimationEvent | null },
    frameIndex: number,
    fps: number,
    totalDuration: number,
    engineDuration: number,
  ): Promise<void> {
    const time = frameIndex / fps;
    const engineProgress = engineDuration > 0 ? Math.min(time / engineDuration, 1) : 1;

    captured.routeDraw = null;
    captured.progress = null;

    this.engine.seekTo(engineProgress);
    this.applyRouteDrawFromCapture(captured);

    // Update breadcrumb tracking and Mapbox source BEFORE waiting for map idle
    // so breadcrumbs are rendered on the map canvas at correct z-order
    if (captured.progress) {
      this.updateExportBreadcrumbs(captured.progress, frameIndex);
    }
    this.updateBreadcrumbMapSource(frameIndex, fps);

    await this.waitForMapIdle();

    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
    this.drawVehicleIcon(offCtx, scaleX, scaleY);
    this.drawCityLabelFromCapture(
      offCtx,
      offscreen.width,
      offscreen.height,
      scaleX,
      captured,
      this.settings.cityLabelSize ?? 18,
      this.settings.cityLabelLang ?? "en",
    );
    this.drawRouteLabel(offCtx, offscreen.width, offscreen.height, scaleX, captured, this.settings.routeLabelSize ?? 14);
    // Chapter pins: update tracking and draw BEFORE photos (pins behind photos, matching preview z-order)
    this.updateChapterPinState(captured.progress, time, totalDuration, frameIndex);
    this.drawChapterPins(offCtx, scaleX, scaleY, time, totalDuration, frameIndex, fps);

    this.drawTripStats(offCtx, offscreen.width, offscreen.height, scaleX, captured);
    this.drawPhotos(offCtx, offscreen.width, offscreen.height, scaleX, scaleY, captured, frameIndex, fps, time, totalDuration);
    this.drawSceneTransitionPhotos(offCtx, offscreen.width, offscreen.height, scaleX, scaleY, captured, frameIndex, fps);

    // Clear photo start tracking when photos stop showing so re-entry is tracked fresh
    const capturedProgress = captured.progress as AnimationEvent | null;
    if (!capturedProgress || !capturedProgress.showPhotos) {
      this.photoShowStartFrame.clear();
    }
  }

  private async exportWithWebCodecs(
    offscreen: HTMLCanvasElement,
    offCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    scaleX: number,
    scaleY: number,
    targetW: number,
    targetH: number,
    totalFrames: number,
    totalDuration: number,
    engineDuration: number,
    fps: number,
    onProgress: ProgressCallback,
    captured: { routeDraw: AnimationEvent | null; progress: AnimationEvent | null }
  ): Promise<Blob | null> {
    const webCodecsExporter = new WebCodecsExporter({
      width: targetW,
      height: targetH,
      fps,
    });

    for (let i = 0; i < totalFrames; i++) {
      if (this.cancelled) return null;

      await this.captureFrame(offCtx, offscreen, canvas, scaleX, scaleY, captured, i, fps, totalDuration, engineDuration);
      webCodecsExporter.addFrame(offscreen, i);

      onProgress({
        phase: "capturing",
        current: i + 1,
        total: totalFrames,
        encodingMethod: "webcodecs",
      });
    }

    if (this.cancelled) return null;

    onProgress({ phase: "encoding", current: 0, total: 1, encodingMethod: "webcodecs" });
    const blob = await webCodecsExporter.finalize();
    onProgress({ phase: "done", current: 1, total: 1, encodingMethod: "webcodecs" });
    return blob;
  }

  private async exportWithMediaRecorder(
    offscreen: HTMLCanvasElement,
    offCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    scaleX: number,
    scaleY: number,
    totalFrames: number,
    totalDuration: number,
    engineDuration: number,
    fps: number,
    onProgress: ProgressCallback,
    captured: { routeDraw: AnimationEvent | null; progress: AnimationEvent | null }
  ): Promise<Blob | null> {
    const mrExporter = new MediaRecorderExporter(offscreen, {
      width: offscreen.width,
      height: offscreen.height,
      fps,
    });

    mrExporter.start();

    try {
      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled) {
          mrExporter.cleanup();
          return null;
        }

        await this.captureFrame(offCtx, offscreen, canvas, scaleX, scaleY, captured, i, fps, totalDuration, engineDuration);
        await mrExporter.captureFrame();

        onProgress({
          phase: "capturing",
          current: i + 1,
          total: totalFrames,
          encodingMethod: "mediarecorder",
        });
      }

      if (this.cancelled) {
        mrExporter.cleanup();
        return null;
      }

      onProgress({ phase: "encoding", current: 0, total: 1, encodingMethod: "mediarecorder" });
      const blob = await mrExporter.finalize();
      onProgress({ phase: "done", current: 1, total: 1, encodingMethod: "mediarecorder" });
      return blob;
    } catch (e) {
      mrExporter.cleanup();
      throw e;
    }
  }

  private async exportWithServer(
    offscreen: HTMLCanvasElement,
    offCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    scaleX: number,
    scaleY: number,
    totalFrames: number,
    totalDuration: number,
    engineDuration: number,
    fps: number,
    signal: AbortSignal,
    onProgress: ProgressCallback,
    captured: { routeDraw: AnimationEvent | null; progress: AnimationEvent | null }
  ): Promise<Blob | null> {
    const startRes = await fetch("/api/encode-video/start", {
      method: "POST",
      signal,
    });
    if (!startRes.ok) {
      throw new Error("Failed to start encoding session");
    }
    const { sessionId } = (await startRes.json()) as { sessionId: string };

    for (let i = 0; i < totalFrames; i++) {
      if (this.cancelled) return null;

      await this.captureFrame(offCtx, offscreen, canvas, scaleX, scaleY, captured, i, fps, totalDuration, engineDuration);

      const blob = await new Promise<Blob>((resolve, reject) => {
        offscreen.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Frame capture failed")),
          "image/jpeg",
          0.92
        );
      });

      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("frameIndex", String(i + 1));
      formData.append(
        "frame",
        blob,
        `frame${String(i + 1).padStart(5, "0")}.jpg`
      );

      const uploadRes = await fetch("/api/encode-video/frame", {
        method: "POST",
        body: formData,
        signal,
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload frame ${i + 1}`);
      }

      onProgress({
        phase: "capturing",
        current: i + 1,
        total: totalFrames,
        encodingMethod: "server",
      });
    }

    if (this.cancelled) return null;

    onProgress({ phase: "encoding", current: 0, total: 1, encodingMethod: "server" });

    const response = await fetch("/api/encode-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, fps: String(fps) }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server encoding failed: ${text}`);
    }

    onProgress({ phase: "encoding", current: 1, total: 1, encodingMethod: "server" });

    const mp4Blob = await response.blob();
    onProgress({ phase: "done", current: 1, total: 1, encodingMethod: "server" });

    return mp4Blob;
  }

  private waitForMapIdle(): Promise<void> {
    return new Promise((resolve) => {
      this.map.triggerRepaint();

      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      // Use 'render' event for speed — fires after each repaint, much faster
      // than 'idle' which waits for all tiles/resources to settle.
      // For export, tiles are typically already cached from preview playback.
      this.map.once("render", done);

      // Short safety timeout — tiles should already be cached
      setTimeout(done, 200);
    });
  }
}
