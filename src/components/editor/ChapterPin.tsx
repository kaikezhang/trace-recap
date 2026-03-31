"use client";

import { motion } from "framer-motion";
import type { Location } from "@/types";

export type ChapterPinState = "active" | "visited" | "future";

interface ChapterPinProps {
  location: Location;
  state: ChapterPinState;
  /** Screen-space position from map.project() */
  position: { x: number; y: number };
}

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 22,
};

export default function ChapterPin({
  location,
  state,
  position,
}: ChapterPinProps) {
  if (state === "future") return null;

  const title = location.chapterTitle || location.name;
  const coverPhoto = location.photos[0]?.url;
  const emoji = location.chapterEmoji;

  if (state === "visited") {
    return (
      <motion.div
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 0.4 }}
        className="absolute pointer-events-none"
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -100%)",
          zIndex: 5,
        }}
      >
        <div className="flex flex-col items-center gap-0.5">
          {/* Thumbnail */}
          <div className="relative">
            {coverPhoto ? (
              <img
                src={coverPhoto}
                alt=""
                className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-sm shadow-sm">
                {emoji || "📍"}
              </div>
            )}
          </div>
          {/* Title */}
          <span className="max-w-[80px] truncate text-center text-[10px] font-medium text-gray-700 drop-shadow-sm">
            {title}
          </span>
        </div>
      </motion.div>
    );
  }

  // Active state
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springTransition}
      className="absolute pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%)",
        zIndex: 15,
      }}
    >
      <div className="flex max-w-[200px] gap-2.5 rounded-lg border border-white/20 bg-white/80 p-2 shadow-md backdrop-blur-sm">
        {/* Cover photo */}
        <div className="relative shrink-0">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt=""
              className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-lg shadow-sm">
              {emoji || "📍"}
            </div>
          )}
          {/* Emoji stamp */}
          {emoji && coverPhoto && (
            <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">
              {emoji}
            </span>
          )}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-sm font-bold leading-tight text-gray-900">
            {title}
          </p>
          {location.chapterDate && (
            <p className="truncate text-xs leading-tight text-gray-500">
              {location.chapterDate}
            </p>
          )}
          {location.chapterNote && (
            <p className="truncate text-xs leading-tight text-gray-600">
              {location.chapterNote}
            </p>
          )}
        </div>
      </div>
      {/* Pin tail */}
      <div className="mx-auto h-2 w-px bg-gray-300" />
    </motion.div>
  );
}
