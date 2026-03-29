import type { LayoutTemplate } from "@/types";

export interface PhotoRect {
  /** All values as fractions of container (0-1) */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees, only used in scatter mode
}

export interface PhotoMeta {
  id: string;
  aspect: number; // naturalWidth / naturalHeight
}

/**
 * Compute layout rects for N photos (1-9) based on their aspect ratios.
 * All returned values are fractions of the container (0-1).
 */
export function computeAutoLayout(
  photos: PhotoMeta[],
  containerAspect: number,
  gapPx: number = 8,
  containerWidthPx: number = 1000
): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];

  // Gap as fraction of container width
  const gap = gapPx / containerWidthPx;

  switch (n) {
    case 1:
      return layoutOne(photos, gap);
    case 2:
      return layoutTwo(photos, gap);
    case 3:
      return layoutThree(photos, gap);
    case 4:
      return layoutFour(gap);
    case 5:
      return layoutFive(gap);
    case 6:
      return layoutSix(containerAspect, gap);
    case 7:
      return layoutSeven(gap);
    case 8:
      return layoutEight(gap);
    case 9:
      return layoutNine(gap);
    default:
      // For >9 just use 3x3 grid with first 9
      return layoutNine(gap);
  }
}

/** 1 photo: centered. Landscape = full width; portrait = 60% width centered. */
function layoutOne(photos: PhotoMeta[], gap: number): PhotoRect[] {
  const isLandscape = photos[0].aspect >= 1;
  if (isLandscape) {
    const w = 1 - gap * 2;
    const h = w / photos[0].aspect;
    return [{ x: gap, y: (1 - h) / 2, width: w, height: Math.min(h, 1 - gap * 2) }];
  }
  // Portrait
  const w = 0.6;
  const h = Math.min(w / photos[0].aspect, 1 - gap * 2);
  const actualW = Math.min(w, h * photos[0].aspect);
  return [{ x: (1 - actualW) / 2, y: (1 - h) / 2, width: actualW, height: h }];
}

/** 2 photos: side by side if both landscape/square; stacked if both portrait; mixed: landscape top, portrait below. */
function layoutTwo(photos: PhotoMeta[], gap: number): PhotoRect[] {
  const isP0 = photos[0].aspect < 0.9;
  const isP1 = photos[1].aspect < 0.9;

  if (!isP0 && !isP1) {
    // Both landscape/square — side by side
    const w = (1 - gap * 3) / 2;
    const h = 0.7;
    return [
      { x: gap, y: (1 - h) / 2, width: w, height: h },
      { x: gap * 2 + w, y: (1 - h) / 2, width: w, height: h },
    ];
  }

  if (isP0 && isP1) {
    // Both portrait — stacked vertically
    const h = (1 - gap * 3) / 2;
    const w = 0.6;
    const xOff = (1 - w) / 2;
    return [
      { x: xOff, y: gap, width: w, height: h },
      { x: xOff, y: gap * 2 + h, width: w, height: h },
    ];
  }

  // Mixed: landscape on top, portrait below
  const landscapeIdx = isP0 ? 1 : 0;
  const portraitIdx = isP0 ? 0 : 1;
  const topH = 0.5 - gap;
  const botH = 0.5 - gap;
  const rects: PhotoRect[] = [];
  rects[landscapeIdx] = { x: gap, y: gap, width: 1 - gap * 2, height: topH };
  const botW = 0.5;
  rects[portraitIdx] = { x: (1 - botW) / 2, y: gap * 2 + topH, width: botW, height: botH };
  return rects;
}

/** 3 photos: 1 big left (60%) + 2 small right. If all portraits: 3 equal columns. */
function layoutThree(photos: PhotoMeta[], gap: number): PhotoRect[] {
  const allPortrait = photos.every((p) => p.aspect < 0.9);

  if (allPortrait) {
    // 3 equal columns
    const w = (1 - gap * 4) / 3;
    const h = 0.8;
    const yOff = (1 - h) / 2;
    return [
      { x: gap, y: yOff, width: w, height: h },
      { x: gap * 2 + w, y: yOff, width: w, height: h },
      { x: gap * 3 + w * 2, y: yOff, width: w, height: h },
    ];
  }

  // 1 big left (60%), 2 small right stacked
  const leftW = 0.6 - gap * 1.5;
  const rightW = 0.4 - gap * 1.5;
  const fullH = 1 - gap * 2;
  const rightH = (fullH - gap) / 2;

  return [
    { x: gap, y: gap, width: leftW, height: fullH },
    { x: gap * 2 + leftW, y: gap, width: rightW, height: rightH },
    { x: gap * 2 + leftW, y: gap * 2 + rightH, width: rightW, height: rightH },
  ];
}

