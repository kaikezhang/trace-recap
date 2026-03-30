"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  LayoutGrid,
  LayoutTemplate,
  Image as ImageIcon,
  Images,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useMap } from "./MapContext";
import PhotoOverlay from "./PhotoOverlay";
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
      className="rounded-xl overflow-hidden relative"
      style={{
        ...previewContainerStyle,
        backgroundImage: mapSnapshot ? `url(${mapSnapshot})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: mapSnapshot ? undefined : "rgba(0,0,0,0.3)",
      }}
    >
      {children}
    </div>
  );
}

export default function PhotoLayoutEditor({ location, onClose }: PhotoLayoutEditorProps) {
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const setPhotoLayout = useProjectStore((s) => s.setPhotoLayout);
  const { map } = useMap();
  const layout = location.photoLayout ?? { mode: "auto" as const };

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

  // Compute fitted preview container style
  const previewContainerStyle = useMemo<React.CSSProperties>(() => {
    if (viewportRatio === "free" || !panelSize) {
      return { width: "100%", height: "100%" };
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
    return { width: `${w}px`, height: `${h}px` };
  }, [viewportRatio, panelSize, previewAspect]);

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

  const layoutPreviewNode = (
    <PhotoOverlay
      photos={orderedPhotos}
      visible={true}
      photoLayout={layout}
      opacity={1}
      containerMode="parent"
    />
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
          <div className="shrink-0 border-t border-gray-100 bg-white">
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

            {/* Photo thumbnails — horizontal scroll */}
            <div className="px-4 pb-3 overflow-x-auto">
              <div className="flex gap-2">
                {orderedPhotos.map((photo, i) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhotoIndex(i)}
                    aria-label={`Select photo ${i + 1}${selectedPhotoIndex === i ? " (selected)" : ""}`}
                    className={`shrink-0 w-[60px] h-[60px] rounded-lg overflow-hidden transition-all ${
                      selectedPhotoIndex === i
                        ? "ring-2 ring-indigo-500 ring-offset-2"
                        : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={`Photo ${i + 1} thumbnail`}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%` }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
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
          className="hidden md:flex flex-col bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
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

            {/* CENTER — Live preview with map background */}
            <div ref={desktopPreviewRef} className="flex-1 bg-gray-100 flex items-center justify-center p-6">
              <PreviewWithMapBackground mapSnapshot={mapSnapshot} previewContainerStyle={previewContainerStyle}>
                {layoutPreviewNode}
              </PreviewWithMapBackground>
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
                    onClick={() => setSelectedPhotoIndex(i)}
                    aria-label={`Select photo ${i + 1}${selectedPhotoIndex === i ? " (selected)" : ""}`}
                    className={`w-full aspect-square rounded-lg overflow-hidden transition-all ${
                      selectedPhotoIndex === i
                        ? "ring-2 ring-indigo-500 ring-offset-2"
                        : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={`Photo ${i + 1} thumbnail`}
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
    </AnimatePresence>,
    document.body,
  );
}
