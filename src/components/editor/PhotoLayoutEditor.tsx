"use client";

import { useState, useCallback } from "react";
import {
  X,
  LayoutGrid,
  LayoutTemplate,
  Image as ImageIcon,
  Images,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
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

/* ── Preview renderers for each layout style ── */

function GridPreview({ photos, borderRadius }: { photos: Photo[]; borderRadius: number }) {
  const visible = photos.slice(0, 4);
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full p-3">
      {visible.map((photo) => (
        <div key={photo.id} className="relative overflow-hidden" style={{ borderRadius: `${borderRadius}px` }}>
          <img
            src={photo.url}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function CollagePreview({ photos, borderRadius }: { photos: Photo[]; borderRadius: number }) {
  const main = photos[0];
  const others = photos.slice(1, 4);
  if (!main) return null;
  return (
    <div className="relative w-full h-full p-3">
      <div className="absolute inset-3 overflow-hidden" style={{ borderRadius: `${borderRadius}px` }}>
        <img
          src={main.url}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: `${(main.focalPoint?.x ?? 0.5) * 100}% ${(main.focalPoint?.y ?? 0.5) * 100}%` }}
        />
      </div>
      {others.map((photo, i) => (
        <div
          key={photo.id}
          className="absolute overflow-hidden shadow-lg border-2 border-white"
          style={{
            borderRadius: `${borderRadius}px`,
            width: "35%",
            height: "35%",
            bottom: `${12 + i * 4}%`,
            right: `${8 + i * 18}%`,
          }}
        >
          <img
            src={photo.url}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function SinglePreview({ photos, borderRadius, selectedIndex }: { photos: Photo[]; borderRadius: number; selectedIndex: number }) {
  const photo = photos[selectedIndex] ?? photos[0];
  if (!photo) return null;
  return (
    <div className="flex items-center justify-center w-full h-full p-6">
      <div className="w-3/4 h-3/4 overflow-hidden" style={{ borderRadius: `${borderRadius}px` }}>
        <img
          src={photo.url}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%` }}
        />
      </div>
    </div>
  );
}

function CarouselPreview({
  photos,
  borderRadius,
  carouselIndex,
  onPrev,
  onNext,
}: {
  photos: Photo[];
  borderRadius: number;
  carouselIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[carouselIndex] ?? photos[0];
  if (!photo) return null;
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4">
      <div className="relative flex-1 w-full flex items-center justify-center">
        {photos.length > 1 && (
          <button
            onClick={onPrev}
            className="absolute left-2 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
        )}
        <div className="w-3/4 h-full overflow-hidden" style={{ borderRadius: `${borderRadius}px` }}>
          <img
            src={photo.url}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%` }}
          />
        </div>
        {photos.length > 1 && (
          <button
            onClick={onNext}
            className="absolute right-2 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-1.5 mt-3">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === carouselIndex ? "bg-indigo-500" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PhotoLayoutEditor({ location, onClose }: PhotoLayoutEditorProps) {
  const setPhotoLayout = useProjectStore((s) => s.setPhotoLayout);
  const layout = location.photoLayout ?? { mode: "auto" as const };

  const activeTemplate: LayoutTemplateType | "auto" =
    layout.mode === "manual" && layout.template ? layout.template : "auto";
  const borderRadiusValue = layout.borderRadius ?? 8;
  const photoOrder = layout.order ?? location.photos.map((p) => p.id);

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);

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

            {/* CENTER — Live preview */}
            <div className="flex-1 bg-gray-100 flex items-center justify-center p-6">
              <div className="w-full h-full bg-gray-200/50 rounded-xl overflow-hidden relative">
                {activeStyle === "grid" && (
                  <GridPreview photos={orderedPhotos} borderRadius={borderRadiusValue} />
                )}
                {activeStyle === "collage" && (
                  <CollagePreview photos={orderedPhotos} borderRadius={borderRadiusValue} />
                )}
                {activeStyle === "single" && (
                  <SinglePreview
                    photos={orderedPhotos}
                    borderRadius={borderRadiusValue}
                    selectedIndex={selectedPhotoIndex}
                  />
                )}
                {activeStyle === "carousel" && (
                  <CarouselPreview
                    photos={orderedPhotos}
                    borderRadius={borderRadiusValue}
                    carouselIndex={carouselIndex}
                    onPrev={() => setCarouselIndex((i) => (i - 1 + orderedPhotos.length) % orderedPhotos.length)}
                    onNext={() => setCarouselIndex((i) => (i + 1) % orderedPhotos.length)}
                  />
                )}
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
                      setCarouselIndex(i);
                    }}
                    className={`w-full aspect-square rounded-lg overflow-hidden transition-all ${
                      (activeStyle === "single" ? selectedPhotoIndex === i : carouselIndex === i)
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
