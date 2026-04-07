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
  Film,
  Aperture,
  Type,
  ChevronDown,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useHistoryStore } from "@/stores/historyStore";
import {
  PHOTO_ANIMATION_LABELS,
  PHOTO_EXIT_ANIMATION_LABELS,
  resolvePhotoStyle,
} from "@/lib/photoAnimation";
import { SCENE_TRANSITION_LABELS } from "@/lib/sceneTransition";
import { computePhotoLayout, computedRectsToFreeTransforms, type PhotoMeta as LayoutPhotoMeta } from "@/lib/photoLayout";
import { CAPTION_FONT_OPTIONS, DEFAULT_CAPTION_FONT_FAMILY } from "@/lib/constants";
import { getPhotoFrameRotation } from "@/lib/frameStyles";
import { useMap } from "./MapContext";
import PhotoOverlay from "./PhotoOverlay";
import FreeCanvas, { type FreeCanvasInitialGesture } from "./FreeCanvas";
import type { FreePhotoTransform, Location, LayoutTemplate as LayoutTemplateType, PhotoLayout, Photo, PhotoAnimation, PhotoFrameStyle, PhotoStyle, SceneTransition } from "@/types";

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
  | "overlap"
  | "diagonal"
  | "rows"
  | "magazine"
  | "full"
  | "free";
type SortablePhotoListOrientation = "horizontal" | "vertical";
type PhotoAnimationOption = PhotoAnimation | "default";
type SceneTransitionOption = SceneTransition | "default";

const LAYOUT_STYLES: { id: LayoutStyle; label: string; icon: typeof LayoutGrid; template: LayoutTemplateType | "auto" }[] = [
  { id: "grid", label: "Grid", icon: LayoutGrid, template: "grid" },
  { id: "collage", label: "Collage", icon: LayoutTemplate, template: "collage" },
  { id: "single", label: "Single", icon: ImageIcon, template: "single" },
  { id: "carousel", label: "Carousel", icon: Images, template: "filmstrip" },
  { id: "scatter", label: "Scatter", icon: Shuffle, template: "scatter" },
  { id: "overlap", label: "Overlap", icon: Layers, template: "overlap" },
  { id: "diagonal", label: "Diagonal", icon: BetweenHorizontalStart, template: "diagonal" },
  { id: "rows", label: "Rows", icon: Rows3, template: "rows" },
  { id: "magazine", label: "Magazine", icon: Newspaper, template: "magazine" },
  { id: "full", label: "Full", icon: Maximize, template: "full" },
  { id: "free", label: "Free", icon: Hand, template: "auto" },
];

const RANDOM_LAYOUT_TEMPLATES: LayoutTemplateType[] = ["scatter", "overlap"];

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
  { value: "portal", label: "Portal", icon: Aperture },
];

