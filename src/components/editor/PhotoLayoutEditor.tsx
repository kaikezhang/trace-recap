"use client";

import { useState, useCallback, useMemo } from "react";
import {
  X,
  LayoutGrid,
  LayoutTemplate,
  Image as ImageIcon,
  Images,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
import { computeAutoLayout, computeTemplateLayout } from "@/lib/photoLayout";
import type { Location, LayoutTemplate as LayoutTemplateType, PhotoLayout, Photo } from "@/types";

interface PhotoLayoutEditorProps {
  location: Location;
  onClose: () => void;
}

type LayoutStyle = "grid" | "collage" | "single" | "carousel";

const LAYOUT_STYLES: { id: LayoutStyle; label: string; icon: typeof LayoutGrid; template: LayoutTemplateType | "auto" }[] = [
  { id: "grid", label: "Grid", icon: LayoutGrid, template: "grid" },
  { id: "collage", label: "Collage", icon: LayoutTemplate, template: "hero" },
  { id: "single", label: "Single", icon: ImageIcon, template: "auto" },
  { id: "carousel", label: "Carousel", icon: Images, template: "filmstrip" },
];

/* ── Unified preview using actual layout functions ── */

function LayoutPreview({
  photos,
  borderRadius,
  template,
  gap,
  customProportions,
}: {
  photos: Photo[];
  borderRadius: number;
  template: LayoutTemplateType | "auto";
  gap: number;
  customProportions?: { rows?: number[]; cols?: number[] };
}) {
  const containerAspect = 16 / 10; // approximate preview container aspect
  const containerWidthPx = 500; // reference width for gap calculation

  const metas = useMemo(
    () => photos.map((p) => ({ id: p.id, aspect: 1 })),
    [photos]
  );

  const rects = useMemo(() => {
    if (template === "auto") {
      return computeAutoLayout(metas, containerAspect, gap, containerWidthPx);
    }
    return computeTemplateLayout(metas, containerAspect, template, gap, containerWidthPx, customProportions);
  }, [metas, containerAspect, template, gap, containerWidthPx, customProportions]);

  return (
    <div className="relative w-full h-full">
      {rects.map((rect, i) => {
        if (i >= photos.length) return null;
        const photo = photos[i];
        return (
          <div
            key={photo.id}
            className="absolute overflow-hidden"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              borderRadius: `${borderRadius}px`,
              transform: rect.rotation ? `rotate(${rect.rotation}deg)` : undefined,
            }}
          >
            <img
              src={photo.url}
              alt=""
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function PhotoLayoutEditor({ location, onClose }: PhotoLayoutEditorProps) {
  const setPhotoLayout = useProjectStore((s) => s.setPhotoLayout);
  const layout = location.photoLayout ?? { mode: "auto" as const };

  const activeTemplate: LayoutTemplateType | "auto" =
    layout.mode === "manual" && layout.template ? layout.template : "auto";
  const borderRadiusValue = layout.borderRadius ?? 8;
  const gapValue = layout.gap ?? 8;
  const photoOrder = layout.order ?? location.photos.map((p) => p.id);

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const activeStyle: LayoutStyle = (() => {
    if (activeTemplate === "grid") return "grid";
    if (activeTemplate === "hero") return "collage";
    if (activeTemplate === "filmstrip") return "carousel";
    return "single";
  })();

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
      if (config.template === "auto") {
        updateLayout({ mode: "auto", template: undefined, customProportions: undefined });
      } else {
        updateLayout({ mode: "manual", template: config.template, customProportions: undefined });
      }
    },
    [updateLayout]
  );

  const orderedPhotos = (() => {
    const photoMap = new Map(location.photos.map((p) => [p.id, p]));
    const ordered = photoOrder
      .map((id) => photoMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);
    for (const p of location.photos) {
      if (!ordered.find((o) => o.id === p.id)) ordered.push(p);
    }
    return ordered;
  })();

  if (location.photos.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {location.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {location.photos.length} photo{location.photos.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* 3-column body */}
          <div className="flex h-[500px]">
            {/* LEFT — Layout style selector */}
            <div className="w-48 border-r border-gray-100 p-4 space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Layout</p>
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
            </div>

            {/* CENTER — Live preview using actual layout functions */}
            <div className="flex-1 bg-gray-100 flex items-center justify-center p-6">
              <div className="w-full h-full bg-gray-200/50 rounded-xl overflow-hidden relative">
                <LayoutPreview
                  photos={orderedPhotos}
                  borderRadius={borderRadiusValue}
                  template={activeTemplate}
                  gap={gapValue}
                  customProportions={layout.customProportions}
                />
              </div>
            </div>

            {/* RIGHT — Photo thumbnail list */}
            <div className="w-48 border-l border-gray-100 flex flex-col">
              <div className="p-4 pb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Photos</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-2">
                {orderedPhotos.map((photo, i) => (
                  <button
                    key={photo.id}
                    onClick={() => {
                      setSelectedPhotoIndex(i);
                    }}
                    className={`w-full aspect-square rounded-lg overflow-hidden transition-all ${
                      selectedPhotoIndex === i
                        ? "ring-2 ring-indigo-500 ring-offset-2"
                        : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%` }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Changes are applied automatically</p>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
