"use client";

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Location } from "@/types";
import { useUIStore } from "@/stores/uiStore";
import AlbumBook from "./AlbumBook";

export type ChapterPinState =
  | "future"
  | "album-open"
  | "album-collecting"
  | "visited";

interface ChapterPinProps {
  location: Location;
  state: ChapterPinState;
  registerRef: (locationId: string, el: HTMLDivElement | null) => void;
}

const SPRING_TRANSITION = {
  type: "spring" as const,
  stiffness: 260,
  damping: 24,
};

const VISITED_TRANSITION = {
  duration: 3.6,
  ease: [0.22, 1, 0.36, 1] as const,
};

const ALBUM_EXIT_TRANSITION = {
  duration: 0.18,
  ease: [0.4, 0, 1, 1] as const,
};

const VISITED_ENTER_SCALE = 2.4;
const VISITED_FINAL_SCALE = 0.72;

const OPEN_ALBUM_GEOMETRY = {
  bodyHeight: 252,
  labelGap: 8,
  labelHeight: 18,
  tailGap: 4,
  tailHeight: 10,
};

const VISITED_GEOMETRY = {
  bodyHeight: 32,
  labelGap: 2,
  labelHeight: 14,
};

export function getChapterPinTargetOffset(
  state: Exclude<ChapterPinState, "future">,
): { x: number; y: number } {
  if (state === "visited") {
    return {
      x: 0,
      y:
        -(VISITED_GEOMETRY.labelHeight +
          VISITED_GEOMETRY.labelGap +
          VISITED_GEOMETRY.bodyHeight / 2),
    };
  }

  return {
    x: 0,
    y:
      -(OPEN_ALBUM_GEOMETRY.tailHeight +
        OPEN_ALBUM_GEOMETRY.tailGap +
        OPEN_ALBUM_GEOMETRY.labelHeight +
        OPEN_ALBUM_GEOMETRY.labelGap +
        OPEN_ALBUM_GEOMETRY.bodyHeight / 2),
  };
}

function PinLabel({
  emoji,
  title,
  compact = false,
}: {
  emoji?: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`flex max-w-[160px] items-center justify-center gap-1 text-center font-medium text-stone-700 drop-shadow-sm ${
        compact ? "text-[10px]" : "text-[13px]"
      }`}
    >
      {emoji && <span className="shrink-0 text-sm leading-none">{emoji}</span>}
      <span className="truncate">{title}</span>
    </span>
  );
}

function VisitedPin({ location }: { location: Location }) {
  const title = location.chapterTitle || location.name;
  const coverPhoto = location.photos[0]?.url;
  const emoji = location.chapterEmoji;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt=""
            className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-stone-100 text-sm shadow-sm">
            {emoji || "📍"}
          </div>
        )}
      </div>
      <PinLabel compact emoji={emoji} title={title} />
    </div>
  );
}

export default function ChapterPin({
  location,
  state,
  registerRef,
}: ChapterPinProps) {
  if (state === "future") return null;

  const isVisited = state === "visited";
  const albumStyle = useUIStore((store) => store.albumStyle);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      registerRef(location.id, el);
    },
    [location.id, registerRef],
  );

  return (
    <div
      ref={refCallback}
      className="pointer-events-none absolute left-0 top-0"
      style={{
        willChange: "transform",
        zIndex: isVisited ? 5 : 15,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isVisited ? (
          <motion.div
            key="visited"
            initial={{ opacity: 1, scale: VISITED_ENTER_SCALE, y: 0 }}
            animate={{
              opacity: 0.7,
              scale: VISITED_FINAL_SCALE,
              y: 8,
            }}
            transition={VISITED_TRANSITION}
            style={{ originX: 0.5, originY: 1 }}
            className="flex flex-col items-center"
          >
            <VisitedPin location={location} />
          </motion.div>
        ) : (
          <motion.div
            key="album"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: ALBUM_EXIT_TRANSITION }}
            transition={SPRING_TRANSITION}
            style={{ originX: 0.5, originY: 1 }}
            className="flex flex-col items-center"
          >
            <div className="relative flex flex-col items-center gap-2">
              <AlbumBook
                albumStyle={albumStyle}
                photos={location.photos}
                showPhotos={state === "album-collecting"}
                collecting={state === "album-collecting"}
              />
              <PinLabel
                emoji={location.chapterEmoji}
                title={location.chapterTitle || location.name}
              />
            </div>
            <div className="mt-1.5 h-2.5 w-px bg-stone-400/55" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
