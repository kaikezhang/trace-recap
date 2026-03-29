"use client";

import { useState, useCallback, useEffect } from "react";
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
import { X, Sparkles, Grid3X3, LayoutPanelLeft, Columns3, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProjectStore } from "@/stores/projectStore";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import type { PhotoMeta } from "@/lib/photoLayout";
import type { Location, LayoutTemplate, PhotoLayout } from "@/types";

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
];

interface SortablePhotoProps {
  id: string;
  url: string;
  style: React.CSSProperties;
  borderRadius: number;
}

function SortablePhoto({ id, url, style, borderRadius }: SortablePhotoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className="absolute overflow-hidden"
      {...attributes}
      {...listeners}
    >
      <img
        src={url}
        alt=""
        className="w-full h-full object-cover"
        style={{ borderRadius: `${borderRadius}px` }}
        draggable={false}
      />
    </div>
  );
}

export default function PhotoLayoutEditor({ location, onClose }: PhotoLayoutEditorProps) {
  const setPhotoLayout = useProjectStore((s) => s.setPhotoLayout);
  const layout = location.photoLayout ?? { mode: "auto" as const };

  const activeTemplate: LayoutTemplate | "auto" =
    layout.mode === "manual" && layout.template ? layout.template : "auto";
  const gapValue = layout.gap ?? 8;
  const borderRadiusValue = layout.borderRadius ?? 8;
  const photoOrder = layout.order ?? location.photos.map((p) => p.id);

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
        updateLayout({ mode: "auto", template: undefined });
      } else {
        updateLayout({ mode: "manual", template: id });
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

  const previewW = 400;
  const previewH = 300;
  const containerAspect = previewW / previewH;

  const rects =
    activeTemplate === "auto"
      ? computeAutoLayout(photoMetas, containerAspect, gapValue, previewW)
      : computeTemplateLayout(photoMetas, containerAspect, activeTemplate, gapValue, previewW);

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
        onClick={(e) => e.stopPropagation()}
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
                        borderRadius={borderRadiusValue}
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
            </div>
          </div>
        </div>

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
