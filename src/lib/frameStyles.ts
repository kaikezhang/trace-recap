import type { PhotoFrameStyle } from "@/types";

export interface PhotoFrameStyleConfig {
  id: PhotoFrameStyle;
  label: string;
  framePadding: string;
  frameBackground: string;
  frameShadow: string;
  outerBorderRadius: string;
  mediaBorderRadius: string;
  inlineCaption: boolean;
  inlineCaptionMinHeight?: string;
  inlineCaptionPadding?: string;
  inlineCaptionFontFamily?: string;
  inlineCaptionFontSize?: string;
  inlineCaptionColor?: string;
  inlineCaptionLetterSpacing?: string;
  vignetteShadow?: string;
  filmStripHeight?: string;
  filmStripInset?: string;
  filmStripColor?: string;
  filmPerforation?: string;
}

export const PHOTO_FRAME_STYLE_CONFIGS: Record<PhotoFrameStyle, PhotoFrameStyleConfig> = {
  polaroid: {
    id: "polaroid",
    label: "Polaroid",
    framePadding: "6% 6% 18% 6%",
    frameBackground: "#fffdf8",
    frameShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
    outerBorderRadius: "8px",
    mediaBorderRadius: "2px",
    inlineCaption: true,
    inlineCaptionMinHeight: "18%",
    inlineCaptionPadding: "0.35rem 0.75rem 0.15rem",
    inlineCaptionFontFamily: "var(--font-caveat), cursive",
    inlineCaptionFontSize: "clamp(0.65rem, 1vw, 1rem)",
    inlineCaptionColor: "rgba(15, 23, 42, 0.82)",
    inlineCaptionLetterSpacing: "0.02em",
  },
  borderless: {
    id: "borderless",
    label: "Borderless",
    framePadding: "0",
    frameBackground: "transparent",
    frameShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
    outerBorderRadius: "4px",
    mediaBorderRadius: "4px",
    inlineCaption: false,
    vignetteShadow: "inset 0 0 8px rgba(0,0,0,0.06)",
  },
  "film-strip": {
    id: "film-strip",
    label: "Film Strip",
    framePadding: "10% 6%",
    frameBackground: "#161616",
    frameShadow: "0 14px 30px rgba(0, 0, 0, 0.28)",
    outerBorderRadius: "10px",
    mediaBorderRadius: "2px",
    inlineCaption: false,
    filmStripHeight: "10%",
    filmStripInset: "8%",
    filmStripColor: "#111111",
    filmPerforation:
      "repeating-linear-gradient(90deg, transparent 0 8px, rgba(248,250,252,0.92) 8px 14px, transparent 14px 22px)",
  },
  "classic-border": {
    id: "classic-border",
    label: "Classic Border",
    framePadding: "5%",
    frameBackground: "#ffffff",
    frameShadow: "0 10px 22px rgba(15, 23, 42, 0.14)",
    outerBorderRadius: "4px",
    mediaBorderRadius: "2px",
    inlineCaption: false,
  },
  "rounded-card": {
    id: "rounded-card",
    label: "Rounded Card",
    framePadding: "4%",
    frameBackground: "#ffffff",
    frameShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
    outerBorderRadius: "12px",
    mediaBorderRadius: "10px",
    inlineCaption: false,
  },
};

export function getPhotoFrameStyleConfig(style: PhotoFrameStyle): PhotoFrameStyleConfig {
  return PHOTO_FRAME_STYLE_CONFIGS[style];
}

export function frameStyleUsesInlineCaption(style: PhotoFrameStyle): boolean {
  return PHOTO_FRAME_STYLE_CONFIGS[style].inlineCaption;
}

export function getPhotoFrameRotation(style: PhotoFrameStyle, photoIndex: number): number {
  if (style !== "polaroid") {
    return 0;
  }

  const seeded = Math.sin((photoIndex + 1) * 12.9898 + 78.233) * 43758.5453;
  const normalized = seeded - Math.floor(seeded);
  return Number((((normalized * 2) - 1) * 2).toFixed(2));
}
