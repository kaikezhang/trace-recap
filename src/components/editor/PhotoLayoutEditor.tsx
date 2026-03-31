"use client";

import { Fragment, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  LayoutGrid,
  LayoutTemplate,
  Hand,
  Image as ImageIcon,
  Images,
  Layers,
  Square,
  Maximize,
  GripVertical,
  Shuffle,
  BetweenHorizontalStart,
  Rows3,
  Newspaper,
  RefreshCw,
  Camera,
  ScanEye,
  Flower2,
  Film,
  Aperture,
  Type,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { PHOTO_ANIMATION_LABELS, PHOTO_EXIT_ANIMATION_LABELS, resolvePhotoStyle } from "@/lib/photoAnimation";
import { resolveSceneTransition, SCENE_TRANSITION_LABELS } from "@/lib/sceneTransition";
import { computeAutoLayout, computeTemplateLayout, computedRectsToFreeTransforms, type PhotoMeta as LayoutPhotoMeta } from "@/lib/photoLayout";
import { CAPTION_FONT_OPTIONS, DEFAULT_CAPTION_FONT_FAMILY } from "@/lib/constants";
import { useMap } from "./MapContext";
import PhotoOverlay from "./PhotoOverlay";
import FreeCanvas, { type FreeCanvasInitialGesture } from "./FreeCanvas";
import type { FreePhotoTransform, Location, LayoutTemplate as LayoutTemplateType, PhotoLayout, Photo, PhotoAnimation, PhotoStyle, SceneTransition } from "@/types";

interface PhotoLayoutEditorProps {
  location: Location;
  onClose: () => void;
}

type LayoutStyle =
  | "grid"
  | "collage"
  | "single"
  | "carousel"
  | "scatter"
  | "polaroid"
  | "overlap"
  | "diagonal"
  | "rows"
  | "magazine"
  | "full"
  | "free";
type SortablePhotoListOrientation = "horizontal" | "vertical";
type PhotoAnimationOption = PhotoAnimation | "default";

const LAYOUT_STYLES: { id: LayoutStyle; label: string; icon: typeof LayoutGrid; template: LayoutTemplateType | "auto" }[] = [
  { id: "grid", label: "Grid", icon: LayoutGrid, template: "grid" },
  { id: "collage", label: "Collage", icon: LayoutTemplate, template: "hero" },
  { id: "single", label: "Single", icon: ImageIcon, template: "auto" },
  { id: "carousel", label: "Carousel", icon: Images, template: "filmstrip" },
  { id: "scatter", label: "Scatter", icon: Shuffle, template: "scatter" },
  { id: "polaroid", label: "Polaroid", icon: Square, template: "polaroid" },
  { id: "overlap", label: "Overlap", icon: Layers, template: "overlap" },
  { id: "diagonal", label: "Diagonal", icon: BetweenHorizontalStart, template: "diagonal" },
  { id: "rows", label: "Rows", icon: Rows3, template: "rows" },
  { id: "magazine", label: "Magazine", icon: Newspaper, template: "magazine" },
  { id: "full", label: "Full", icon: Maximize, template: "full" },
  { id: "free", label: "Free", icon: Hand, template: "auto" },
];

const RANDOM_LAYOUT_TEMPLATES: LayoutTemplateType[] = ["scatter", "polaroid", "overlap"];

const PHOTO_ANIMATION_OPTIONS: PhotoAnimation[] = [
  "scale",
  "fade",
  "slide",
  "flip",
  "scatter",
  "typewriter",
  "none",
];

const PHOTO_STYLE_OPTIONS: { value: PhotoStyle; label: string; icon: typeof Camera }[] = [
  { value: "classic", label: "Classic", icon: Camera },
  { value: "kenburns", label: "Ken Burns", icon: ScanEye },
  { value: "bloom", label: "Bloom", icon: Flower2 },
  { value: "portal", label: "Portal", icon: Aperture },
];

function getOrderedPhotos(photos: Photo[], order: string[]): Photo[] {
  const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
  const ordered = order
    .map((id) => photoMap.get(id))
    .filter((photo): photo is Photo => Boolean(photo));

  for (const photo of photos) {
    if (!ordered.some((orderedPhoto) => orderedPhoto.id === photo.id)) {
      ordered.push(photo);
    }
  }

  return ordered;
}

function usePhotoDimensions(photos: Photo[]): Array<Photo & { aspect: number }> {
  const aspectCacheRef = useRef(new Map<string, number>());
  const photoKey = photos
    .map((photo) => `${photo.id}:${photo.url}:${photo.caption ?? ""}:${photo.focalPoint?.x ?? ""}:${photo.focalPoint?.y ?? ""}`)
    .join("|");
  const buildMetas = () =>
    photos.map((photo) => ({
      ...photo,
      aspect: aspectCacheRef.current.get(photo.url) ?? 4 / 3,
    }));
  const [dims, setDims] = useState<Array<Photo & { aspect: number }>>(() => buildMetas());

  useEffect(() => {
    setDims(buildMetas());
    if (photos.length === 0) {
      return;
    }

    let cancelled = false;
    photos.forEach((photo) => {
      if (aspectCacheRef.current.has(photo.url)) {
        return;
      }

      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        aspectCacheRef.current.set(photo.url, image.naturalWidth / image.naturalHeight);
        setDims(buildMetas());
      };
      image.onerror = () => {
        if (cancelled) return;
        aspectCacheRef.current.set(photo.url, 4 / 3);
        setDims(buildMetas());
      };
      image.src = photo.url;
    });

    return () => {
      cancelled = true;
    };
  }, [photoKey, photos]);

  return dims;
}