/** 4 photos: 2x2 grid */
function layoutFour(gap: number): PhotoRect[] {
  const w = (1 - gap * 3) / 2;
  const h = (1 - gap * 3) / 2;
  return [
    { x: gap, y: gap, width: w, height: h },
    { x: gap * 2 + w, y: gap, width: w, height: h },
    { x: gap, y: gap * 2 + h, width: w, height: h },
    { x: gap * 2 + w, y: gap * 2 + h, width: w, height: h },
  ];
}

/** 5 photos: top row 2 (60% height), bottom row 3 (40% height) */
function layoutFive(gap: number): PhotoRect[] {
  const topH = 0.6 - gap * 1.5;
  const botH = 0.4 - gap * 1.5;
  const topW = (1 - gap * 3) / 2;
  const botW = (1 - gap * 4) / 3;

  return [
    { x: gap, y: gap, width: topW, height: topH },
    { x: gap * 2 + topW, y: gap, width: topW, height: topH },
    { x: gap, y: gap * 2 + topH, width: botW, height: botH },
    { x: gap * 2 + botW, y: gap * 2 + topH, width: botW, height: botH },
    { x: gap * 3 + botW * 2, y: gap * 2 + topH, width: botW, height: botH },
  ];
}

/** 6 photos: 2x3 or 3x2 depending on container aspect */
function layoutSix(containerAspect: number, gap: number): PhotoRect[] {
  if (containerAspect >= 1) {
    // Landscape container: 2 rows, 3 columns
    const w = (1 - gap * 4) / 3;
    const h = (1 - gap * 3) / 2;
    return [
      { x: gap, y: gap, width: w, height: h },
      { x: gap * 2 + w, y: gap, width: w, height: h },
      { x: gap * 3 + w * 2, y: gap, width: w, height: h },
      { x: gap, y: gap * 2 + h, width: w, height: h },
      { x: gap * 2 + w, y: gap * 2 + h, width: w, height: h },
      { x: gap * 3 + w * 2, y: gap * 2 + h, width: w, height: h },
    ];
  }
  // Portrait container: 3 rows, 2 columns
  const w = (1 - gap * 3) / 2;
  const h = (1 - gap * 4) / 3;
  return [
    { x: gap, y: gap, width: w, height: h },
    { x: gap * 2 + w, y: gap, width: w, height: h },
    { x: gap, y: gap * 2 + h, width: w, height: h },
    { x: gap * 2 + w, y: gap * 2 + h, width: w, height: h },
    { x: gap, y: gap * 3 + h * 2, width: w, height: h },
    { x: gap * 2 + w, y: gap * 3 + h * 2, width: w, height: h },
  ];
}

/** 7 photos: top row 3 (55% height), bottom row 4 (45% height) */
function layoutSeven(gap: number): PhotoRect[] {
  const topH = 0.55 - gap * 1.5;
  const botH = 0.45 - gap * 1.5;
  const topW = (1 - gap * 4) / 3;
  const botW = (1 - gap * 5) / 4;

  return [
    { x: gap, y: gap, width: topW, height: topH },
    { x: gap * 2 + topW, y: gap, width: topW, height: topH },
    { x: gap * 3 + topW * 2, y: gap, width: topW, height: topH },
    { x: gap, y: gap * 2 + topH, width: botW, height: botH },
    { x: gap * 2 + botW, y: gap * 2 + topH, width: botW, height: botH },
    { x: gap * 3 + botW * 2, y: gap * 2 + topH, width: botW, height: botH },
    { x: gap * 4 + botW * 3, y: gap * 2 + topH, width: botW, height: botH },
  ];
}

/** 8 photos: top 3, middle 3, bottom 2 (wider) */
function layoutEight(gap: number): PhotoRect[] {
  const rowH = (1 - gap * 4) / 3;
  const w3 = (1 - gap * 4) / 3;
  const w2 = (1 - gap * 3) / 2;

  return [
    { x: gap, y: gap, width: w3, height: rowH },
    { x: gap * 2 + w3, y: gap, width: w3, height: rowH },
    { x: gap * 3 + w3 * 2, y: gap, width: w3, height: rowH },
    { x: gap, y: gap * 2 + rowH, width: w3, height: rowH },
    { x: gap * 2 + w3, y: gap * 2 + rowH, width: w3, height: rowH },
    { x: gap * 3 + w3 * 2, y: gap * 2 + rowH, width: w3, height: rowH },
    { x: gap, y: gap * 3 + rowH * 2, width: w2, height: rowH },
    { x: gap * 2 + w2, y: gap * 3 + rowH * 2, width: w2, height: rowH },
  ];
}

