import type { AlbumStyle } from "@/types";

export interface AlbumStyleConfig {
  id: AlbumStyle;
  label: string;
  pageColor: string;
  noiseBaseFrequency: number;
  noiseOctaves: number;
  noiseOpacity: number;
  noiseBlendColor?: string;
  spineColor: string;
  spineWidth: number;
  spineGoldAccent: boolean;
  spineStitched: boolean;
  spineSpiral: boolean;
  borderColor: string;
  borderWidth: number;
  shadow: string;
  borderRadius: number;
  pagePadding: number;
  gridGap: number;
  swatchColors: [string, string];
}

export interface GridCell {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export const ALBUM_STYLE_CONFIGS: AlbumStyleConfig[] = [
  {
    id: "vintage-leather",
    label: "Vintage Leather",
    pageColor: "#f5e6c8",
    noiseBaseFrequency: 0.65,
    noiseOctaves: 4,
    noiseOpacity: 0.06,
    noiseBlendColor: "#8b6914",
    spineColor: "#5c3a1e",
    spineWidth: 12,
    spineGoldAccent: false,
    spineStitched: true,
    spineSpiral: false,
    borderColor: "#6b4226",
    borderWidth: 4,
    shadow:
      "0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1), 0 16px 32px rgba(0,0,0,0.15)",
    borderRadius: 6,
    pagePadding: 10,
    gridGap: 4,
    swatchColors: ["#f5e6c8", "#5c3a1e"],
  },
  {
    id: "japanese-minimal",
    label: "Japanese Minimal",
    pageColor: "#faf8f5",
    noiseBaseFrequency: 0.9,
    noiseOctaves: 2,
    noiseOpacity: 0.03,
    spineColor: "#d4cfc7",
    spineWidth: 6,
    spineGoldAccent: false,
    spineStitched: false,
    spineSpiral: false,
    borderColor: "#e8e4de",
    borderWidth: 1,
    shadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
    borderRadius: 4,
    pagePadding: 12,
    gridGap: 4,
    swatchColors: ["#faf8f5", "#d4cfc7"],
  },
  {
    id: "classic-hardcover",
    label: "Classic Hardcover",
    pageColor: "#fffef9",
    noiseBaseFrequency: 0.8,
    noiseOctaves: 3,
    noiseOpacity: 0.04,
    spineColor: "#1a1a2e",
    spineWidth: 10,
    spineGoldAccent: true,
    spineStitched: false,
    spineSpiral: false,
    borderColor: "#1a1a2e",
    borderWidth: 3,
    shadow:
      "0 4px 8px rgba(0,0,0,0.12), 0 12px 24px rgba(0,0,0,0.15), 0 24px 48px rgba(0,0,0,0.1)",
    borderRadius: 3,
    pagePadding: 10,
    gridGap: 4,
    swatchColors: ["#fffef9", "#1a1a2e"],
  },
  {
    id: "travel-scrapbook",
    label: "Travel Scrapbook",
    pageColor: "#d4a574",
    noiseBaseFrequency: 0.5,
    noiseOctaves: 5,
    noiseOpacity: 0.1,
    noiseBlendColor: "#654321",
    spineColor: "#555555",
    spineWidth: 16,
    spineGoldAccent: false,
    spineStitched: false,
    spineSpiral: true,
    borderColor: "transparent",
    borderWidth: 0,
    shadow: "0 3px 12px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08)",
    borderRadius: 2,
    pagePadding: 8,
    gridGap: 3,
    swatchColors: ["#d4a574", "#555555"],
  },
];

export function getAlbumStyleConfig(style: AlbumStyle): AlbumStyleConfig {
  return ALBUM_STYLE_CONFIGS.find((config) => config.id === style) ?? ALBUM_STYLE_CONFIGS[0];
}

export function computeAlbumPageGrid(
  photoCount: number,
): { rows: number; cols: number; cells: GridCell[] } {
  if (photoCount <= 0) {
    return { rows: 1, cols: 1, cells: [] };
  }

  if (photoCount === 1) {
    return {
      rows: 1,
      cols: 1,
      cells: [{ row: 1, col: 1, rowSpan: 1, colSpan: 1 }],
    };
  }

  if (photoCount === 2) {
    return {
      rows: 2,
      cols: 1,
      cells: [
        { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      ],
    };
  }

  if (photoCount === 3) {
    return {
      rows: 2,
      cols: 2,
      cells: [
        { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
        { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
        { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      ],
    };
  }

  const rows = Math.ceil(photoCount / 2);
  const cells: GridCell[] = [];

  for (let index = 0; index < photoCount; index += 1) {
    cells.push({
      row: Math.floor(index / 2) + 1,
      col: (index % 2) + 1,
      rowSpan: 1,
      colSpan: 1,
    });
  }

  return { rows, cols: 2, cells };
}

export function splitPhotosAcrossPages(totalCount: number): {
  left: number;
  right: number;
} {
  return {
    left: Math.ceil(totalCount / 2),
    right: Math.floor(totalCount / 2),
  };
}
