"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Photo } from "@/types";

interface PhotoOverlayProps {
  photos: Photo[];
  visible: boolean;
}

interface PhotoMeta extends Photo {
  aspect: number; // w/h, >1 landscape, <1 portrait
}

function usePhotoDimensions(photos: Photo[]): PhotoMeta[] {
  const [dims, setDims] = useState<PhotoMeta[]>([]);

  useEffect(() => {
    if (photos.length === 0) { setDims([]); return; }
    const results: PhotoMeta[] = [];
    let loaded = 0;
    photos.forEach((photo, i) => {
      const img = new Image();
      img.onload = () => {
        results[i] = { ...photo, aspect: img.naturalWidth / img.naturalHeight };
        loaded++;
        if (loaded === photos.length) setDims([...results]);
      };
      img.onerror = () => {
        results[i] = { ...photo, aspect: 4 / 3 };
        loaded++;
        if (loaded === photos.length) setDims([...results]);
      };
      img.src = photo.url;
    });
  }, [photos]);
  return dims;
}

// Split photos into rows for optimal space usage
// Core idea: group portraits together and landscapes together into separate rows
function layoutRows(photos: PhotoMeta[]): PhotoMeta[][] {
  const n = photos.length;
  if (n <= 1) return [photos];

  const portraits = photos.filter(p => p.aspect < 0.9);
  const landscapes = photos.filter(p => p.aspect >= 0.9);

  // If all same orientation, split evenly into rows
  if (portraits.length === 0) {
    // All landscape
    if (n <= 3) return [photos];
    return [photos.slice(0, Math.ceil(n / 2)), photos.slice(Math.ceil(n / 2))];
  }
  if (landscapes.length === 0) {
    // All portrait — fit more per row since they're narrow
    if (n <= 4) return [photos];
    return [photos.slice(0, Math.ceil(n / 2)), photos.slice(Math.ceil(n / 2))];
  }

  // Mixed: always split by orientation — portraits in one row, landscapes in another
  // Put the larger group on top
  if (portraits.length >= landscapes.length) {
    return [portraits, landscapes];
  }
  return [landscapes, portraits];
}

// Size for a photo based on its row context
function getSize(photo: PhotoMeta, rowLen: number, totalRows: number): { maxW: string; maxH: string } {
  const isP = photo.aspect < 0.9;
  const isL = photo.aspect >= 0.9;
  const heightBudget = totalRows === 1 ? "70vh" : totalRows === 2 ? "42vh" : "35vh";

  if (rowLen === 1) {
    if (isP) return { maxW: "40vw", maxH: heightBudget };
    return { maxW: "80vw", maxH: heightBudget };
  }
  if (rowLen === 2) {
    if (isP) return { maxW: "30vw", maxH: heightBudget };
    return { maxW: "44vw", maxH: heightBudget };
  }
  if (rowLen === 3) {
    if (isP) return { maxW: "22vw", maxH: heightBudget };
    return { maxW: "30vw", maxH: heightBudget };
  }
  return { maxW: "22vw", maxH: heightBudget };
}

export default function PhotoOverlay({ photos, visible }: PhotoOverlayProps) {
  const metas = usePhotoDimensions(photos);
  const ready = metas.length === photos.length && photos.length > 0;

  const rows = ready ? layoutRows(metas) : [];
  let globalIndex = 0;

  return (
    <AnimatePresence>
      {visible && ready && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        >
          <div className="flex flex-col gap-3 items-center max-w-[95vw] max-h-[88vh]">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-3 justify-center items-center">
                {row.map((photo) => {
                  const i = globalIndex++;
                  const n = metas.length;
                  const size = getSize(photo, row.length, rows.length);
                  return (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.8, y: 40 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -20 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                        delay: i * 0.08,
                      }}
                      className="rounded-xl bg-white shadow-2xl overflow-hidden"
                      style={{
                        rotate: n <= 3 ? (i === 0 ? -2 : i === n - 1 ? 2 : 0) : (i % 2 === 0 ? -1.5 : 1.5),
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || ""}
                        className="object-contain"
                        style={{ maxWidth: size.maxW, maxHeight: size.maxH }}
                      />
                      {photo.caption && (
                        <p className="px-3 py-2 text-sm text-gray-700">{photo.caption}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