/** 9 photos: 3x3 grid */
function layoutNine(gap: number): PhotoRect[] {
  const w = (1 - gap * 4) / 3;
  const h = (1 - gap * 4) / 3;
  const rects: PhotoRect[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      rects.push({
        x: gap + col * (w + gap),
        y: gap + row * (h + gap),
        width: w,
        height: h,
      });
    }
  }
  return rects;
}

/**
 * Simple seeded pseudo-random number generator.
 * Uses a hash of the input string to produce deterministic sequences.
 */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return ((h >>> 0) / 4294967296);
  };
}

/** Scatter: semi-random positions with rotation, like photos on a table */
function layoutScatter(photos: PhotoMeta[], gap: number): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];
  if (n === 1) {
    const w = 0.5;
    const h = 0.5;
    return [{ x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h, rotation: 0 }];
  }

  // Seed based on photo IDs for deterministic layout
  const seed = photos.map((p) => p.id).join(",");
  const rand = seededRandom(seed);

  // Base size: each photo gets roughly 1/sqrt(N) of the container
  const baseSize = Math.min(0.45, 1 / Math.sqrt(n));
  const margin = gap + 0.02; // keep away from edges

  const rects: PhotoRect[] = [];
  for (let i = 0; i < n; i++) {
    // Size variation: 80-110% of base
    const sizeScale = 0.8 + rand() * 0.3;
    const w = baseSize * sizeScale;
    const h = baseSize * sizeScale;

    // Random position within bounds
    const maxX = 1 - w - margin;
    const maxY = 1 - h - margin;
    const x = margin + rand() * Math.max(0, maxX - margin);
    const y = margin + rand() * Math.max(0, maxY - margin);

    // Random rotation between -8 and +8 degrees
    const rotation = (rand() - 0.5) * 16;

    rects.push({ x, y, width: w, height: h, rotation });
  }

  // Basic collision relaxation: nudge overlapping photos apart (3 passes)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const aCx = a.x + a.width / 2;
        const aCy = a.y + a.height / 2;
        const bCx = b.x + b.width / 2;
        const bCy = b.y + b.height / 2;

        const overlapX = (a.width + b.width) / 2 - Math.abs(aCx - bCx);
        const overlapY = (a.height + b.height) / 2 - Math.abs(aCy - bCy);

        // Only nudge if overlap > 30% of the smaller dimension
        const threshold = Math.min(a.width, b.width) * 0.3;
        if (overlapX > threshold && overlapY > threshold) {
          const dx = aCx < bCx ? -1 : 1;
          const dy = aCy < bCy ? -1 : 1;
          const nudge = 0.02;
          a.x += dx * nudge;
          a.y += dy * nudge;
          b.x -= dx * nudge;
          b.y -= dy * nudge;
        }
      }
    }
  }

  // Clamp all positions to keep within bounds
  for (const r of rects) {
    r.x = Math.max(margin, Math.min(r.x, 1 - r.width - margin));
    r.y = Math.max(margin, Math.min(r.y, 1 - r.height - margin));
  }

  return rects;
}

/**
 * Compute layout using a specific template.
 * For "auto" mode, delegates to computeAutoLayout.
 */
export function computeTemplateLayout(
  photos: PhotoMeta[],
  containerAspect: number,
  template: LayoutTemplate,
  gap?: number,
  containerWidthPx?: number,
  customProportions?: { rows?: number[]; cols?: number[] }
): PhotoRect[] {
  const gapPx = gap ?? 8;
  const widthPx = containerWidthPx ?? 1000;
  const g = gapPx / widthPx; // gap as fraction

  switch (template) {
    case "grid":
      return layoutGrid(photos.length, g, customProportions);
    case "hero":
      return layoutHero(photos.length, g, customProportions);
    case "masonry":
      return layoutMasonry(photos, g);
    case "filmstrip":
      return layoutFilmstrip(photos, g);
    case "scatter":
      return layoutScatter(photos, g);
    default:
      return computeAutoLayout(photos, containerAspect, gapPx, widthPx);
  }
}

