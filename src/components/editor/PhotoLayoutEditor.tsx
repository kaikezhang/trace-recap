"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Sparkles, Grid3X3, LayoutPanelLeft, Columns3, Film, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProjectStore } from "@/stores/projectStore";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import type { PhotoMeta, PhotoRect } from "@/lib/photoLayout";
import type { Location, LayoutTemplate, PhotoLayout, Photo } from "@/types";

interface PhotoLayoutEditorProps {
  location: Location;
  onClose: () => void;
}

const TEMPLATES: { id: LayoutTemplate | "auto"; label: string; icon: typeof Grid3X3 }[] = [
  { id: "auto", label: "Auto", icon: Sparkles },
  { id: "grid", label: "Grid", icon: Grid3X3 },
  { id: "hero", label: "Hero", icon: LayoutPanelLeft },
  { id: "masonry", label: "Masonry", icon: Columns3 },
  { id: "filmstrip", label: "Filmstrip", icon: Film },
  { id: "scatter", label: "Scatter", icon: Shuffle },
];

interface SortablePhotoProps {
  id: string;
  url: string;
  photo: Photo;
  style: React.CSSProperties;
  borderRadius: number;
  rotation?: number;
  focalPointActive: string | null;
  onFocalPointClick: (photoId: string) => void;
  onFocalPointDrag: (photoId: string, e: React.MouseEvent) => void;
}

