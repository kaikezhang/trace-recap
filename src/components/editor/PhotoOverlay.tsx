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
          <div className="flex gap-4 px-8">
            {photos.slice(0, 3).map((photo, i) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.8, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: i * 0.1,
                }}
                className="rounded-xl bg-white shadow-2xl overflow-hidden"
                style={{
                  rotate: i === 0 ? -3 : i === 2 ? 3 : 0,
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || ""}
                  className="w-64 h-44 object-cover"
                />
                {photo.caption && (
                  <p className="px-3 py-2 text-sm text-gray-700">
                    {photo.caption}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