function reconcileFreeTransforms(
  photos: Photo[],
  fallbackTransforms: FreePhotoTransform[],
  currentTransforms?: FreePhotoTransform[],
): FreePhotoTransform[] {
  const fallbackMap = new Map(fallbackTransforms.map((transform) => [transform.photoId, transform]));
  const currentMap = new Map((currentTransforms ?? []).map((transform) => [transform.photoId, transform]));

  return photos.reduce<FreePhotoTransform[]>((acc, photo, index) => {
      const fallback = fallbackMap.get(photo.id);
      const current = currentMap.get(photo.id);

      if (!fallback && !current) {
        return acc;
      }

      acc.push({
        ...(fallback ?? current)!,
        ...(current ?? {}),
        photoId: photo.id,
        zIndex: current?.zIndex ?? fallback?.zIndex ?? index,
        caption: {
          ...(fallback?.caption ?? {}),
          ...(current?.caption ?? {}),
          offsetX: current?.caption?.offsetX ?? fallback?.caption?.offsetX ?? 0,
          offsetY: current?.caption?.offsetY ?? fallback?.caption?.offsetY ?? ((fallback?.height ?? current?.height ?? 0) / 2 + 0.04),
          rotation: current?.caption?.rotation ?? fallback?.caption?.rotation ?? 0,
        },
      });
      return acc;
    }, []);
}

function PhotoThumbnail({
  photo,
  index,
  selected,
  orientation,
  overlay = false,
  dragHandleProps,
  onDelete,
}: {
  photo: Photo;
  index: number;
  selected: boolean;
  orientation: SortablePhotoListOrientation;
  overlay?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onDelete?: (photoId: string) => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-lg bg-white ${
        orientation === "vertical" ? "w-full aspect-square" : "h-[60px] w-[60px] shrink-0"
      } ${
        selected
          ? "ring-2 ring-indigo-500 ring-offset-2"
          : "ring-1 ring-transparent hover:ring-gray-300 hover:ring-offset-1"
      } ${overlay ? "scale-105 shadow-2xl" : ""}`}
    >
      <img
        src={photo.url}
        alt={`Photo ${index + 1} thumbnail`}
        className="h-full w-full object-cover"
        style={{ objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%` }}
      />
      <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center justify-between rounded-md bg-black/45 px-1.5 py-1 text-white backdrop-blur-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{index + 1}</span>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
              className="pointer-events-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500/80 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
              aria-label={`Delete photo ${index + 1}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          <div
            data-drag-handle
            className={`${dragHandleProps ? "pointer-events-auto cursor-grab active:cursor-grabbing touch-none" : ""}`}
            {...dragHandleProps}
          >
            <GripVertical className="h-3.5 w-3.5 opacity-80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SortablePhotoThumbnail({
  photo,
  index,
  selected,
  orientation,
  onSelect,
  onDelete,
}: {
  photo: Photo;
  index: number;
  selected: boolean;
  orientation: SortablePhotoListOrientation;
  onSelect: () => void;
  onDelete?: (photoId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      aria-label={`Select photo ${index + 1}${selected ? " (selected)" : ""}`}
      className={`text-left transition-[box-shadow,opacity] cursor-pointer ${
        isDragging ? "opacity-35" : ""
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <PhotoThumbnail
        photo={photo}
        index={index}
        selected={selected}
        orientation={orientation}
        dragHandleProps={{ ...attributes, ...listeners }}
        onDelete={onDelete}
      />
    </div>
  );
}

/* ── Map-backed preview container ── */

