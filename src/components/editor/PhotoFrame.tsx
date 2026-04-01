"use client";

import type { CSSProperties, ReactNode } from "react";
import { getPhotoFrameRotation, getPhotoFrameStyleConfig } from "@/lib/frameStyles";
import { cn } from "@/lib/utils";
import type { PhotoFrameStyle } from "@/types";

interface PhotoFrameProps {
  frameStyle: PhotoFrameStyle;
  photoIndex: number;
  caption?: string;
  className?: string;
  mediaClassName?: string;
  style?: CSSProperties;
  mediaStyle?: CSSProperties;
  footer?: ReactNode;
  children: ReactNode;
}

function FilmStripLayer({
  position,
  height,
  inset,
  color,
  perforation,
}: {
  position: "top" | "bottom";
  height: string;
  inset: string;
  color: string;
  perforation: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 right-0 overflow-hidden"
      style={{
        [position]: 0,
        height,
        backgroundColor: color,
      }}
    >
      <div
        className="absolute inset-y-[22%]"
        style={{
          left: inset,
          right: inset,
          backgroundImage: perforation,
          backgroundSize: "22px 100%",
        }}
      />
    </div>
  );
}

export default function PhotoFrame({
  frameStyle,
  photoIndex,
  caption,
  className,
  mediaClassName,
  style,
  mediaStyle,
  footer,
  children,
}: PhotoFrameProps) {
  const config = getPhotoFrameStyleConfig(frameStyle);
  const rotation = getPhotoFrameRotation(frameStyle, photoIndex);
  const trimmedCaption = caption?.trim();

  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{
        transform: rotation === 0 ? undefined : `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        ...style,
      }}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden"
        style={{
          padding: config.framePadding,
          borderRadius: config.outerBorderRadius,
          background: config.frameBackground,
          boxShadow: config.frameShadow,
        }}
      >
        {frameStyle === "film-strip" &&
        config.filmStripHeight &&
        config.filmStripInset &&
        config.filmStripColor &&
        config.filmPerforation ? (
          <>
            <FilmStripLayer
              position="top"
              height={config.filmStripHeight}
              inset={config.filmStripInset}
              color={config.filmStripColor}
              perforation={config.filmPerforation}
            />
            <FilmStripLayer
              position="bottom"
              height={config.filmStripHeight}
              inset={config.filmStripInset}
              color={config.filmStripColor}
              perforation={config.filmPerforation}
            />
          </>
        ) : null}

        <div
          className={cn("relative min-h-0 w-full flex-1 overflow-hidden", mediaClassName)}
          style={{
            borderRadius: config.mediaBorderRadius,
            ...mediaStyle,
          }}
        >
          {children}
          {config.vignetteShadow ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ boxShadow: config.vignetteShadow }}
            />
          ) : null}
        </div>

        {config.inlineCaption && trimmedCaption ? (
          <div
            className="flex items-center justify-center text-center"
            style={{
              minHeight: config.inlineCaptionMinHeight,
              padding: config.inlineCaptionPadding,
              fontFamily: config.inlineCaptionFontFamily,
              fontSize: config.inlineCaptionFontSize,
              color: config.inlineCaptionColor,
              letterSpacing: config.inlineCaptionLetterSpacing,
              lineHeight: 1.05,
            }}
          >
            <span className="line-clamp-2">{trimmedCaption}</span>
          </div>
        ) : null}

        {footer}
      </div>
    </div>
  );
}
