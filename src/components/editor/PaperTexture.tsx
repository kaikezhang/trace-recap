"use client";

import { useId } from "react";

interface PaperTextureProps {
  baseFrequency: number;
  numOctaves: number;
  opacity: number;
  blendColor?: string;
  className?: string;
}

export default function PaperTexture({
  baseFrequency,
  numOctaves,
  opacity,
  blendColor,
  className,
}: PaperTextureProps) {
  const filterId = useId().replace(/:/g, "");

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`.trim()}
      style={{ borderRadius: "inherit" }}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={baseFrequency}
            numOctaves={numOctaves}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={opacity} />
      </svg>
      {blendColor ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: blendColor,
            mixBlendMode: "multiply",
            opacity: 0.15,
          }}
        />
      ) : null}
    </div>
  );
}
