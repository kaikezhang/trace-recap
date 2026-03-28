"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Photo } from "@/types";

interface PhotoOverlayProps {
  photos: Photo[];
  visible: boolean;
}

export default function PhotoOverlay({ photos, visible }: PhotoOverlayProps) {
  return (
    <AnimatePresence>
      {visible && photos.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        >
          <div className="flex flex-wrap gap-3 px-4 justify-center items-center max-w-[95vw] max-h-[80vh]">
            {photos.map((photo, i) => {
              // Smart sizing based on photo count
              const n = photos.length;
              const sizeClass =
                n === 1 ? "max-w-[70vw] max-h-[65vh]" :
                n === 2 ? "max-w-[42vw] max-h-[55vh]" :
                n === 3 ? "max-w-[30vw] max-h-[50vh]" :
                n === 4 ? "max-w-[28vw] max-h-[38vh]" :
                           "max-w-[24vw] max-h-[35vh]";

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
                    rotate: n <= 3
                      ? (i === 0 ? -3 : i === n - 1 ? 3 : 0)
                      : (i % 2 === 0 ? -2 : 2),
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || ""}
                    className={`${sizeClass} object-contain`}
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