function SortablePhoto({
  id,
  url,
  photo,
  style,
  borderRadius,
  rotation,
  focalPointActive,
  onFocalPointClick,
  onFocalPointDrag,
}: SortablePhotoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const isActive = focalPointActive === id;
  const fp = photo.focalPoint ?? { x: 0.5, y: 0.5 };

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isActive ? "crosshair" : "grab",
  };

  if (rotation) {
    dragStyle.transform = `${dragStyle.transform || ""} rotate(${rotation}deg)`.trim();
  }

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className="absolute overflow-hidden"
      {...attributes}
      {...(isActive ? {} : listeners)}
    >
      <div className="relative w-full h-full">
        <img
          src={url}
          alt=""
          className="w-full h-full object-contain"
          style={{
            borderRadius: `${borderRadius}px`,
            objectPosition: `${fp.x * 100}% ${fp.y * 100}%`,
          }}
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            onFocalPointClick(id);
          }}
        />
        {isActive && (
          <div
            className="absolute inset-0"
            style={{ borderRadius: `${borderRadius}px`, cursor: "crosshair" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onFocalPointDrag(id, e);
            }}
          >
            {/* Focal point crosshair indicator */}
            <div
              className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${fp.x * 100}%`,
                top: `${fp.y * 100}%`,
              }}
            >
              <div className="absolute inset-0 rounded-full border-2 border-white" style={{ boxShadow: "0 0 3px rgba(0,0,0,0.5)" }} />
              <div className="absolute top-1/2 left-0 w-full h-px bg-white" style={{ boxShadow: "0 0 2px rgba(0,0,0,0.5)" }} />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white" style={{ boxShadow: "0 0 2px rgba(0,0,0,0.5)" }} />
            </div>
            <div className="absolute inset-0 border-2 border-blue-400/50 rounded" style={{ borderRadius: `${borderRadius}px` }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Detect vertical divider positions between grid/hero cells (no horizontal — Phase 3 only supports column-width dividers) */
function computeDividers(
  rects: PhotoRect[],
  template: LayoutTemplate | "auto"
): { orientation: "vertical"; position: number; index: number }[] {
  if (template !== "grid" && template !== "hero") return [];
  if (rects.length < 2) return [];

  const dividers: { orientation: "vertical"; position: number; index: number }[] = [];
  const eps = 0.02;

  // For hero layout, only show the main vertical divider between hero and sidebar
  if (template === "hero") {
    const heroRect = rects[0];
    if (heroRect && rects.length > 1) {
      const heroRight = heroRect.x + heroRect.width;
      const sidebarLeft = rects[1].x;
      const mid = (heroRight + sidebarLeft) / 2;
      dividers.push({ orientation: "vertical", position: mid, index: 0 });
    }
    return dividers;
  }

  // For grid: find unique column boundaries (vertical dividers only)
  const xEnds = rects.map((r) => r.x + r.width);
  const xStarts = rects.map((r) => r.x);
  const uniqueXBounds: number[] = [];
  for (const xe of xEnds) {
    for (const xs of xStarts) {
      if (Math.abs(xe - xs) < eps * 3 && xe > eps * 5 && xs < 1 - eps * 5) {
        const mid = (xe + xs) / 2;
        if (!uniqueXBounds.some((v) => Math.abs(v - mid) < eps)) {
          uniqueXBounds.push(mid);
        }
      }
    }
  }
  uniqueXBounds.sort((a, b) => a - b);
  uniqueXBounds.forEach((x, idx) => {
    dividers.push({ orientation: "vertical", position: x, index: idx });
  });

  return dividers;
}

export default function PhotoLayoutEditor({ location, onClose }: PhotoLayoutEditorProps) {
  const setPhotoLayout = useProjectStore((s) => s.setPhotoLayout);
  const setPhotoFocalPoint = useProjectStore((s) => s.setPhotoFocalPoint);
  const layout = location.photoLayout ?? { mode: "auto" as const };

  const activeTemplate: LayoutTemplate | "auto" =
    layout.mode === "manual" && layout.template ? layout.template : "auto";
  const gapValue = layout.gap ?? 8;
  const borderRadiusValue = layout.borderRadius ?? 8;
  const photoOrder = layout.order ?? location.photos.map((p) => p.id);

  const [focalPointActive, setFocalPointActive] = useState<string | null>(null);
  const [focalImgNatural, setFocalImgNatural] = useState<{ w: number; h: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Photo dimensions for layout computation
  const [photoAspects, setPhotoAspects] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const aspects = new Map<string, number>();
    let loaded = 0;
    const total = location.photos.length;
    if (total === 0) return;

    location.photos.forEach((photo) => {
      const img = new Image();
      img.onload = () => {
        aspects.set(photo.id, img.naturalWidth / img.naturalHeight);
        loaded++;
        if (loaded === total) setPhotoAspects(new Map(aspects));
      };
      img.onerror = () => {
        aspects.set(photo.id, 4 / 3);
        loaded++;
        if (loaded === total) setPhotoAspects(new Map(aspects));
      };
      img.src = photo.url;
    });
  }, [location.photos]);

  const updateLayout = useCallback(
    (updates: Partial<PhotoLayout>) => {
      const current: PhotoLayout = location.photoLayout ?? { mode: "auto" };
      setPhotoLayout(location.id, { ...current, ...updates });
    },
    [location.id, location.photoLayout, setPhotoLayout]
  );

  const handleTemplateSelect = useCallback(
    (id: LayoutTemplate | "auto") => {
      if (id === "auto") {
        updateLayout({ mode: "auto", template: undefined, customProportions: undefined });
      } else {
        updateLayout({ mode: "manual", template: id, customProportions: undefined });
      }
    },
    [updateLayout]
  );

  const handleGapChange = useCallback(
    (val: number | readonly number[]) => {
      const v = Array.isArray(val) ? val[0] : val;
      updateLayout({ gap: v });
    },
    [updateLayout]
  );

  const handleBorderRadiusChange = useCallback(
    (val: number | readonly number[]) => {
      const v = Array.isArray(val) ? val[0] : val;
      updateLayout({ borderRadius: v });
    },
    [updateLayout]
  );

  // Order photos based on saved order
  const orderedPhotos = (() => {
    const photoMap = new Map(location.photos.map((p) => [p.id, p]));
    const ordered = photoOrder
      .map((id) => photoMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);
    // Add any photos not in the order list
    for (const p of location.photos) {
      if (!ordered.find((o) => o.id === p.id)) ordered.push(p);
    }
    return ordered;
  })();

  // Compute layout rects for preview
  const photoMetas: PhotoMeta[] = orderedPhotos.map((p) => ({
    id: p.id,
    aspect: photoAspects.get(p.id) ?? 4 / 3,
  }));

  // Match the actual viewport aspect ratio so layout editor matches PhotoOverlay
  const [viewportAspect, setViewportAspect] = useState(
    typeof window !== "undefined" ? window.innerWidth / window.innerHeight : 16 / 9
  );
  useEffect(() => {
    const onResize = () => setViewportAspect(window.innerWidth / window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const previewW = 400;
  const previewH = Math.round(previewW / viewportAspect);
  const containerAspect = viewportAspect;

  const rects =
    activeTemplate === "auto"
      ? computeAutoLayout(photoMetas, containerAspect, gapValue, previewW)
      : computeTemplateLayout(
          photoMetas,
          containerAspect,
          activeTemplate,
          gapValue,
          previewW,
          layout.customProportions
        );

  // Compute dividers for grid/hero templates
  const dividers = computeDividers(rects, activeTemplate);

  // Focal point click handler
  const handleFocalPointClick = useCallback((photoId: string) => {
    setFocalPointActive((prev) => (prev === photoId ? null : photoId));
  }, []);

  // Focal point drag handler
  const handleFocalPointDrag = useCallback(
    (photoId: string, startEvent: React.MouseEvent) => {
      const target = startEvent.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();

      const updatePoint = (clientX: number, clientY: number) => {
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        setPhotoFocalPoint(location.id, photoId, { x, y });
      };

      // Set initial point
      updatePoint(startEvent.clientX, startEvent.clientY);

      const onMouseMove = (e: MouseEvent) => {
        updatePoint(e.clientX, e.clientY);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [location.id, setPhotoFocalPoint]
  );

  // Divider drag handler (vertical column dividers only)
  const handleDividerDrag = useCallback(
    (_orientation: "vertical", dividerIndex: number, startEvent: React.MouseEvent) => {
      startEvent.preventDefault();
      startEvent.stopPropagation();

      const container = previewRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      const onMouseMove = (e: MouseEvent) => {
        const current = layout.customProportions ?? {};
        // Only vertical column dividers are supported (horizontal removed in Phase 3)
        // Compute col count from rects
        const uniqueXs = new Set(rects.map((r) => Math.round(r.x * 1000)));
        const colCount = uniqueXs.size;
        const cols = current.cols?.slice(0, colCount) ?? new Array(colCount).fill(1);
        const totalWeight = cols.reduce((s: number, w: number) => s + w, 0);

        const fraction = Math.max(0.05, Math.min(0.95,
          (e.clientX - containerRect.left) / containerRect.width
        ));

        // Only adjust the two cells adjacent to the divider
        const leftIdx = dividerIndex;
        const rightIdx = dividerIndex + 1;
        if (leftIdx >= 0 && rightIdx < colCount) {
          const newCols = [...cols];
          // Compute the start fraction of the left cell and end fraction of the right cell
          const availW = 1; // total weight space
          const weightPerUnit = availW / totalWeight;
          let leftStart = 0;
          for (let i = 0; i < leftIdx; i++) leftStart += cols[i] * weightPerUnit;
          let rightEnd = 0;
          for (let i = 0; i <= rightIdx; i++) rightEnd += cols[i] * weightPerUnit;

          // The divider position maps to a split within [leftStart, rightEnd]
          const pairTotal = cols[leftIdx] + cols[rightIdx];
          const relFraction = Math.max(0.1, Math.min(0.9,
            (fraction - leftStart) / (rightEnd - leftStart)
          ));
          newCols[leftIdx] = relFraction * pairTotal;
          newCols[rightIdx] = (1 - relFraction) * pairTotal;
          updateLayout({ customProportions: { ...current, cols: newCols } });
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [layout.customProportions, rects, updateLayout]
  );

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = orderedPhotos.map((p) => p.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(ids, oldIndex, newIndex);
      updateLayout({ order: newOrder });
    },
    [orderedPhotos, updateLayout]
  );

  if (location.photos.length === 0) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div
        className="bg-background/95 backdrop-blur rounded-xl shadow-2xl max-w-lg w-full mx-4 pointer-events-auto"
        onClick={(e) => {
          e.stopPropagation();
          // Clicking outside a photo deactivates focal point mode
          setFocalPointActive(null);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold truncate">
            {location.name} — Photo Layout
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Template buttons */}
        <div className="flex gap-1.5 px-4 py-3 flex-wrap">
          {TEMPLATES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTemplateSelect(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTemplate === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Photo grid preview */}
        <div className="px-4 pb-3">
          <div
            ref={previewRef}
            className="relative bg-muted/50 rounded-lg overflow-hidden"
            style={{ width: "100%", paddingBottom: `${(previewH / previewW) * 100}%` }}
          >
            <div className="absolute inset-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedPhotos.map((p) => p.id)}
                  strategy={rectSortingStrategy}
                >
                  {rects.map((rect, i) => {
                    const photo = orderedPhotos[i];
                    if (!photo) return null;
                    return (
                      <SortablePhoto
                        key={photo.id}
                        id={photo.id}
                        url={photo.url}
                        photo={photo}
                        borderRadius={borderRadiusValue}
                        rotation={rect.rotation}
                        focalPointActive={focalPointActive}
                        onFocalPointClick={handleFocalPointClick}
                        onFocalPointDrag={handleFocalPointDrag}
                        style={{
                          left: `${rect.x * 100}%`,
                          top: `${rect.y * 100}%`,
                          width: `${rect.width * 100}%`,
                          height: `${rect.height * 100}%`,
                        }}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>

              {/* Vertical divider drag handles (column-width only) */}
              {dividers.map((div, i) => (
                <div
                  key={`divider-vertical-${i}`}
                  className="absolute z-10 group"
                  style={{
                    top: "0%",
                    height: "100%",
                    left: `${div.position * 100}%`,
                    width: "8px",
                    transform: "translateX(-50%)",
                    cursor: "col-resize",
                  }}
                  onMouseDown={(e) => handleDividerDrag("vertical", div.index, e)}
                >
                  <div
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      position: "absolute",
                      top: "10%",
                      bottom: "10%",
                      left: "50%",
                      width: "2px",
                      transform: "translateX(-50%)",
                      backgroundColor: "rgba(99,102,241,0.6)",
                      borderRadius: "1px",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Focal point modal: full uncropped photo overlay */}
        {focalPointActive && (() => {
          const activePhoto = location.photos.find((p) => p.id === focalPointActive);
          if (!activePhoto) return null;
          const fp = activePhoto.focalPoint ?? { x: 0.5, y: 0.5 };
          return (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground text-center mb-2">
                Click on the full image below to set the crop focal point
              </p>
              <div
                className="relative w-full rounded-lg overflow-hidden border border-border cursor-crosshair"
                data-focal-wrapper
                style={{ maxHeight: "300px" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const wrapperRect = e.currentTarget.getBoundingClientRect();
                  const img = e.currentTarget.querySelector("img") as HTMLImageElement | null;
                  const updatePoint = (clientX: number, clientY: number) => {
                    // Compute actual rendered image bounds within the object-fit:contain wrapper
                    let imgLeft = wrapperRect.left;
                    let imgTop = wrapperRect.top;
                    let imgW = wrapperRect.width;
                    let imgH = wrapperRect.height;
                    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                      const containerW = wrapperRect.width;
                      const containerH = wrapperRect.height;
                      const imgAspect = img.naturalWidth / img.naturalHeight;
                      const containerAspect = containerW / containerH;
                      if (imgAspect > containerAspect) {
                        // Pillarbox: image fills width, letterboxed vertically
                        imgW = containerW;
                        imgH = containerW / imgAspect;
                      } else {
                        // Letterbox: image fills height, pillarboxed horizontally
                        imgH = containerH;
                        imgW = containerH * imgAspect;
                      }
                      imgLeft = wrapperRect.left + (containerW - imgW) / 2;
                      imgTop = wrapperRect.top + (containerH - imgH) / 2;
                    }
                    const x = Math.max(0, Math.min(1, (clientX - imgLeft) / imgW));
                    const y = Math.max(0, Math.min(1, (clientY - imgTop) / imgH));
                    setPhotoFocalPoint(location.id, focalPointActive, { x, y });
                  };
                  updatePoint(e.clientX, e.clientY);
                  const onMouseMove = (ev: MouseEvent) => updatePoint(ev.clientX, ev.clientY);
                  const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                  };
                  document.addEventListener("mousemove", onMouseMove);
                  document.addEventListener("mouseup", onMouseUp);
                }}
              >
                <img
                  src={activePhoto.url}
                  alt=""
                  className="w-full object-contain"
                  style={{ maxHeight: "300px" }}
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setFocalImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
                  }}
                />
                {/* Crosshair indicator — positioned relative to rendered image area */}
                {(() => {
                  let leftPct = fp.x * 100;
                  let topPct = fp.y * 100;
                  if (focalImgNatural && focalImgNatural.w > 0 && focalImgNatural.h > 0) {
                    const imgAspect = focalImgNatural.w / focalImgNatural.h;
                    const wrapperEl = document.querySelector<HTMLElement>("[data-focal-wrapper]");
                    if (wrapperEl) {
                      const cw = wrapperEl.clientWidth;
                      const ch = wrapperEl.clientHeight;
                      const containerAspect = cw / ch;
                      let imgW: number, imgH: number;
                      if (imgAspect > containerAspect) {
                        imgW = cw;
                        imgH = cw / imgAspect;
                      } else {
                        imgH = ch;
                        imgW = ch * imgAspect;
                      }
                      const offX = (cw - imgW) / 2;
                      const offY = (ch - imgH) / 2;
                      leftPct = ((offX + fp.x * imgW) / cw) * 100;
                      topPct = ((offY + fp.y * imgH) / ch) * 100;
                    }
                  }
                  return (
                    <div
                      className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                    >
                      <div className="absolute inset-0 rounded-full border-2 border-white" style={{ boxShadow: "0 0 4px rgba(0,0,0,0.7)" }} />
                      <div className="absolute top-1/2 left-0 w-full h-px bg-white" style={{ boxShadow: "0 0 2px rgba(0,0,0,0.5)" }} />
                      <div className="absolute left-1/2 top-0 h-full w-px bg-white" style={{ boxShadow: "0 0 2px rgba(0,0,0,0.5)" }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        {/* Sliders */}
        <div className="px-4 pb-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Gap</span>
            <Slider
              value={[gapValue]}
              min={0}
              max={20}
              onValueChange={handleGapChange}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{gapValue}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Corners</span>
            <Slider
              value={[borderRadiusValue]}
              min={0}
              max={20}
              onValueChange={handleBorderRadiusChange}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{borderRadiusValue}px</span>
          </div>
        </div>

        {/* Done button */}
        <div className="flex justify-end px-4 py-3 border-t">
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
