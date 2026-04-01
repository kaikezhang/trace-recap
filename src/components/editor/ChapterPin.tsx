"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Location } from "@/types";

export type ChapterPinState =
  | "future"
  | "album-open"
  | "album-collecting"
  | "album-closed"
  | "visited";

interface ChapterPinProps {
  location: Location;
  state: ChapterPinState;
  /** Screen-space position from map.project() */
  position: { x: number; y: number };
}

const SPRING_TRANSITION = {
  type: "spring" as const,
  stiffness: 260,
  damping: 24,
};

const VISITED_TRANSITION = {
  duration: 1.35,
  ease: [0.22, 1, 0.36, 1] as const,
};

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
      className={`flex max-w-[112px] items-center justify-center gap-1 text-center font-medium text-stone-700 drop-shadow-sm ${
        compact ? "text-[10px]" : "text-[11px]"
      }`}
    >
      {emoji && <span className="shrink-0 text-xs leading-none">{emoji}</span>}
      <span className="truncate">{title}</span>
    </span>
  );
}

function OpenAlbum({
  location,
  collecting,
}: {
  location: Location;
  collecting: boolean;
}) {
  const coverPhoto = location.photos[0]?.url;
  const stackCount = Math.min(Math.max(location.photos.length, 1), 4);

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <motion.div
        layout
        className="relative"
        animate={
          collecting
            ? {
                rotate: -2,
                y: [0, -2, 0],
                scale: [1, 1.02, 1],
              }
            : {
                rotate: -4,
                y: 0,
                scale: 1,
              }
        }
        transition={
          collecting
            ? {
                duration: 0.5,
                ease: [0.4, 0, 0.2, 1],
              }
            : SPRING_TRANSITION
        }
      >
        <div className="relative h-[60px] w-[84px] rounded-[20px] bg-gradient-to-br from-stone-100 via-white to-stone-200 shadow-[0_18px_30px_rgba(28,25,23,0.18)]">
          <div className="absolute inset-y-[9px] left-[10px] right-1/2 rounded-[14px] border border-stone-200/80 bg-gradient-to-br from-white via-stone-50 to-stone-100 shadow-inner" />
          <div className="absolute inset-y-[9px] right-[10px] left-1/2 rounded-[14px] border border-stone-200/80 bg-gradient-to-br from-white via-stone-50 to-stone-100 shadow-inner" />
          <div className="absolute inset-y-[5px] left-1/2 w-[8px] -translate-x-1/2 rounded-full bg-gradient-to-b from-stone-300 via-stone-200 to-stone-400 opacity-80" />

          {coverPhoto ? (
            <>
              <div className="absolute left-[16px] top-[16px] h-[22px] w-[20px] overflow-hidden rounded-[7px] border border-white/90 bg-white shadow-sm">
                <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="absolute right-[16px] top-[14px] h-[26px] w-[24px] overflow-hidden rounded-[8px] border border-white/90 bg-white shadow-sm">
                <img src={coverPhoto} alt="" className="h-full w-full object-cover opacity-90" />
              </div>
            </>
          ) : (
            <div className="absolute inset-x-0 top-[18px] text-center text-lg leading-none">
              {location.chapterEmoji || "📍"}
            </div>
          )}

          <div className="absolute bottom-[10px] left-[15px] right-[15px] h-[2px] rounded-full bg-stone-200/90" />
          <div className="absolute bottom-[16px] left-[15px] right-[24px] h-[2px] rounded-full bg-stone-200/80" />

          <AnimatePresence initial={false}>
            {collecting &&
              Array.from({ length: stackCount }).map((_, index) => (
                <motion.div
                  key={`collecting-sheet-${index}`}
                  initial={{
                    opacity: 0,
                    scale: 0.6,
                    x: 12 + index * 4,
                    y: -10 - index * 2,
                    rotate: index % 2 === 0 ? -8 : 8,
                  }}
                  animate={{
                    opacity: 0.88 - index * 0.14,
                    scale: 1,
                    x: 7 + index * 4,
                    y: 3 + index * 2,
                    rotate: index % 2 === 0 ? -6 : 6,
                  }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{
                    duration: 0.28,
                    delay: index * 0.06,
                    ease: [0.2, 0.9, 0.2, 1],
                  }}
                  className="absolute top-[8px] h-[18px] w-[14px] rounded-[5px] border border-white/90 bg-white/85 shadow-sm"
                />
              ))}
          </AnimatePresence>
        </div>
      </motion.div>
      <PinLabel emoji={location.chapterEmoji} title={location.chapterTitle || location.name} />
    </div>
  );
}

function ClosedAlbum({ location }: { location: Location }) {
  const coverPhoto = location.photos[0]?.url;

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <motion.div
        layout
        className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/75 bg-stone-100 shadow-[0_16px_28px_rgba(15,23,42,0.22)]"
        initial={{ scale: 0.88, rotate: -8, y: -4 }}
        animate={{ scale: 1, rotate: -3, y: 0 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {coverPhoto ? (
          <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 via-stone-50 to-stone-300 text-lg">
            {location.chapterEmoji || "📍"}
          </div>
        )}
        <div className="absolute inset-y-0 left-0 w-[8px] bg-gradient-to-r from-stone-900/28 to-transparent" />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/60" />
        {location.chapterEmoji && (
          <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1 py-0.5 text-[10px] leading-none text-white shadow-sm">
            {location.chapterEmoji}
          </div>
        )}
      </motion.div>
      <PinLabel
        compact
        emoji={location.chapterEmoji}
        title={location.chapterTitle || location.name}
      />
    </div>
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
  position,
}: ChapterPinProps) {
  if (state === "future") return null;

  const isVisited = state === "visited";

  return (
    <motion.div
      layout
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{
        scale: isVisited ? 0.72 : 1,
        opacity: isVisited ? 0.5 : 1,
        y: isVisited ? 8 : 0,
      }}
      transition={isVisited ? VISITED_TRANSITION : SPRING_TRANSITION}
      className="absolute pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%)",
        zIndex: isVisited ? 5 : 15,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -4 }}
          transition={isVisited ? VISITED_TRANSITION : SPRING_TRANSITION}
          className="flex flex-col items-center"
        >
          {(state === "album-open" || state === "album-collecting") && (
            <>
              <OpenAlbum location={location} collecting={state === "album-collecting"} />
              <div className="mt-1 h-2 w-px bg-stone-400/55" />
            </>
          )}

          {state === "album-closed" && (
            <>
              <ClosedAlbum location={location} />
              <div className="mt-1 h-2 w-px bg-stone-400/55" />
            </>
          )}

          {state === "visited" && <VisitedPin location={location} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