function PreviewWithMapBackground({
  mapSnapshot,
  previewContainerStyle,
  children,
}: {
  mapSnapshot: string | null;
  previewContainerStyle: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative"
      style={previewContainerStyle}
    >
      {/* Background layer with rounded corners and clipping */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{
          backgroundImage: mapSnapshot ? `url(${mapSnapshot})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: mapSnapshot ? undefined : "rgba(0,0,0,0.3)",
        }}
      />
      {children}
    </div>
  );
}

function AnimationSelectorSection({
  title,
  selectedAnimation,
  options,
  defaultAnimationLabel,
  onSelect,
}: {
  title: string;
  selectedAnimation: PhotoAnimationOption;
  options: ReadonlyArray<{ value: PhotoAnimationOption; label: string }>;
  defaultAnimationLabel: string;
  onSelect: (animation: PhotoAnimationOption) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
          {title}
        </p>
        <p className="mt-1 text-xs text-gray-500">Default uses {defaultAnimationLabel}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label }) => {
          const isActive = selectedAnimation === value;

          return (
            <button
              key={`${title}-${value}`}
              type="button"
              onClick={() => onSelect(value)}
              aria-pressed={isActive}
              className={`h-10 min-w-[64px] rounded-xl border px-3 text-sm font-medium transition active:scale-95 ${
                isActive
                  ? "border-indigo-500 bg-indigo-500 text-white ring-2 ring-indigo-200"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PhotoLayoutEditor({ location, onClose }: PhotoLayoutEditorProps) {
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const defaultPhotoAnimation = useUIStore((s) => s.photoAnimation);
  const defaultPhotoStyle = useUIStore((s) => s.photoStyle);
  const globalSceneTransition = useUIStore((s) => s.sceneTransition);
  const moodColorsEnabled = useUIStore((s) => s.moodColorsEnabled);
  const setGlobalSceneTransition = useUIStore((s) => s.setSceneTransition);
  const setPhotoLayout = useProjectStore((s) => s.setPhotoLayout);
  const removePhoto = useProjectStore((s) => s.removePhoto);
  const segments = useProjectStore((s) => s.segments);
  const segmentColors = useProjectStore((s) => s.segmentColors);
  const { map } = useMap();
  const layout = location.photoLayout ?? { mode: "auto" as const };

  const handleDeletePhoto = useCallback(
    (photoId: string) => {
      removePhoto(location.id, photoId);
      if (layout.order || layout.freeTransforms) {
        const newOrder = layout.order?.filter((id) => id !== photoId);
        const nextFreeTransforms = layout.freeTransforms?.filter((transform) => transform.photoId !== photoId);
        setPhotoLayout(location.id, {
          ...layout,
          ...(newOrder ? { order: newOrder } : {}),
          ...(nextFreeTransforms ? { freeTransforms: nextFreeTransforms } : {}),
        });
      }
    },
    [location.id, layout, removePhoto, setPhotoLayout]
  );

  const activeTemplate: LayoutTemplateType | "auto" =
    layout.mode === "manual" && layout.template ? layout.template : "auto";
  const photoOrder = layout.order ?? location.photos.map((p) => p.id);

  // Capture map snapshot once when editor opens (wait for full render)
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    const capture = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          setMapSnapshot(map.getCanvas().toDataURL("image/jpeg", 0.8));
        } catch {
          // Canvas tainted or not ready — fall back to dark background
        }
      });
    };

    if (map.isStyleLoaded() && map.loaded()) {
      // Map is already fully rendered — capture immediately
      capture();
    } else {
      // Map is still loading or rendering — capture once it settles
      map.once("idle", capture);
    }

    return () => {
      cancelled = true;
    };
  }, [map]);

  // Measure whichever preview panel is visible (mobile or desktop)
  const mobilePreviewRef = useRef<HTMLDivElement>(null);
  const desktopPreviewRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Only observe the container that matches the current viewport
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const target = isDesktop ? desktopPreviewRef.current : mobilePreviewRef.current;
    if (!target) return;

    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextWidth = Math.round(entry.contentRect.width);
        const nextHeight = Math.round(entry.contentRect.height);
        if (nextWidth > 0 && nextHeight > 0) {
          setPanelSize((current) =>
            current && current.width === nextWidth && current.height === nextHeight
              ? current
              : { width: nextWidth, height: nextHeight },
          );
        }
      }
    });
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  // Compute numeric aspect ratio from viewport ratio setting
  // For "free", use the actual map canvas aspect ratio so the preview matches
  const previewAspect = useMemo(() => {
    if (viewportRatio === "free") {
      if (map) {
        const canvas = map.getCanvas();
        if (canvas.width > 0 && canvas.height > 0) {
          return canvas.width / canvas.height;
        }
      }
      // Fallback to panel size if map not available
      if (panelSize && panelSize.width > 0 && panelSize.height > 0) {
        return panelSize.width / panelSize.height;
      }
      return 16 / 9; // last resort fallback
    }
    const [w, h] = viewportRatio.split(":").map(Number);
    return w / h;
  }, [viewportRatio, panelSize, map]);

  const previewPixelSize = useMemo(() => {
    if (!panelSize) {
      return { width: 0, height: 0 };
    }

    if (expanded) {
      return { width: panelSize.width, height: panelSize.height };
    }

    if (viewportRatio === "free" || !panelSize) {
      return { width: panelSize.width, height: panelSize.height };
    }

    const { width: pw, height: ph } = panelSize;
    const targetRatio = previewAspect;
    const panelRatio = pw / ph;

    let w: number, h: number;
    if (targetRatio > panelRatio) {
      w = pw;
      h = pw / targetRatio;
    } else {
      h = ph;
      w = ph * targetRatio;
    }
    return { width: w, height: h };
  }, [expanded, panelSize, previewAspect, viewportRatio]);

  // Compute fitted preview container style — always preserve aspect ratio for WYSIWYG
  const previewContainerStyle = useMemo<React.CSSProperties>(() => {
    if (viewportRatio === "free") {
      return { width: "100%", height: "100%" };
    }

    const pw = previewPixelSize.width;
    const ph = previewPixelSize.height;
    if (!pw || !ph) {
      return { width: "100%", height: "100%" };
    }

    // Fit the target aspect ratio within the available panel, whether expanded or not
    const targetRatio = previewAspect;
    const panelRatio = pw / ph;

    let w: number, h: number;
    if (targetRatio > panelRatio) {
      w = pw;
      h = pw / targetRatio;
    } else {
      h = ph;
      w = ph * targetRatio;
    }
    return { width: `${w}px`, height: `${h}px` };
  }, [previewAspect, previewPixelSize.height, previewPixelSize.width, viewportRatio]);

  const orderedPhotos = useMemo(
    () => getOrderedPhotos(location.photos, photoOrder),
    [location.photos, photoOrder]
  );
  const orderedPhotoMetas = usePhotoDimensions(orderedPhotos);
  const layoutMetas = useMemo<LayoutPhotoMeta[]>(
    () => orderedPhotoMetas.map((photo) => ({ id: photo.id, aspect: photo.aspect })),
    [orderedPhotoMetas],
  );
  const computedRects = useMemo(() => {
    if (!previewPixelSize.width || !previewPixelSize.height || layoutMetas.length === 0) {
      return [];
    }

    const containerAspect = previewPixelSize.width / previewPixelSize.height;
    const width = previewPixelSize.width;
    const gapPx = layout.gap ?? 8;

    if (layout.mode === "manual" && layout.template) {
      return computeTemplateLayout(
        layoutMetas,
        containerAspect,
        layout.template,
        gapPx,
        width,
        layout.customProportions,
        layout.layoutSeed,
      );
    }

    return computeAutoLayout(layoutMetas, containerAspect, gapPx, width);
  }, [
    layout.customProportions,
    layout.gap,
    layout.layoutSeed,
    layout.mode,
    layout.template,
    layoutMetas,
    previewPixelSize.height,
    previewPixelSize.width,
  ]);
  const fallbackFreeTransforms = useMemo(
    () => computedRectsToFreeTransforms(orderedPhotos, computedRects, {
      containerWidthPx: previewPixelSize.width,
      containerHeightPx: previewPixelSize.height,
      captionFontSizePx: layout.captionFontSize ?? 14,
    }),
    [computedRects, layout.captionFontSize, orderedPhotos, previewPixelSize.height, previewPixelSize.width],
  );
  const effectiveFreeTransforms = useMemo(
    () => reconcileFreeTransforms(orderedPhotos, fallbackFreeTransforms, layout.freeTransforms),
    [fallbackFreeTransforms, layout.freeTransforms, orderedPhotos],
  );
  const orderedPhotoIds = useMemo(
    () => orderedPhotos.map((photo) => photo.id),
    [orderedPhotos]
  );
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>(() => orderedPhotoIds[0] ?? "");
  const [activeDragPhotoId, setActiveDragPhotoId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewOpacity, setPreviewOpacity] = useState(1);
  const [initialFreeGesture, setInitialFreeGesture] = useState<FreeCanvasInitialGesture | null>(null);
  const exitPreviewTimeoutRef = useRef<number | null>(null);
  const exitPreviewFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (orderedPhotoIds.length === 0) {
      setSelectedPhotoId("");
      return;
    }

    setSelectedPhotoId((current) =>
      current && orderedPhotoIds.includes(current) ? current : orderedPhotoIds[0]
    );
  }, [orderedPhotoIds]);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const activeStyle: LayoutStyle = (() => {
    if (layout.mode === "free") return "free";
    if (activeTemplate === "grid") return "grid";
    if (activeTemplate === "hero") return "collage";
    if (activeTemplate === "filmstrip") return "carousel";
    if (activeTemplate === "scatter") return "scatter";
    if (activeTemplate === "polaroid") return "polaroid";
    if (activeTemplate === "overlap") return "overlap";
    if (activeTemplate === "diagonal") return "diagonal";
    if (activeTemplate === "rows") return "rows";
    if (activeTemplate === "magazine") return "magazine";
    if (activeTemplate === "full") return "full";
    return "single";
  })();
  const isRandomLayoutActive = activeTemplate !== "auto" && RANDOM_LAYOUT_TEMPLATES.includes(activeTemplate) && location.photos.length > 1;
  const selectedEnterAnimation: PhotoAnimationOption = layout.enterAnimation ?? "default";
  const selectedExitAnimation: PhotoAnimationOption = layout.exitAnimation ?? "default";
  const activePhotoStyle: PhotoStyle = resolvePhotoStyle(layout, defaultPhotoStyle);
  const activeSceneTransition: SceneTransition = resolveSceneTransition(layout, globalSceneTransition);
  type SceneTransitionOption = SceneTransition | "default";
  const selectedSceneTransition: SceneTransitionOption = layout.sceneTransition ?? "default";
  const portalAccentColor = useMemo(() => {
    if (!moodColorsEnabled) return "#ffffff";
    const segmentIndex = segments.findIndex((segment) => segment.toId === location.id);
    return segmentIndex >= 0 ? segmentColors[segmentIndex] ?? "#ffffff" : "#ffffff";
  }, [location.id, moodColorsEnabled, segmentColors, segments]);

  const sceneTransitionOptions = useMemo(
    () => [
      { value: "default" as SceneTransitionOption, label: `Default (${SCENE_TRANSITION_LABELS[globalSceneTransition]})` },
      ...([
        "cut",
        "dissolve",
        "blur-dissolve",
        "wipe",
      ] as const).map((value) => ({
        value: value as SceneTransitionOption,
        label: SCENE_TRANSITION_LABELS[value],
      })),
    ],
    [globalSceneTransition]
  );

  const enterAnimationOptions = useMemo(
    () => [
      { value: "default" as const, label: "Default" },
      ...PHOTO_ANIMATION_OPTIONS.map((value) => ({
        value,
        label: PHOTO_ANIMATION_LABELS[value],
      })),
    ],
    []
  );

  const exitAnimationOptions = useMemo(
    () => [
      { value: "default" as const, label: "Default" },
      ...PHOTO_ANIMATION_OPTIONS.map((value) => ({
        value,
        label: PHOTO_EXIT_ANIMATION_LABELS[value],
      })),
    ],
    []
  );

  const clearExitPreview = useCallback(() => {
    if (exitPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(exitPreviewFrameRef.current);
      exitPreviewFrameRef.current = null;
    }
    if (exitPreviewTimeoutRef.current !== null) {
      window.clearTimeout(exitPreviewTimeoutRef.current);
      exitPreviewTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearExitPreview, [clearExitPreview]);

  const updateLayout = useCallback(
    (updates: Partial<PhotoLayout>) => {
      const current: PhotoLayout = location.photoLayout ?? { mode: "auto" };
      setPhotoLayout(location.id, { ...current, ...updates });
    },
    [location.id, location.photoLayout, setPhotoLayout]
  );

  const handleStyleSelect = useCallback(
    (style: LayoutStyle) => {
      const config = LAYOUT_STYLES.find((s) => s.id === style);
      if (!config) return;
      if (style === "free") {
        updateLayout({ mode: "free", freeTransforms: effectiveFreeTransforms });
        return;
      }
      if (config.template === "auto") {
        updateLayout({ mode: "auto", template: undefined, customProportions: undefined, freeTransforms: undefined });
      } else {
        updateLayout({
          mode: "manual",
          template: config.template,
          customProportions: undefined,
          freeTransforms: undefined,
          layoutSeed: RANDOM_LAYOUT_TEMPLATES.includes(config.template)
            ? (layout.layoutSeed ?? Math.random())
            : layout.layoutSeed,
        });
      }
    },
    [effectiveFreeTransforms, layout.layoutSeed, updateLayout]
  );

  const refreshRandomLayout = useCallback(() => {
    if (!isRandomLayoutActive) return;
    updateLayout({ layoutSeed: Math.random() });
  }, [isRandomLayoutActive, updateLayout]);

  const replayEnterPreview = useCallback(() => {
    clearExitPreview();
    setPreviewOpacity(1);
    setPreviewKey((key) => key + 1);
  }, [clearExitPreview]);

  const replayExitPreview = useCallback(() => {
    clearExitPreview();
    setPreviewOpacity(1);
    // Brief delay to ensure photos are visible, then trigger exit
    exitPreviewFrameRef.current = window.requestAnimationFrame(() => {
      setPreviewOpacity(0); // triggers exit animation
      // After exit completes (~800ms) + 1 second pause, bring photos back
      exitPreviewTimeoutRef.current = window.setTimeout(() => {
        setPreviewOpacity(1);
        setPreviewKey((key) => key + 1); // remount to replay enter
        exitPreviewTimeoutRef.current = null;
      }, 1800); // ~800ms exit animation + 1000ms pause
      exitPreviewFrameRef.current = null;
    });
  }, [clearExitPreview]);

  const handleEnterAnimationSelect = useCallback(
    (animation: PhotoAnimationOption) => {
      updateLayout({ enterAnimation: animation === "default" ? undefined : animation });
      replayEnterPreview();
    },
    [replayEnterPreview, updateLayout]
  );

  const handlePhotoStyleSelect = useCallback(
    (style: PhotoStyle) => {
      updateLayout({ photoStyle: style });
      replayEnterPreview();
    },
    [replayEnterPreview, updateLayout]
  );

  const handleExitAnimationSelect = useCallback(
    (animation: PhotoAnimationOption) => {
      updateLayout({ exitAnimation: animation === "default" ? undefined : animation });
      replayExitPreview();
    },
    [replayExitPreview, updateLayout]
  );

  const handleSceneTransitionSelect = useCallback(
    (transition: SceneTransitionOption) => {
      updateLayout({ sceneTransition: transition === "default" ? undefined : transition });
    },
    [updateLayout]
  );

  const handleFreeTransformsChange = useCallback(
    (nextTransforms: FreePhotoTransform[]) => {
      updateLayout({
        mode: "free",
        freeTransforms: reconcileFreeTransforms(orderedPhotos, fallbackFreeTransforms, nextTransforms),
      });
    },
    [fallbackFreeTransforms, orderedPhotos, updateLayout],
  );

  const handleFreeGestureStart = useCallback(
    (gesture: FreeCanvasInitialGesture) => {
      setInitialFreeGesture(gesture);
      if (layout.mode !== "free") {
        updateLayout({
          mode: "free",
          freeTransforms: effectiveFreeTransforms,
        });
      }
    },
    [effectiveFreeTransforms, layout.mode, updateLayout],
  );

  const handleGlobalSceneTransitionSelect = useCallback(
    (transition: SceneTransition) => {
      setGlobalSceneTransition(transition);
    },
    [setGlobalSceneTransition]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragPhotoId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragPhotoId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragPhotoId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = orderedPhotoIds.indexOf(String(active.id));
      const newIndex = orderedPhotoIds.indexOf(String(over.id));

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      updateLayout({ order: arrayMove(orderedPhotoIds, oldIndex, newIndex) });
    },
    [orderedPhotoIds, updateLayout]
  );

  if (location.photos.length === 0) return null;

  const activeDragPhoto = activeDragPhotoId
    ? orderedPhotos.find((photo) => photo.id === activeDragPhotoId) ?? null
    : null;
  const activeDragPhotoIndex = activeDragPhoto
    ? orderedPhotos.findIndex((photo) => photo.id === activeDragPhoto.id)
    : 0;
  const borderRadius = layout.borderRadius ?? 8;

  const layoutPreviewNode = (
    layout.mode === "free" ? (
      <FreeCanvas
        photos={orderedPhotos}
        transforms={effectiveFreeTransforms}
        containerSize={{ w: previewPixelSize.width, h: previewPixelSize.height }}
        mapSnapshot={mapSnapshot}
        borderRadius={borderRadius}
        defaultCaptionFontFamily={layout.captionFontFamily ?? DEFAULT_CAPTION_FONT_FAMILY}
        defaultCaptionFontSize={layout.captionFontSize ?? 14}
        onTransformsChange={handleFreeTransformsChange}
        initialGesture={initialFreeGesture}
        onInitialGestureHandled={() => setInitialFreeGesture(null)}
      />
    ) : (
      <>
        <PhotoOverlay
          key={previewKey}
          photos={orderedPhotos}
          visible={true}
          photoLayout={layout}
          opacity={previewOpacity}
          containerMode="parent"
          originCoordinates={location.coordinates}
          portalAccentColor={portalAccentColor}
          portalProgressOverride={1}
        />
        <div className="absolute inset-0 z-30">
          {effectiveFreeTransforms.map((transform) => {
            const photo = orderedPhotos.find((item) => item.id === transform.photoId);
            if (!photo) {
              return null;
            }

            const captionText = transform.caption?.text ?? photo.caption ?? "";
            const captionCenterX = transform.x + transform.width / 2 + (transform.caption?.offsetX ?? 0);
            const captionCenterY = transform.y + transform.height / 2 + (transform.caption?.offsetY ?? transform.height / 2 + 0.04);

            return (
              <Fragment key={`free-hit-${photo.id}`}>
                <button
                  type="button"
                  className="absolute touch-none cursor-grab rounded-[inherit] bg-transparent active:cursor-grabbing"
                  style={{
                    left: `${transform.x * 100}%`,
                    top: `${transform.y * 100}%`,
                    width: `${transform.width * 100}%`,
                    height: `${transform.height * 100}%`,
                    transform: `rotate(${transform.rotation}deg)`,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    handleFreeGestureStart({
                      target: "photo",
                      photoId: photo.id,
                      clientX: event.clientX,
                      clientY: event.clientY,
                    });
                  }}
                  aria-label={`Drag ${photo.caption || "photo"} into free mode`}
                />
                {captionText ? (
                  <button
                    type="button"
                    className="absolute h-10 min-w-24 -translate-x-1/2 -translate-y-1/2 bg-transparent"
                    style={{
                      left: `${captionCenterX * 100}%`,
                      top: `${captionCenterY * 100}%`,
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      handleFreeGestureStart({
                        target: "caption",
                        photoId: photo.id,
                        clientX: event.clientX,
                        clientY: event.clientY,
                      });
                    }}
                    aria-label={`Move caption for ${photo.caption || "photo"} into free mode`}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </>
    )
  );

  // Portal to body to escape overflow-hidden ancestors (MapStage container)
  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        {/* ── Mobile layout ── */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="md:hidden bg-white flex flex-col w-full h-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{location.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {location.photos.length} photo{location.photos.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close photo layout editor" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Preview area — takes up remaining space above controls */}
          <div ref={mobilePreviewRef} className="flex-1 min-h-0 flex items-center justify-center p-4 bg-gray-950/5">
            <PreviewWithMapBackground mapSnapshot={mapSnapshot} previewContainerStyle={previewContainerStyle}>
              {layoutPreviewNode}
            </PreviewWithMapBackground>
          </div>

          {/* Bottom controls */}
          <div className="max-h-[50vh] shrink-0 border-t border-gray-100 bg-white flex min-h-0 flex-col">
            <div className="min-h-0 overflow-y-auto">
              <div className="flex items-center justify-between gap-3 px-4 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Layout</p>
                {isRandomLayoutActive ? (
                  <button
                    type="button"
                    onClick={refreshRandomLayout}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
                    aria-label="Refresh random layout"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Layout style selector — horizontal pills */}
              <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto">
                {LAYOUT_STYLES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleStyleSelect(id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                      activeStyle === id
                        ? "bg-indigo-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-100 px-4 py-3">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
                      Photo Style
                    </p>
                    <div className="flex gap-2">
                      {PHOTO_STYLE_OPTIONS.map(({ value, label, icon: Icon }) => {
                        const isActive = activePhotoStyle === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handlePhotoStyleSelect(value)}
                            aria-pressed={isActive}
                            className={`flex items-center gap-1.5 h-10 rounded-xl border px-3 text-sm font-medium transition active:scale-95 ${
                              isActive
                                ? "border-indigo-500 bg-indigo-500 text-white ring-2 ring-indigo-200"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <AnimationSelectorSection
                    title="In Animation"
                    selectedAnimation={selectedEnterAnimation}
                    options={enterAnimationOptions}
                    defaultAnimationLabel={PHOTO_ANIMATION_LABELS[defaultPhotoAnimation]}
                    onSelect={handleEnterAnimationSelect}
                  />
                  <AnimationSelectorSection
                    title="Out Animation"
                    selectedAnimation={selectedExitAnimation}
                    options={exitAnimationOptions}
                    defaultAnimationLabel={PHOTO_EXIT_ANIMATION_LABELS[defaultPhotoAnimation]}
                    onSelect={handleExitAnimationSelect}
                  />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Film className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
                        Scene Transition
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sceneTransitionOptions.map(({ value, label }) => {
                        const isActive = selectedSceneTransition === value;
                        return (
                          <button
                            key={`scene-transition-mobile-${value}`}
                            type="button"
                            onClick={() => handleSceneTransitionSelect(value)}
                            aria-pressed={isActive}
                            className={`h-10 min-w-[64px] rounded-xl border px-3 text-sm font-medium transition active:scale-95 ${
                              isActive
                                ? "border-indigo-500 bg-indigo-500 text-white ring-2 ring-indigo-200"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo thumbnails — horizontal scroll */}
              <div className="px-4 pb-3 overflow-x-auto">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragCancel={handleDragCancel}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={orderedPhotoIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex gap-2">
                      {orderedPhotos.map((photo, i) => (
                        <SortablePhotoThumbnail
                          key={photo.id}
                          photo={photo}
                          index={i}
                          selected={selectedPhotoId === photo.id}
                          orientation="horizontal"
                          onSelect={() => setSelectedPhotoId(photo.id)}
                          onDelete={handleDeletePhoto}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeDragPhoto ? (
                      <PhotoThumbnail
                        photo={activeDragPhoto}
                        index={activeDragPhotoIndex}
                        selected={selectedPhotoId === activeDragPhoto.id}
                        orientation="horizontal"
                        overlay
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">Changes are applied automatically</p>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Desktop layout ── */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`hidden md:flex flex-col bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden transition-all duration-300 ${
            expanded ? "max-w-[95vw] h-[95vh]" : "max-w-4xl max-h-[85vh]"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {!expanded ? (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{location.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {location.photos.length} photo{location.photos.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded(true)}
                  aria-label="Expand editor"
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Maximize2 className="h-5 w-5 text-gray-500" />
                </button>
                <button onClick={onClose} aria-label="Close photo layout editor" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
          ) : null}

          {/* 3-column body */}
          <div className="flex flex-1 min-h-0">
            {/* LEFT — Layout style selector */}
            <div className={`w-72 min-h-0 overflow-y-auto border-r border-gray-100 p-4 space-y-2 transition-all duration-300 ${expanded ? "hidden" : ""}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Layout</p>
                {isRandomLayoutActive ? (
                  <button
                    type="button"
                    onClick={refreshRandomLayout}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
                    aria-label="Refresh random layout"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {LAYOUT_STYLES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleStyleSelect(id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeStyle === id
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                      : "text-gray-600 hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}

              <div className="space-y-5 pt-4">
                <div className="space-y-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
                    Photo Style
                  </p>
                  <div className="flex gap-2">
                    {PHOTO_STYLE_OPTIONS.map(({ value, label, icon: Icon }) => {
                      const isActive = activePhotoStyle === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handlePhotoStyleSelect(value)}
                          aria-pressed={isActive}
                          className={`flex items-center gap-1.5 h-10 rounded-xl border px-3 text-sm font-medium transition active:scale-95 ${
                            isActive
                              ? "border-indigo-500 bg-indigo-500 text-white ring-2 ring-indigo-200"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <AnimationSelectorSection
                  title="In Animation"
                  selectedAnimation={selectedEnterAnimation}
                  options={enterAnimationOptions}
                  defaultAnimationLabel={PHOTO_ANIMATION_LABELS[defaultPhotoAnimation]}
                  onSelect={handleEnterAnimationSelect}
                />
                <AnimationSelectorSection
                  title="Out Animation"
                  selectedAnimation={selectedExitAnimation}
                  options={exitAnimationOptions}
                  defaultAnimationLabel={PHOTO_EXIT_ANIMATION_LABELS[defaultPhotoAnimation]}
                  onSelect={handleExitAnimationSelect}
                />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Type className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
                      Caption Style
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-14 shrink-0">Font</label>
                      <select
                        className="flex-1 h-7 text-xs rounded-md border border-gray-200 bg-white px-2 focus:border-indigo-400 focus:outline-none"
                        style={{ fontFamily: layout.captionFontFamily ?? DEFAULT_CAPTION_FONT_FAMILY }}
                        value={layout.captionFontFamily ?? DEFAULT_CAPTION_FONT_FAMILY}
                        onChange={(e) => updateLayout({ captionFontFamily: e.target.value })}
                      >
                        {CAPTION_FONT_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            style={{ fontFamily: option.value }}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-14 shrink-0">Size</label>
                      <input
                        type="range"
                        min={10}
                        max={24}
                        step={1}
                        value={layout.captionFontSize ?? 14}
                        onChange={(e) => updateLayout({ captionFontSize: Number(e.target.value) })}
                        className="flex-1 h-1 accent-indigo-500"
                      />
                      <span className="text-[10px] text-gray-400 w-8 text-right">{layout.captionFontSize ?? 14}px</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Film className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
                      Scene Transition
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sceneTransitionOptions.map(({ value, label }) => {
                      const isActive = selectedSceneTransition === value;
                      return (
                        <button
                          key={`scene-transition-desktop-${value}`}
                          type="button"
                          onClick={() => handleSceneTransitionSelect(value)}
                          aria-pressed={isActive}
                          className={`h-10 min-w-[64px] rounded-xl border px-3 text-sm font-medium transition active:scale-95 ${
                            isActive
                              ? "border-indigo-500 bg-indigo-500 text-white ring-2 ring-indigo-200"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER — Live preview with map background */}
            <div ref={desktopPreviewRef} className={`relative flex-1 bg-gray-100 flex items-center justify-center ${expanded ? "p-2" : "p-6"}`}>
              {expanded ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label="Minimize editor"
                  className="absolute right-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/70 text-gray-700 shadow-lg backdrop-blur-sm transition hover:bg-white/85"
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              ) : null}
              <PreviewWithMapBackground mapSnapshot={mapSnapshot} previewContainerStyle={previewContainerStyle}>
                {layoutPreviewNode}
              </PreviewWithMapBackground>
            </div>

            {/* RIGHT — Photo thumbnail list */}
            <div className={`w-48 border-l border-gray-100 flex flex-col transition-all duration-300 ${expanded ? "hidden" : ""}`}>
              <div className="p-4 pb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Photos</p>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedPhotoIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-2">
                    {orderedPhotos.map((photo, i) => (
                      <SortablePhotoThumbnail
                        key={photo.id}
                        photo={photo}
                        index={i}
                        selected={selectedPhotoId === photo.id}
                        orientation="vertical"
                        onSelect={() => setSelectedPhotoId(photo.id)}
                        onDelete={handleDeletePhoto}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragPhoto ? (
                    <PhotoThumbnail
                      photo={activeDragPhoto}
                      index={activeDragPhotoIndex}
                      selected={selectedPhotoId === activeDragPhoto.id}
                      orientation="vertical"
                      overlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>

          {!expanded ? (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">Changes are applied automatically</p>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Done
              </button>
            </div>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
