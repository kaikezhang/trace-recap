"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Photo } from "@/types";

interface PhotoOverlayProps {
  photos: Photo[];
  visible: boolean;
}

interface PhotoWithDimensions extends Photo {
  width: number;
  height: number;
  aspect: number; // width / height — >1 = landscape, <1 = portrait
}

function usePhotoDimensions(photos: Photo[]): PhotoWithDimensions[] {
  const [dims, setDims] = useState<PhotoWithDimensions[]>([]);

  useEffect(() => {
    if (photos.length === 0) {
      setDims([]);
      return;
    }

    const results: PhotoWithDimensions[] = [];
    let loaded = 0;

    photos.forEach((photo, i) => {
      const img = new Image();
      img.onload = () => {
        results[i] = {
          ...photo,
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspect: img.naturalWidth / img.naturalHeight,
        };
        loaded++;
        if (loaded === photos.length) {
          setDims([...results]);
        }
      };
      img.onerror = () => {
        results[i] = { ...photo, width: 400, height: 300, aspect: 4 / 3 };
        loaded++;
        if (loaded === photos.length) {
          setDims([...results]);
        }
      };
      img.src = photo.url;
    });
  }, [photos]);

  return dims;
}

function getLayoutStyle(
  photo: PhotoWithDimensions,
  index: number,
  total: number,
  allPhotos: PhotoWithDimensions[]
): { maxWidth: string; maxHeight: string } {
  const isPortrait = photo.aspect < 0.85;
  const isLandscape = photo.aspect > 1.2;

  if (total === 1) {
    // Single photo: fill most of the screen
    if (isPortrait) return { maxWidth: "45vw", maxHeight: "70vh" };
    if (isLandscape) return { maxWidth: "75vw", maxHeight: "55vh" };
    return { maxWidth: "60vw", maxHeight: "60vh" };
  }

  if (total === 2) {
    const otherAspect = allPhotos[1 - index]?.aspect ?? 1;
    const bothPortrait = isPortrait && otherAspect < 0.85;
    const bothLandscape = isLandscape && otherAspect > 1.2;

    if (bothPortrait) {
      // Two portraits side by side
      return { maxWidth: "30vw", maxHeight: "65vh" };
    }
    if (bothLandscape) {
      // Two landscapes stacked
      return { maxWidth: "55vw", maxHeight: "35vh" };
    }
    // Mixed: each gets moderate space
    if (isPortrait) return { maxWidth: "28vw", maxHeight: "60vh" };
    return { maxWidth: "45vw", maxHeight: "45vh" };
  }

  if (total === 3) {
    if (isPortrait) return { maxWidth: "22vw", maxHeight: "55vh" };
    if (isLandscape) return { maxWidth: "30vw", maxHeight: "40vh" };
    return { maxWidth: "28vw", maxHeight: "45vh" };
  }

  if (total === 4) {
    if (isPortrait) return { maxWidth: "22vw", maxHeight: "42vh" };
    if (isLandscape) return { maxWidth: "28vw", maxHeight: "32vh" };
    return { maxWidth: "25vw", maxHeight: "36vh" };
  }

  // 5 photos
  if (isPortrait) return { maxWidth: "18vw", maxHeight: "38vh" };
  if (isLandscape) return { maxWidth: "24vw", maxHeight: "28vh" };
  return { maxWidth: "20vw", maxHeight: "32vh" };
}

export default function PhotoOverlay({ photos, visible }: PhotoOverlayProps) {
  const photosWithDims = usePhotoDimensions(photos);

  // Don't render until dimensions are loaded
  const ready = photosWithDims.length === photos.length && photos.length > 0;

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
          <div className="flex flex-wrap gap-3 px-4 justify-center items-center max-w-[95vw] max-h-[85vh]">
            {photosWithDims.map((photo, i) => {
              const n = photosWithDims.length;
              const style = getLayoutStyle(photo, i, n, photosWithDims);

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
                    rotate:
                      n <= 3
                        ? i === 0
                          ? -3
                          : i === n - 1
                          ? 3
                          : 0
                        : i % 2 === 0
                        ? -2
                        : 2,
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || ""}
                    className="object-contain"
                    style={{
                      maxWidth: style.maxWidth,
                      maxHeight: style.maxHeight,
                    }}
                  />
                  {photo.caption && (
                    <p className="px-3 py-2 text-sm text-gray-700">
                      {photo.caption}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