/** Grid: equal-sized cells filling rows/columns, with optional custom proportions */
function layoutGrid(
  n: number,
  gap: number,
  customProportions?: { rows?: number[]; cols?: number[] }
): PhotoRect[] {
  if (n === 0) return [];
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);

  // Compute column widths from custom proportions or equal split
  const colWeights = customProportions?.cols?.slice(0, cols) ?? new Array(cols).fill(1);
  const totalColWeight = colWeights.reduce((s: number, w: number) => s + w, 0);
  const availW = 1 - gap * (cols + 1);
  const colWidths = colWeights.map((w: number) => (w / totalColWeight) * availW);

  // Compute row heights from custom proportions or equal split
  const rowWeights = customProportions?.rows?.slice(0, rows) ?? new Array(rows).fill(1);
  const totalRowWeight = rowWeights.reduce((s: number, w: number) => s + w, 0);
  const availH = 1 - gap * (rows + 1);
  const rowHeights = rowWeights.map((w: number) => (w / totalRowWeight) * availH);

  const rects: PhotoRect[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    let x = gap;
    for (let c = 0; c < col; c++) x += colWidths[c] + gap;
    let y = gap;
    for (let r = 0; r < row; r++) y += rowHeights[r] + gap;
    rects.push({
      x,
      y,
      width: colWidths[col],
      height: rowHeights[row],
    });
  }
  return rects;
}

/** Hero: first photo large (~60% area), remaining in smaller grid */
function layoutHero(
  n: number,
  gap: number,
  customProportions?: { rows?: number[]; cols?: number[] }
): PhotoRect[] {
  if (n === 0) return [];
  if (n === 1) {
    const w = 1 - gap * 2;
    const h = 1 - gap * 2;
    return [{ x: gap, y: gap, width: w, height: h }];
  }

  // Custom proportions: cols[0] = hero weight, cols[1] = right panel weight
  const colWeights = customProportions?.cols?.slice(0, 2) ?? [3, 2]; // default 60/40
  const totalColW = colWeights[0] + colWeights[1];
  const availW = 1 - gap * 3;
  const heroW = (colWeights[0] / totalColW) * availW;
  const heroH = 1 - gap * 2;
  const rightW = (colWeights[1] / totalColW) * availW;
  const remaining = n - 1;
  const rows = Math.min(remaining, 3);
  const cellH = (heroH - gap * (rows - 1)) / rows;

  const rects: PhotoRect[] = [
    { x: gap, y: gap, width: heroW, height: heroH },
  ];

  for (let i = 0; i < remaining; i++) {
    const row = i % rows;
    const col = Math.floor(i / rows);
    const colCount = Math.ceil(remaining / rows);
    const cellW = colCount > 1 ? (rightW - gap * (colCount - 1)) / colCount : rightW;
    rects.push({
      x: gap * 2 + heroW + col * (cellW + gap),
      y: gap + row * (cellH + gap),
      width: cellW,
      height: cellH,
    });
  }

  return rects;
}

/** Masonry: alternating tall and short photos in columns */
function layoutMasonry(photos: PhotoMeta[], gap: number): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];
  if (n === 1) {
    const w = 1 - gap * 2;
    const h = 1 - gap * 2;
    return [{ x: gap, y: gap, width: w, height: h }];
  }

  const cols = n <= 2 ? 2 : 3;
  const colW = (1 - gap * (cols + 1)) / cols;
  const colTops: number[] = new Array(cols).fill(gap);
  const rects: PhotoRect[] = new Array(n);

  for (let i = 0; i < n; i++) {
    // Pick the column with the smallest top
    let minCol = 0;
    for (let c = 1; c < cols; c++) {
      if (colTops[c] < colTops[minCol]) minCol = c;
    }
    // Alternate height: tall (0.5) for even indices, short (0.3) for odd
    const cellH = i % 2 === 0 ? 0.45 : 0.3;
    const x = gap + minCol * (colW + gap);
    const y = colTops[minCol];
    rects[i] = { x, y, width: colW, height: cellH };
    colTops[minCol] = y + cellH + gap;
  }

  // Normalize: scale all rects so the tallest column fits within [0, 1]
  const maxBottom = Math.max(...colTops);
  if (maxBottom > 1) {
    const scale = (1 - gap) / (maxBottom - gap);
    for (const r of rects) {
      r.y = gap + (r.y - gap) * scale;
      r.height *= scale;
    }
  }

  return rects;
}

/** Filmstrip: single horizontal row, all same height */
function layoutFilmstrip(photos: PhotoMeta[], gap: number): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];

  const rowH = 0.7;
  const yOff = (1 - rowH) / 2;

  // Width proportional to aspect ratio
  const totalAspect = photos.reduce((sum, p) => sum + Math.max(p.aspect, 0.5), 0);
  const availW = 1 - gap * (n + 1);
  const rects: PhotoRect[] = [];
  let x = gap;
  for (let i = 0; i < n; i++) {
    const aspect = Math.max(photos[i].aspect, 0.5);
    const w = (aspect / totalAspect) * availW;
    rects.push({ x, y: yOff, width: w, height: rowH });
    x += w + gap;
  }

  return rects;
}
