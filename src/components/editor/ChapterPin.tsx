"use client";

import { useCallback, useRef } from "react";
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
  bodyHeight: 180,
  labelGap: 8,
  labelHeight: 18,
  tailGap: 4,
  tailHeight: 10,
};

const CLOSED_ALBUM_GEOMETRY = {
  bodyHeight: 180,
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

  const geometry =
    state === "album-closed" ? CLOSED_ALBUM_GEOMETRY : OPEN_ALBUM_GEOMETRY;

  return {
    x: 0,
    y:
      -(geometry.tailHeight +
        geometry.tailGap +
        geometry.labelHeight +
        geometry.labelGap +
        geometry.bodyHeight / 2),
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

/**
 * Open Album — 3x larger (252×180).
 * Starts blank, photos appear on pages during/after collecting.
 */
function OpenAlbum({
  location,
  collecting,
}: {
  location: Location;
  collecting: boolean;
}) {
  // Once collecting becomes true, photos stay visible even if collecting
  // flips back to false (prevents flash to blank album on state race)
  const hasCollectedRef = useRef(false);
  if (collecting) hasCollectedRef.current = true;
  const showPhotos = hasCollectedRef.current;

  const photos = location.photos;
  const leftPhoto = photos[0]?.url;
  const rightPhoto = photos[1]?.url ?? photos[0]?.url;
  const stackCount = Math.min(Math.max(photos.length, 1), 5);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <motion.div
        layout
        className="relative"
        animate={
          collecting
            ? {
                rotate: -1.5,
                y: [0, -3, 0],
                scale: [1, 1.015, 1],
              }
            : {
                rotate: -3,
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
        <div className="relative h-[180px] w-[252px] rounded-[28px] bg-gradient-to-br from-stone-100 via-white to-stone-200 shadow-[0_24px_48px_rgba(28,25,23,0.22)]">
          {/* Left page */}
          <div className="absolute inset-y-[14px] left-[16px] right-1/2 rounded-[18px] border border-stone-200/80 bg-gradient-to-br from-white via-stone-50 to-stone-100 shadow-inner overflow-hidden">
            {/* Photo on left page — stays once shown */}
            {leftPhoto && showPhotos && (
              <motion.img
                src={leftPhoto}
                alt=""
                className="h-full w-full object-cover"
                initial={{ opacity: 0, scale: 1.15 }}
                animate={{ opacity: 0.85, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            )}
          </div>
          {/* Right page */}
          <div className="absolute inset-y-[14px] left-1/2 right-[16px] rounded-[18px] border border-stone-200/80 bg-gradient-to-br from-white via-stone-50 to-stone-100 shadow-inner overflow-hidden">
            {/* Photo on right page — stays once shown */}
            {rightPhoto && showPhotos && (
              <motion.img
                src={rightPhoto}
                alt=""
                className="h-full w-full object-cover"
                initial={{ opacity: 0, scale: 1.15 }}
                animate={{ opacity: 0.85, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              />
            )}
          </div>
          {/* Spine */}
          <div className="absolute inset-y-[8px] left-1/2 w-[10px] -translate-x-1/2 rounded-full bg-gradient-to-b from-stone-300 via-stone-200 to-stone-400 opacity-80 z-10" />

          {/* Blank state: decorative lines + emoji (hidden once photos shown) */}
          {!showPhotos && (
            <>
              <div className="absolute bottom-[24px] left-[24px] right-[140px] h-[2.5px] rounded-full bg-stone-200/70" />
              <div className="absolute bottom-[34px] left-[24px] right-[160px] h-[2.5px] rounded-full bg-stone-200/60" />
              <div className="absolute bottom-[24px] left-[140px] right-[24px] h-[2.5px] rounded-full bg-stone-200/70" />
              <div className="absolute bottom-[34px] left-[140px] right-[40px] h-[2.5px] rounded-full bg-stone-200/60" />
              <div className="absolute inset-x-0 top-[50px] text-center text-4xl leading-none opacity-40">
                {location.chapterEmoji || "📍"}
              </div>
            </>
          )}

          {/* Collecting animation — photo sheets flying in */}
          <AnimatePresence initial={false}>
            {collecting &&
              Array.from({ length: stackCount }).map((_, index) => (
                <motion.div
                  key={`collecting-sheet-${index}`}
                  initial={{
                    opacity: 0,
                    scale: 0.5,
                    x: 30 + index * 10,
                    y: -20 - index * 5,
                    rotate: index % 2 === 0 ? -12 : 12,
                  }}
                  animate={{
                    opacity: 0.9 - index * 0.12,
                    scale: 1,
                    x: 18 + index * 10,
                    y: 10 + index * 5,
                    rotate: index % 2 === 0 ? -6 : 6,
                  }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{
                    duration: 0.32,
                    delay: index * 0.07,
                    ease: [0.2, 0.9, 0.2, 1],
                  }}
                  className="absolute top-[16px] h-[40px] w-[32px] rounded-[8px] border border-white/90 bg-white/85 shadow-sm"
                />
              ))}
          </AnimatePresence>
        </div>
      </motion.div>
      <PinLabel
        emoji={location.chapterEmoji}
        title={location.chapterTitle || location.name}
      />
    </div>
  );
}

/**
 * Closed Album — clean book cover, no photo. Brief hold before visited.
 */
function ClosedAlbum({ location }: { location: Location }) {
  return (
    <div className="relative flex flex-col items-center gap-2">
      <motion.div
        layout
        className="relative h-[180px] w-[252px] overflow-hidden rounded-[28px] border-2 border-white/80 bg-gradient-to-br from-stone-100 via-white to-stone-200 shadow-[0_24px_48px_rgba(15,23,42,0.25)]"
        initial={{ scaleX: 0.1, scaleY: 1.05, rotate: -4, opacity: 0.8 }}
        animate={{ scaleX: 1, scaleY: 1, rotate: -2, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Spine */}
        <div className="absolute inset-y-[8px] left-1/2 w-[10px] -translate-x-1/2 rounded-full bg-gradient-to-b from-stone-300 via-stone-200 to-stone-400 opacity-80" />
        {/* Centered emoji */}
        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-50">
          {location.chapterEmoji || "📍"}
        </div>
        {/* Inner ring */}
        <div className="absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/50" />
      </motion.div>
      <PinLabel
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
  registerRef,
}: ChapterPinProps) {
  if (state === "future") return null;

  const isVisited = state === "visited";

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
        {/* Group album states under one key so open→collecting→closed
            morphs smoothly without exit/enter bounce animations.
            The visited state gets its own single enter animation after
            the album fully fades away. */}
        {isVisited ? (
          <motion.div
            key="visited"
            initial={{ opacity: 0, scale: VISITED_ENTER_SCALE, y: 0 }}
            animate={{
              opacity: 0.5,
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
            {state === "album-closed" ? (
              <>
                <ClosedAlbum location={location} />
                <div className="mt-1.5 h-2.5 w-px bg-stone-400/55" />
              </>
            ) : (
              <>
                <OpenAlbum
                  location={location}
                  collecting={state === "album-collecting"}
                />
                <div className="mt-1.5 h-2.5 w-px bg-stone-400/55" />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
