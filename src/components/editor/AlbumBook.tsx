"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AlbumStyle, Photo } from "@/types";
import {
  computeAlbumPageGrid,
  getAlbumStyleConfig,
  splitPhotosAcrossPages,
  type AlbumStyleConfig,
} from "@/lib/albumStyles";
import PaperTexture from "./PaperTexture";

interface AlbumBookProps {
  albumStyle: AlbumStyle;
  photos: Photo[];
  showPhotos: boolean;
  collecting: boolean;
}

function Spine({ config }: { config: AlbumStyleConfig }) {
  if (config.spineSpiral) {
    return (
      <div
        className="absolute inset-y-0 left-1/2 z-10 -translate-x-1/2"
        style={{ width: config.spineWidth }}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent 6px,
              ${config.spineColor} 6px,
              ${config.spineColor} 10px,
              transparent 10px,
              transparent 16px
            )`,
            backgroundSize: `${config.spineWidth}px 16px`,
            borderRadius: "999px",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-y-[4px] left-1/2 z-10 -translate-x-1/2 rounded-full"
      style={{
        width: config.spineWidth,
        backgroundColor: config.spineColor,
        ...(config.spineStitched
          ? { borderRight: "2px dashed rgba(255,255,255,0.3)" }
          : {}),
      }}
    >
      {config.spineGoldAccent ? (
        <div
          className="absolute inset-y-1 left-1/2 -translate-x-1/2"
          style={{ width: 1, backgroundColor: "#c9a84c" }}
        />
      ) : null}
    </div>
  );
}

function PhotoGrid({
  photos,
  showPhotos,
  config,
}: {
  photos: Photo[];
  showPhotos: boolean;
  config: AlbumStyleConfig;
}) {
  const grid = useMemo(() => computeAlbumPageGrid(photos.length), [photos.length]);

  if (photos.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 opacity-30">
        <div
          className="h-[2px] w-3/4 rounded-full"
          style={{ backgroundColor: config.spineColor, opacity: 0.3 }}
        />
        <div
          className="h-[2px] w-1/2 rounded-full"
          style={{ backgroundColor: config.spineColor, opacity: 0.2 }}
        />
      </div>
    );
  }

  return (
    <div
      className="h-full w-full"
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gap: config.gridGap,
      }}
    >
      {grid.cells.map((cell, index) => {
        const photo = photos[index];

        if (!photo) {
          return null;
        }

        return (
          <div
            key={photo.id}
            className="relative overflow-hidden rounded-sm bg-black/5"
            style={{
              gridRow: `${cell.row} / span ${cell.rowSpan}`,
              gridColumn: `${cell.col} / span ${cell.colSpan}`,
            }}
          >
            {showPhotos ? (
              <motion.img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%`,
                }}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.12,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Page({
  align,
  photos,
  showPhotos,
  config,
}: {
  align: "left" | "right";
  photos: Photo[];
  showPhotos: boolean;
  config: AlbumStyleConfig;
}) {
  return (
    <div
      className={`absolute inset-y-0 overflow-hidden ${align === "left" ? "left-0 right-1/2" : "left-1/2 right-0"}`}
      style={{ padding: config.pagePadding }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: Math.max(config.borderRadius - 1, 0),
          backgroundColor: config.pageColor,
          boxShadow:
            align === "left"
              ? "inset -10px 0 18px rgba(0,0,0,0.05)"
              : "inset 10px 0 18px rgba(0,0,0,0.05)",
        }}
      >
        <PhotoGrid photos={photos} showPhotos={showPhotos} config={config} />
      </div>
    </div>
  );
}

export default function AlbumBook({
  albumStyle,
  photos,
  showPhotos,
  collecting,
}: AlbumBookProps) {
  const config = useMemo(() => getAlbumStyleConfig(albumStyle), [albumStyle]);
  const split = useMemo(() => splitPhotosAcrossPages(photos.length), [photos.length]);
  const leftPhotos = useMemo(() => photos.slice(0, split.left), [photos, split.left]);
  const rightPhotos = useMemo(() => photos.slice(split.left), [photos, split.left]);

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0.8 }}
      className="relative"
      animate={
        collecting
          ? { rotate: -1.5, y: [0, -3, 0], scale: [1, 1.015, 1] }
          : { rotate: -3, y: 0, scale: 1 }
      }
      transition={
        collecting
          ? { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
          : { type: "spring", stiffness: 260, damping: 24 }
      }
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: "min(75vw, 420px)",
          aspectRatio: "5 / 3",
          borderRadius: config.borderRadius,
          border:
            config.borderWidth > 0
              ? `${config.borderWidth}px solid ${config.borderColor}`
              : undefined,
          boxShadow: config.shadow,
          backgroundColor: config.pageColor,
        }}
      >
        <PaperTexture
          baseFrequency={config.noiseBaseFrequency}
          numOctaves={config.noiseOctaves}
          opacity={config.noiseOpacity}
          blendColor={config.noiseBlendColor}
        />

        {config.id === "classic-hardcover" ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              borderRadius: "inherit",
              boxShadow: "inset 0 0 0 1px rgba(201,168,76,0.25)",
            }}
          />
        ) : null}

        <Page align="left" photos={leftPhotos} showPhotos={showPhotos} config={config} />
        <Page align="right" photos={rightPhotos} showPhotos={showPhotos} config={config} />
        <Spine config={config} />
      </div>
    </motion.div>
  );
}