const PHOTO_FRAME_STYLE_OPTIONS: { value: PhotoFrameStyle; label: string; icon: typeof Camera }[] = [
  { value: "polaroid", label: "Polaroid", icon: Square },
  { value: "borderless", label: "Borderless", icon: ImageIcon },
  { value: "film-strip", label: "Film Strip", icon: Film },
  { value: "classic-border", label: "Classic Border", icon: Camera },
  { value: "rounded-card", label: "Rounded Card", icon: Layers },
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

  // eslint-disable-next-line react-hooks/exhaustive-deps -- photoKey is a stable string derived from photos; using photos directly causes infinite re-renders
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
  }, [photoKey]);

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
        orientation === "vertical" ? "w-full" : "h-[60px] w-[60px] shrink-0"
      } ${
        selected
          ? "ring-2 ring-indigo-500 ring-offset-2"
          : "ring-1 ring-transparent hover:ring-gray-300 hover:ring-offset-1"
      } ${overlay ? "scale-105 shadow-2xl" : ""}`}
    >
      <img
        src={photo.url}
        alt={`Photo ${index + 1} thumbnail`}
        className={
          orientation === "vertical"
            ? "min-h-[60px] max-h-[200px] h-auto w-full object-cover"
            : "h-full w-full object-cover"
        }
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
  previewContentStyle,
  children,
}: {
  mapSnapshot: string | null;
  previewContainerStyle: React.CSSProperties;
  previewContentStyle: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={previewContainerStyle}
    >
      <div
        className="absolute left-0 top-0"
        style={previewContentStyle}
      >
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

function SettingsGroup({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/70"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        {children}
      </div>
    </details>
  );
}

function LayoutStyleSelectorSection({
  variant,
  activeStyle,
  isRandomLayoutActive,
  onSelect,
  onRefresh,
}: {
  variant: "mobile" | "desktop";
  activeStyle: LayoutStyle;
  isRandomLayoutActive: boolean;
  onSelect: (style: LayoutStyle) => void;
  onRefresh: () => void;
}) {
  const isMobile = variant === "mobile";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
          Template
        </p>
        {isRandomLayoutActive ? (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
            aria-label="Refresh random layout"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isMobile ? (
        <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-4 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-4 bg-gradient-to-l from-white to-transparent" />
        <div className="flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LAYOUT_STYLES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
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
        </div>
      ) : (
        <div className="space-y-2">
          {LAYOUT_STYLES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                activeStyle === id
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                  : "border-transparent text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoStyleSelectorSection({
  selectedStyle,
  onSelect,
}: {
  selectedStyle: PhotoStyle;
  onSelect: (style: PhotoStyle) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
        Photo Style
      </p>
      <div className="flex flex-wrap gap-2">
        {PHOTO_STYLE_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = selectedStyle === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
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
  );
}

function FrameStyleSelectorSection({
  selectedStyle,
  onSelect,
}: {
  selectedStyle: PhotoFrameStyle;
  onSelect: (style: PhotoFrameStyle) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
        Frame Style
      </p>
      <div className="flex flex-wrap gap-2">
        {PHOTO_FRAME_STYLE_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = selectedStyle === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
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
  );
}

function CaptionStyleSection({
  captionFontFamily,
  captionFontSize,
  onFontChange,
  onSizeChange,
}: {
  captionFontFamily: string;
  captionFontSize: number;
  onFontChange: (fontFamily: string) => void;
  onSizeChange: (fontSize: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Type className="h-3.5 w-3.5 text-gray-400" />
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
          Caption Style
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="w-14 shrink-0 text-xs text-gray-500">Font</label>
          <select
            className="h-7 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs focus:border-indigo-400 focus:outline-none"
            style={{ fontFamily: captionFontFamily }}
            value={captionFontFamily}
            onChange={(e) => onFontChange(e.target.value)}
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
          <label className="w-14 shrink-0 text-xs text-gray-500">Size</label>
          <input
            type="range"
            min={10}
            max={24}
            step={1}
            value={captionFontSize}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="h-1 flex-1 accent-indigo-500"
          />
          <span className="w-8 text-right text-[10px] text-gray-400">{captionFontSize}px</span>
        </div>
      </div>
    </div>
  );
}

function SceneTransitionSection({
  selectedTransition,
  options,
  onSelect,
  keyPrefix,
}: {
  selectedTransition: SceneTransitionOption;
  options: ReadonlyArray<{ value: SceneTransitionOption; label: string }>;
  onSelect: (transition: SceneTransitionOption) => void;
  keyPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Film className="h-3.5 w-3.5 text-gray-400" />
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
          Scene Transition
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label }) => {
          const isActive = selectedTransition === value;

          return (
            <button
              key={`${keyPrefix}-${value}`}
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
  const photoFrameStyle = useUIStore((s) => s.photoFrameStyle);
  const globalSceneTransition = useUIStore((s) => s.sceneTransition);
  const moodColorsEnabled = useUIStore((s) => s.moodColorsEnabled);
  const setPhotoFrameStyle = useUIStore((s) => s.setPhotoFrameStyle);
  const setPhotoLayout = useProjectStore((s) => s.setPhotoLayout);
  const removePhoto = useProjectStore((s) => s.removePhoto);
  const segments = useProjectStore((s) => s.segments);
  const segmentColors = useProjectStore((s) => s.segmentColors);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
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
    layout.mode !== "free" && layout.template ? layout.template : "auto";
  const photoOrder = layout.order ?? location.photos.map((p) => p.id);

  // Capture map snapshot once when editor opens (wait for full render)
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const [capturedMapSize, setCapturedMapSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    const capture = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          const canvas = map.getCanvas();
          setMapSnapshot(canvas.toDataURL("image/jpeg", 0.8));
          setCapturedMapSize({ width: canvas.clientWidth, height: canvas.clientHeight });
        } catch {
          // Canvas tainted or not ready — fall back to dark background
        }
      });
    };

    // Navigate to the city's coordinates before capturing, so the
    // background matches what you'd see during playback ARRIVE.
    const coords = location.coordinates;
    if (coords) {
      map.jumpTo({ center: [coords[0], coords[1]], zoom: 12 });
      // Wait for tiles to load after jump, then capture
      map.once("idle", capture);
    } else if (map.isStyleLoaded() && map.loaded()) {
      capture();
    } else {
      map.once("idle", capture);
    }

    return () => {
      cancelled = true;
      map.off("idle", capture);
    };
  }, [location.coordinates, map]);

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
      // Free mode: use actual map canvas size
      if (capturedMapSize && capturedMapSize.width > 0 && capturedMapSize.height > 0) {
        return capturedMapSize.width / capturedMapSize.height;
      }
      if (panelSize && panelSize.width > 0 && panelSize.height > 0) {
        return panelSize.width / panelSize.height;
      }
      return 16 / 9;
    }
    // Explicit ratios: compute directly from the ratio string
    const [w, h] = viewportRatio.split(":").map(Number);
    return w / h;
  }, [capturedMapSize, panelSize, viewportRatio]);

  const previewSourceSize = useMemo(() => {
    if (viewportRatio === "free" && capturedMapSize && capturedMapSize.width > 0 && capturedMapSize.height > 0) {
      return capturedMapSize;
    }
    if (!panelSize) {
      return { width: 0, height: 0 };
    }

    const { width: pw, height: ph } = panelSize;
    const targetRatio = previewAspect;
    const panelRatio = pw / ph;

    if (targetRatio > panelRatio) {
      return { width: pw, height: pw / targetRatio };
    }
    return { width: ph * targetRatio, height: ph };
  }, [capturedMapSize, panelSize, previewAspect, viewportRatio]);

  const previewScale = useMemo(() => {
    if (!panelSize || previewSourceSize.width <= 0 || previewSourceSize.height <= 0) {
      return 1;
    }
    return Math.min(
      panelSize.width / previewSourceSize.width,
      panelSize.height / previewSourceSize.height,
    );
  }, [panelSize, previewSourceSize.height, previewSourceSize.width]);

  const previewPixelSize = useMemo(
    () => ({
      width: previewSourceSize.width * previewScale,
      height: previewSourceSize.height * previewScale,
    }),
    [previewScale, previewSourceSize.height, previewSourceSize.width],
  );

  // Compute fitted preview container style — always preserve aspect ratio for WYSIWYG
  const previewContainerStyle = useMemo<React.CSSProperties>(() => {
    const pw = previewPixelSize.width;
    const ph = previewPixelSize.height;
    if (!pw || !ph) {
      return { width: "100%", height: "100%" };
    }

    return { width: `${pw}px`, height: `${ph}px` };
  }, [previewPixelSize.height, previewPixelSize.width]);
  const previewContentStyle = useMemo<React.CSSProperties>(() => {
    const pw = previewSourceSize.width;
    const ph = previewSourceSize.height;
    if (!pw || !ph) {
      return { width: "100%", height: "100%" };
    }

    return {
      width: `${pw}px`,
      height: `${ph}px`,
      transform: previewScale === 1 ? undefined : `scale(${previewScale})`,
      transformOrigin: "top left",
    };
  }, [previewScale, previewSourceSize.height, previewSourceSize.width]);

  const orderedPhotos = useMemo(
    () => getOrderedPhotos(location.photos, photoOrder),
    [location.photos, photoOrder]
  );
  const orderedPhotoMetas = usePhotoDimensions(orderedPhotos);
  const layoutMetas = useMemo<LayoutPhotoMeta[]>(
    () => orderedPhotoMetas.map((photo) => ({ id: photo.id, aspect: photo.aspect })),
    [orderedPhotoMetas],
  );
  // Use the same 95%×88% inset dimensions that PhotoOverlay measures internally,
  // so drag targets align with the actual photo positions.
  const insetFracW = viewportRatio === "9:16" ? 0.98 : 0.95;
  const insetFracH = viewportRatio === "9:16" ? 0.92 : 0.88;
  const insetW = previewSourceSize.width * insetFracW;
  const insetH = previewSourceSize.height * insetFracH;
  const computedRects = useMemo(() => {
    if (!insetW || !insetH || layoutMetas.length === 0) {
      return [];
    }

    return computePhotoLayout(layoutMetas, insetW, insetH, layout, viewportRatio);
  }, [insetH, insetW, layout, layoutMetas, viewportRatio]);
  const fallbackFreeTransforms = useMemo(
    () => computedRectsToFreeTransforms(orderedPhotos, computedRects, {
      containerWidthPx: insetW,
      containerHeightPx: insetH,
      captionFontSizePx: layout.captionFontSize ?? 14,
    }),
    [computedRects, layout.captionFontSize, orderedPhotos, insetH, insetW],
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
    if (activeTemplate === "collage" || activeTemplate === "hero") return "collage";
    if (activeTemplate === "single") return "single";
    if (activeTemplate === "filmstrip") return "carousel";
    if (activeTemplate === "scatter" || activeTemplate === "polaroid") return "scatter";
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

  const replayEnterPreview = useCallback(() => {
    clearExitPreview();
    setPreviewOpacity(1);
    setPreviewKey((key) => key + 1);
  }, [clearExitPreview]);

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
      useHistoryStore.getState().pushState();
      if (style === "free") {
        // Bake visual rotation into free transforms so switching to Free mode
        // doesn't visually change photo positions or tilts.
        // PhotoOverlay adds a fallback rotation + PhotoFrame adds decorative rotation;
        // we merge both into transform.rotation so Free mode (which disables
        // decorative rotation) looks identical to the previous layout.
        const total = effectiveFreeTransforms.length;
        const bakedTransforms = effectiveFreeTransforms.map((t, index) => {
          // Only bake if the transform doesn't already have a user-set rotation
          // (i.e. it came from computedRectsToFreeTransforms with rect.rotation or 0)
          const overlayFallback = t.rotation !== 0
            ? 0 // already has rotation from scatter/polaroid template
            : total <= 3
              ? (index === 0 ? -2 : index === total - 1 ? 2 : 0)
              : (index % 2 === 0 ? -1.5 : 1.5);
          const frameDecorativeRotation = getPhotoFrameRotation(photoFrameStyle, t.photoId);
          return {
            ...t,
            rotation: t.rotation + overlayFallback + frameDecorativeRotation,
          };
        });
        updateLayout({ mode: "free", freeTransforms: bakedTransforms });
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
    [effectiveFreeTransforms, layout.layoutSeed, photoFrameStyle, updateLayout]
  );

  const refreshRandomLayout = useCallback(() => {
    if (!isRandomLayoutActive) return;
    useHistoryStore.getState().pushState();
    updateLayout({ layoutSeed: Math.random() });
  }, [isRandomLayoutActive, updateLayout]);

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
      useHistoryStore.getState().pushState();
      updateLayout({ enterAnimation: animation === "default" ? undefined : animation });
      replayEnterPreview();
    },
    [replayEnterPreview, updateLayout]
  );

  const handlePhotoStyleSelect = useCallback(
    (style: PhotoStyle) => {
      useHistoryStore.getState().pushState();
      updateLayout({ photoStyle: style });
      replayEnterPreview();
    },
    [replayEnterPreview, updateLayout]
  );

  const handlePhotoFrameStyleSelect = useCallback(
    (style: PhotoFrameStyle) => {
      useHistoryStore.getState().pushState();
      setPhotoFrameStyle(style);
      replayEnterPreview();
    },
    [replayEnterPreview, setPhotoFrameStyle]
  );

  const handleExitAnimationSelect = useCallback(
    (animation: PhotoAnimationOption) => {
      useHistoryStore.getState().pushState();
      updateLayout({ exitAnimation: animation === "default" ? undefined : animation });
      replayExitPreview();
    },
    [replayExitPreview, updateLayout]
  );

  const handleSceneTransitionSelect = useCallback(
    (transition: SceneTransitionOption) => {
      useHistoryStore.getState().pushState();
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
        // Bake visual rotation (same as handleStyleSelect "free" path)
        const total = effectiveFreeTransforms.length;
        const bakedTransforms = effectiveFreeTransforms.map((t, index) => {
          const overlayFallback = t.rotation !== 0
            ? 0
            : total <= 3
              ? (index === 0 ? -2 : index === total - 1 ? 2 : 0)
              : (index % 2 === 0 ? -1.5 : 1.5);
          const frameDecorativeRotation = getPhotoFrameRotation(photoFrameStyle, t.photoId);
          return { ...t, rotation: t.rotation + overlayFallback + frameDecorativeRotation };
        });
        updateLayout({ mode: "free", freeTransforms: bakedTransforms });
      }
    },
    [effectiveFreeTransforms, layout.mode, photoFrameStyle, updateLayout],
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

      useHistoryStore.getState().pushState();
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

  // FreeCanvas needs the same 95%×88% inset that PhotoOverlay uses
  const freeCanvasInsetW = Math.round(previewSourceSize.width * 0.95);
  const freeCanvasInsetH = Math.round(previewSourceSize.height * 0.88);

  const layoutPreviewNode = (
    layout.mode === "free" ? (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: "95%", height: "88%" }}>
          <FreeCanvas
            photos={orderedPhotos}
            transforms={effectiveFreeTransforms}
            containerSize={{ w: freeCanvasInsetW, h: freeCanvasInsetH }}
            mapSnapshot={null}
            borderRadius={borderRadius}
            defaultCaptionFontFamily={layout.captionFontFamily ?? DEFAULT_CAPTION_FONT_FAMILY}
            defaultCaptionFontSize={layout.captionFontSize ?? 14}
            onTransformsChange={handleFreeTransformsChange}
            initialGesture={initialFreeGesture}
            onInitialGestureHandled={() => setInitialFreeGesture(null)}
          />
        </div>
      </div>
    ) : (
      <>
        <PhotoOverlay
          key={previewKey}
          photos={orderedPhotos}
          visible={true}
          photoLayout={layout}
          opacity={previewOpacity}
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
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
              >
                <Undo2 className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
              >
                <Redo2 className="h-4 w-4 text-gray-500" />
              </button>
              <button onClick={onClose} aria-label="Close photo layout editor" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Preview area — limited height so controls are always scrollable */}
          <div ref={mobilePreviewRef} className="shrink-0 flex items-center justify-center p-4 bg-gray-950/5" style={{ height: "40vh" }}>
            <PreviewWithMapBackground
              mapSnapshot={mapSnapshot}
              previewContainerStyle={previewContainerStyle}
              previewContentStyle={previewContentStyle}
            >
              {layoutPreviewNode}
            </PreviewWithMapBackground>
          </div>

          {/* Bottom controls */}
          <div className="flex-1 min-h-0 border-t border-gray-100 bg-white flex flex-col" style={{ maxHeight: "60vh" }}>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="space-y-3 px-4 py-3">
                <SettingsGroup title="Layout" defaultOpen>
                  <LayoutStyleSelectorSection
                    variant="mobile"
                    activeStyle={activeStyle}
                    isRandomLayoutActive={isRandomLayoutActive}
                    onSelect={handleStyleSelect}
                    onRefresh={refreshRandomLayout}
                  />
                </SettingsGroup>

                <SettingsGroup title="Style" defaultOpen>
                  <div className="space-y-4">
                    <PhotoStyleSelectorSection
                      selectedStyle={activePhotoStyle}
                      onSelect={handlePhotoStyleSelect}
                    />
                    <FrameStyleSelectorSection
                      selectedStyle={photoFrameStyle}
                      onSelect={handlePhotoFrameStyleSelect}
                    />
                    <CaptionStyleSection
                      captionFontFamily={layout.captionFontFamily ?? DEFAULT_CAPTION_FONT_FAMILY}
                      captionFontSize={layout.captionFontSize ?? 14}
                      onFontChange={(captionFontFamily) => updateLayout({ captionFontFamily })}
                      onSizeChange={(captionFontSize) => updateLayout({ captionFontSize })}
                    />
                  </div>
                </SettingsGroup>

                <SettingsGroup title="Animation">
                  <div className="space-y-4">
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
                    <SceneTransitionSection
                      selectedTransition={selectedSceneTransition}
                      options={sceneTransitionOptions}
                      onSelect={handleSceneTransitionSelect}
                      keyPrefix="scene-transition-mobile"
                    />
                  </div>
                </SettingsGroup>
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
                  onClick={undo}
                  disabled={!canUndo}
                  aria-label="Undo"
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  aria-label="Redo"
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
                >
                  <Redo2 className="h-4 w-4 text-gray-500" />
                </button>
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
            <div className={`w-72 min-h-0 overflow-y-auto border-r border-gray-100 p-4 space-y-3 transition-all duration-300 ${expanded ? "hidden" : ""}`}>
              <SettingsGroup title="Layout" defaultOpen>
                <LayoutStyleSelectorSection
                  variant="desktop"
                  activeStyle={activeStyle}
                  isRandomLayoutActive={isRandomLayoutActive}
                  onSelect={handleStyleSelect}
                  onRefresh={refreshRandomLayout}
                />
              </SettingsGroup>

              <SettingsGroup title="Style" defaultOpen>
                <div className="space-y-4">
                  <PhotoStyleSelectorSection
                    selectedStyle={activePhotoStyle}
                    onSelect={handlePhotoStyleSelect}
                  />
                  <FrameStyleSelectorSection
                    selectedStyle={photoFrameStyle}
                    onSelect={handlePhotoFrameStyleSelect}
                  />
                  <CaptionStyleSection
                    captionFontFamily={layout.captionFontFamily ?? DEFAULT_CAPTION_FONT_FAMILY}
                    captionFontSize={layout.captionFontSize ?? 14}
                    onFontChange={(captionFontFamily) => updateLayout({ captionFontFamily })}
                    onSizeChange={(captionFontSize) => updateLayout({ captionFontSize })}
                  />
                </div>
              </SettingsGroup>

              <SettingsGroup title="Animation">
                <div className="space-y-4">
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
                  <SceneTransitionSection
                    selectedTransition={selectedSceneTransition}
                    options={sceneTransitionOptions}
                    onSelect={handleSceneTransitionSelect}
                    keyPrefix="scene-transition-desktop"
                  />
                </div>
              </SettingsGroup>
            </div>

            {/* CENTER — Live preview with map background */}
            <div ref={desktopPreviewRef} className={`relative flex-1 bg-gray-100 flex items-center justify-center ${expanded ? "p-2" : "p-6"}`}>
              {expanded ? (
                <div className="absolute right-4 top-4 z-40 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!canUndo}
                    aria-label="Undo"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/70 text-gray-700 shadow-lg backdrop-blur-sm transition hover:bg-white/85 disabled:opacity-30"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!canRedo}
                    aria-label="Redo"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/70 text-gray-700 shadow-lg backdrop-blur-sm transition hover:bg-white/85 disabled:opacity-30"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-label="Minimize editor"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/70 text-gray-700 shadow-lg backdrop-blur-sm transition hover:bg-white/85"
                  >
                    <Minimize2 className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
              <PreviewWithMapBackground
                mapSnapshot={mapSnapshot}
                previewContainerStyle={previewContainerStyle}
                previewContentStyle={previewContentStyle}
              >
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
