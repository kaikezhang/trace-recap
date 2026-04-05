import type { AspectRatio, FreePhotoTransform, LayoutTemplate, PhotoLayout as LayoutConfig } from "@/types";

/**
 * Reference width for gap normalization.
 * Gap is always computed as gapPx / GAP_REFERENCE_WIDTH so layout proportions
 * are identical regardless of the actual container pixel size (critical for
 * WYSIWYG fidelity between the small editor preview and full-size playback).
 */
const GAP_REFERENCE_WIDTH = 1000;

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

interface LayoutSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_ASPECT = 0.25;
const MIN_CONTAINER_ASPECT = 0.1;
const PORTRAIT_THRESHOLD = 0.9;
const SQUARE_LAYOUT_ASPECT_RANGE = 0.28;
const COMPACT_LAYOUT_MAX_WIDTH_PX = 480;
const COMPACT_LAYOUT_WIDTH_RANGE_PX = 180;

function safeAspect(aspect: number): number {
  return Math.max(aspect, MIN_ASPECT);
}

function safeContainerAspect(containerAspect: number): number {
  return Math.max(containerAspect, MIN_CONTAINER_ASPECT);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function heightForWidth(width: number, photoAspect: number, containerAspect: number): number {
  return (width * safeContainerAspect(containerAspect)) / safeAspect(photoAspect);
}

function widthForHeight(height: number, photoAspect: number, containerAspect: number): number {
  return (height * safeAspect(photoAspect)) / safeContainerAspect(containerAspect);
}

function fitPhotoToSlot(slot: LayoutSlot, photo: PhotoMeta, containerAspect: number): PhotoRect {
  const fittedHeight = heightForWidth(slot.width, photo.aspect, containerAspect);
  if (fittedHeight <= slot.height) {
    return {
      x: slot.x,
      y: slot.y + (slot.height - fittedHeight) / 2,
      width: slot.width,
      height: fittedHeight,
    };
  }

  const fittedWidth = widthForHeight(slot.height, photo.aspect, containerAspect);
  return {
    x: slot.x + (slot.width - fittedWidth) / 2,
    y: slot.y,
    width: fittedWidth,
    height: slot.height,
  };
}

function layoutRows(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number,
  rows: number[][]
): PhotoRect[] {
  if (rows.length === 0) return [];

  const innerWidth = 1 - gap * 2;
  const innerHeight = 1 - gap * (rows.length + 1);
  const rowHeights = rows.map((row) => {
    const rowAspectSum = row.reduce((sum, photoIndex) => sum + safeAspect(photos[photoIndex]?.aspect ?? 1), 0);
    return (innerWidth * safeContainerAspect(containerAspect)) / rowAspectSum;
  });
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const scale = totalHeight > 0 ? Math.min(1, innerHeight / totalHeight) : 1;
  const scaledHeights = rowHeights.map((height) => height * scale);
  const usedHeight = scaledHeights.reduce((sum, height) => sum + height, 0);
  const rects: PhotoRect[] = new Array(photos.length);

  let y = gap + (innerHeight - usedHeight) / 2;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowHeight = scaledHeights[rowIndex];
    const rowWidths = row.map((photoIndex) => widthForHeight(rowHeight, photos[photoIndex]?.aspect ?? 1, containerAspect));
    const usedWidth = rowWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, row.length - 1);
    let x = gap + (innerWidth - usedWidth) / 2;

    for (let i = 0; i < row.length; i++) {
      const photoIndex = row[i];
      rects[photoIndex] = {
        x,
        y,
        width: rowWidths[i],
        height: rowHeight,
      };
      x += rowWidths[i] + gap;
    }

    y += rowHeight + gap;
  }

  return rects;
}

function fillSlots(
  photos: PhotoMeta[],
  slots: LayoutSlot[],
  containerAspect: number,
  order?: number[]
): PhotoRect[] {
  const rects: PhotoRect[] = new Array(photos.length);
  const indices = order ?? photos.map((_, index) => index);

  for (let i = 0; i < Math.min(indices.length, slots.length); i++) {
    const photoIndex = indices[i];
    rects[photoIndex] = fitPhotoToSlot(slots[i], photos[photoIndex], containerAspect);
  }

  return rects;
}

function scaleRectsToInnerBounds(rects: PhotoRect[], gap: number): PhotoRect[] {
  if (rects.length === 0) return rects;

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;
  const available = 1 - gap * 2;
  const scale = Math.min(
    1,
    boundsWidth > 0 ? available / boundsWidth : 1,
    boundsHeight > 0 ? available / boundsHeight : 1
  );

  if (scale === 1 && minX >= gap && minY >= gap && maxX <= 1 - gap && maxY <= 1 - gap) {
    return rects;
  }

  const scaledWidth = boundsWidth * scale;
  const scaledHeight = boundsHeight * scale;
  const offsetX = gap + (available - scaledWidth) / 2;
  const offsetY = gap + (available - scaledHeight) / 2;

  return rects.map((rect) => ({
    ...rect,
    x: offsetX + (rect.x - minX) * scale,
    y: offsetY + (rect.y - minY) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  }));
}

function constrainAutoLayoutForCompactViewport(
  rects: PhotoRect[],
  containerAspect: number,
  gap: number,
  photoCount: number,
  containerWidthPx: number
): PhotoRect[] {
  if (rects.length === 0 || containerWidthPx <= 0) {
    return rects;
  }

  // Narrow square-ish playback viewports make portrait albums feel oversized;
  // add inset after layout so existing arrangement choices remain unchanged.
  const squareLayoutPressure = clamp01(
    1 - Math.abs(containerAspect - 1) / SQUARE_LAYOUT_ASPECT_RANGE
  );
  const compactViewportPressure = clamp01(
    (COMPACT_LAYOUT_MAX_WIDTH_PX - containerWidthPx) / COMPACT_LAYOUT_WIDTH_RANGE_PX
  );
  const constraintPressure = squareLayoutPressure * compactViewportPressure;

  if (constraintPressure <= 0) {
    return rects;
  }

  const extraGap =
    (photoCount === 1
      ? 0.12
      : photoCount === 2
        ? 0.08
        : photoCount <= 4
          ? 0.05
          : 0.03) * constraintPressure;

  return scaleRectsToInnerBounds(rects, gap + extraGap);
}

function shouldUsePortraitFriendlyLayout(viewportRatio?: AspectRatio): boolean {
  return viewportRatio === "9:16";
}

function seedFromPhotos(photos: PhotoMeta[]): number {
  let hash = 2166136261;
  for (const photo of photos) {
    for (let i = 0; i < photo.id.length; i++) {
      hash ^= photo.id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= Math.round(safeAspect(photo.aspect) * 1000);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveSeed(photos: PhotoMeta[], seed?: number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    if (Math.abs(seed) < 1) {
      return Math.floor(seed * 4294967295) >>> 0;
    }
    return Math.floor(seed) >>> 0;
  }
  return seedFromPhotos(photos);
}

function layoutRectsWithinSlot(
  rects: PhotoRect[],
  slot: LayoutSlot,
  gap: number
): PhotoRect[] {
  if (rects.length === 0) return rects;

  const scaled = scaleRectsToInnerBounds(rects, gap);
  const innerWidth = 1 - gap * 2;
  const innerHeight = 1 - gap * 2;

  return scaled.map((rect) => ({
    ...rect,
    x: slot.x + ((rect.x - gap) / innerWidth) * slot.width,
    y: slot.y + ((rect.y - gap) / innerHeight) * slot.height,
    width: (rect.width / innerWidth) * slot.width,
    height: (rect.height / innerHeight) * slot.height,
  }));
}

function getPortraitHeroHeight(innerHeight: number, photoCount: number): number {
  if (photoCount <= 3) return innerHeight * 0.68;
  if (photoCount <= 5) return innerHeight * 0.55;
  if (photoCount <= 7) return innerHeight * 0.48;
  return innerHeight * 0.42;
}

function layoutPortraitReadableGallery(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number,
  template?: LayoutTemplate
): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];

  const innerWidth = 1 - gap * 2;
  const innerHeight = 1 - gap * 2;

  // In portrait (9:16) mode, return FULL SLOT rects (cover mode).
  // CSS object-fit:cover handles cropping. No fitPhotoToSlot shrinking.

  // Single photo: full width, generous height
  if (n === 1) {
    if (photos[0].aspect > 1.2) {
      // Landscape photo: full width, 60% height, centered
      const heroHeight = innerHeight * 0.60;
      return [{ x: gap, y: gap + (innerHeight - heroHeight) / 2, width: innerWidth, height: heroHeight }];
    }
    // Portrait/square photo: full slot
    return [{ x: gap, y: gap, width: innerWidth, height: innerHeight }];
  }

  if (n === 2) {
    // Polaroid template: side-by-side cards with slight rotation for personality
    if (template === "polaroid") {
      const cardW = (innerWidth - gap) * 0.46;
      const cardH = innerHeight * 0.72;
      const yCenter = gap + (innerHeight - cardH) / 2;
      return [
        { x: gap + innerWidth * 0.02, y: yCenter - innerHeight * 0.02, width: cardW, height: cardH, rotation: -3 },
        { x: gap + innerWidth - cardW - innerWidth * 0.02, y: yCenter + innerHeight * 0.02, width: cardW, height: cardH, rotation: 2.5 },
      ];
    }

    // Hero template: dominant first photo (78%) + small strip (17%)
    if (template === "hero") {
      const heroHeight = innerHeight * 0.78;
      const bottomHeight = innerHeight * 0.17;
      return [
        { x: gap, y: gap, width: innerWidth, height: heroHeight },
        { x: gap + innerWidth * 0.15, y: gap + heroHeight + gap, width: innerWidth * 0.7, height: bottomHeight },
      ];
    }

    const landscapeCount = photos.filter((p) => p.aspect > 1.2).length;

    // Both landscape: stack vertically, each full width
    if (landscapeCount === 2) {
      const slotHeight = (innerHeight - gap) / 2;
      return [
        { x: gap, y: gap, width: innerWidth, height: slotHeight },
        { x: gap, y: gap + slotHeight + gap, width: innerWidth, height: slotHeight },
      ];
    }

    // Mixed: hero 65% height, support 30% height (5% gap)
    if (landscapeCount === 1) {
      const landscapeIndex = photos[0].aspect > 1.2 ? 0 : 1;
      const portraitIndex = landscapeIndex === 0 ? 1 : 0;
      const heroHeight = innerHeight * 0.65;
      const bottomHeight = innerHeight * 0.30;
      const rects: PhotoRect[] = [];
      rects[landscapeIndex] = { x: gap, y: gap, width: innerWidth, height: heroHeight };
      rects[portraitIndex] = { x: gap, y: gap + heroHeight + gap, width: innerWidth, height: bottomHeight };
      return rects;
    }

    // Both portrait: 65/30 split stacked vertically (cover mode fills width)
    const heroHeight = innerHeight * 0.65;
    const bottomHeight = innerHeight * 0.30;
    return [
      { x: gap, y: gap, width: innerWidth, height: heroHeight },
      { x: gap, y: gap + heroHeight + gap, width: innerWidth, height: bottomHeight },
    ];
  }

  // 3 photos: hero 50% + 2 bottom 40% (gap ~10%)
  if (n === 3) {
    const heroHeight = innerHeight * 0.50;
    const bottomHeight = innerHeight * 0.40;
    const colWidth = (innerWidth - gap) / 2;

    return [
      { x: gap, y: gap, width: innerWidth, height: heroHeight },
      { x: gap, y: gap + heroHeight + gap, width: colWidth, height: bottomHeight },
      { x: gap + colWidth + gap, y: gap + heroHeight + gap, width: colWidth, height: bottomHeight },
    ];
  }

  // 4+ photos: hero + remaining in full-slot grid below
  const displayPhotos = n > 4 ? photos.slice(0, 4) : photos;
  const displayN = displayPhotos.length;

  const heroHeight = getPortraitHeroHeight(innerHeight, displayN);
  const stripHeight = Math.max(0, innerHeight - heroHeight - gap);

  if (stripHeight <= 0) {
    return [{ x: gap, y: gap, width: innerWidth, height: heroHeight }];
  }

  const remainingPhotos = displayPhotos.slice(1);
  const remainingN = remainingPhotos.length;

  // Build full-slot rects for remaining photos
  const stripRects: PhotoRect[] = [];
  if (remainingN === 1) {
    stripRects.push({ x: gap, y: gap + heroHeight + gap, width: innerWidth, height: stripHeight });
  } else if (remainingN === 2) {
    const colW = (innerWidth - gap) / 2;
    stripRects.push({ x: gap, y: gap + heroHeight + gap, width: colW, height: stripHeight });
    stripRects.push({ x: gap + colW + gap, y: gap + heroHeight + gap, width: colW, height: stripHeight });
  } else {
    // 3 remaining: 2 top row + 1 bottom row, or all in one row
    const colW = (innerWidth - gap) / 2;
    const topH = stripHeight * 0.5;
    const botH = stripHeight - topH - gap;
    stripRects.push({ x: gap, y: gap + heroHeight + gap, width: colW, height: topH });
    stripRects.push({ x: gap + colW + gap, y: gap + heroHeight + gap, width: colW, height: topH });
    stripRects.push({ x: gap, y: gap + heroHeight + gap + topH + gap, width: innerWidth, height: botH });
  }

  return [
    { x: gap, y: gap, width: innerWidth, height: heroHeight },
    ...stripRects,
  ];
}

function computeJustifiedRows(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number
): number[][] {
  const n = photos.length;
  if (n === 0) return [];

  const maxPerRow = containerAspect >= 1 ? 4 : 3;
  const minTargetRows = Math.max(
    1,
    containerAspect >= 1 ? Math.ceil(n / 3) : Math.ceil(n / 2)
  );
  const innerWidth = 1 - gap * 2;

  let rows: number[][] = [];

  for (let desiredRows = minTargetRows; desiredRows <= n; desiredRows++) {
    const targetHeight = (1 - gap * (desiredRows + 1)) / desiredRows;
    const nextRows: number[][] = [];
    let currentRow: number[] = [];
    let currentAspect = 0;

    for (let index = 0; index < n; index++) {
      currentRow.push(index);
      currentAspect += safeAspect(photos[index]?.aspect ?? 1);

      const rowHeight =
        ((innerWidth - gap * Math.max(0, currentRow.length - 1)) *
          safeContainerAspect(containerAspect)) /
        currentAspect;
      const remaining = n - index - 1;
      const shouldClose =
        currentRow.length >= maxPerRow ||
        (rowHeight <= targetHeight * 1.12 && remaining >= Math.max(1, desiredRows - nextRows.length - 1));

      if (shouldClose) {
        nextRows.push(currentRow);
        currentRow = [];
        currentAspect = 0;
      }
    }

    if (currentRow.length > 0) {
      nextRows.push(currentRow);
    }

    if (nextRows.length > 1 && nextRows[nextRows.length - 1]?.length === 1) {
      const previousRow = nextRows[nextRows.length - 2];
      if (previousRow && previousRow.length > 2) {
        nextRows[nextRows.length - 1].unshift(previousRow.pop()!);
      }
    }

    const heights = nextRows.map((row) => {
      const aspectSum = row.reduce(
        (sum, photoIndex) => sum + safeAspect(photos[photoIndex]?.aspect ?? 1),
        0
      );
      return (
        ((innerWidth - gap * Math.max(0, row.length - 1)) *
          safeContainerAspect(containerAspect)) /
        aspectSum
      );
    });
    const totalHeight = heights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, nextRows.length - 1);

    rows = nextRows;
    if (totalHeight <= 1 - gap * 2 || desiredRows === n) {
      break;
    }
  }

  return rows;
}

function layoutJustifiedRows(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number
): PhotoRect[] {
  const rows = computeJustifiedRows(photos, containerAspect, gap);
  if (rows.length === 0) return [];

  const innerWidth = 1 - gap * 2;
  const innerHeight = 1 - gap * 2;
  const rowHeights = rows.map((row) => {
    const aspectSum = row.reduce(
      (sum, photoIndex) => sum + safeAspect(photos[photoIndex]?.aspect ?? 1),
      0
    );
    return (
      ((innerWidth - gap * Math.max(0, row.length - 1)) *
        safeContainerAspect(containerAspect)) /
      aspectSum
    );
  });
  let usedHeight = rowHeights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, rows.length - 1);

  // Scale all rows proportionally if they overflow the container
  if (usedHeight > innerHeight) {
    const scale = innerHeight / usedHeight;
    for (let i = 0; i < rowHeights.length; i++) {
      rowHeights[i] *= scale;
    }
    usedHeight = innerHeight;
  }

  const rects: PhotoRect[] = new Array(photos.length);

  let y = gap + Math.max(0, (innerHeight - usedHeight) / 2);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowHeight = rowHeights[rowIndex];
    let x = gap;

    for (const photoIndex of row) {
      const width = widthForHeight(rowHeight, photos[photoIndex]?.aspect ?? 1, containerAspect);
      rects[photoIndex] = { x, y, width, height: rowHeight };
      x += width + gap;
    }

    y += rowHeight + gap;
  }

  return rects;
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

  // Gap as fraction of reference width (resolution-independent for WYSIWYG)
  const gap = gapPx / GAP_REFERENCE_WIDTH;
  let rects: PhotoRect[];

  switch (n) {
    case 1:
      rects = layoutOne(photos, containerAspect, gap);
      break;
    case 2:
      rects = layoutTwo(photos, containerAspect, gap);
      break;
    case 3:
      rects = layoutThree(photos, containerAspect, gap);
      break;
    case 4:
      rects = layoutFour(photos, containerAspect, gap);
      break;
    case 5:
      rects = layoutFive(photos, containerAspect, gap);
      break;
    case 6:
      rects = layoutSix(photos, containerAspect, gap);
      break;
    case 7:
      rects = layoutSeven(photos, containerAspect, gap);
      break;
    case 8:
      rects = layoutEight(photos, containerAspect, gap);
      break;
    case 9:
      rects = layoutNine(photos, containerAspect, gap);
      break;
    default:
      // For >9 just use 3x3 grid with first 9
      rects = layoutNine(photos.slice(0, 9), containerAspect, gap);
      break;
  }

  return constrainAutoLayoutForCompactViewport(
    rects,
    containerAspect,
    gap,
    Math.min(n, 9),
    containerWidthPx
  );
}

export function computePhotoLayout(
  photos: PhotoMeta[],
  containerWidthPx: number,
  containerHeightPx: number,
  layout?: Pick<LayoutConfig, "mode" | "template" | "gap" | "customProportions" | "layoutSeed">,
  viewportRatio?: AspectRatio
): PhotoRect[] {
  if (photos.length === 0) return [];

  const gapPx = layout?.gap ?? 8;
  const widthPx = containerWidthPx > 0 ? containerWidthPx : 1000;
  const containerAspect =
    containerWidthPx > 0 && containerHeightPx > 0
      ? containerWidthPx / containerHeightPx
      : 16 / 9;
  const gap = gapPx / GAP_REFERENCE_WIDTH;

  if (shouldUsePortraitFriendlyLayout(viewportRatio)) {
    return layoutPortraitReadableGallery(photos, containerAspect, gap, layout?.template);
  }

  if (layout?.mode !== "free" && layout?.template) {
    return computeTemplateLayout(
      photos,
      containerAspect,
      layout.template,
      gapPx,
      widthPx,
      layout.customProportions,
      layout.layoutSeed
    );
  }

  return computeAutoLayout(photos, containerAspect, gapPx, widthPx);
}

/** 1 photo: fit within the container while preserving the photo aspect. */
function layoutOne(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  return fillSlots(
    photos,
    [{ x: gap, y: gap, width: 1 - gap * 2, height: 1 - gap * 2 }],
    containerAspect
  );
}

/** 2 photos: side by side if both landscape/square; stacked if both portrait; mixed: landscape top, portrait below. */
function layoutTwo(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  const portraitFlags = photos.map((photo) => safeAspect(photo.aspect) < PORTRAIT_THRESHOLD);
  const portraitCount = portraitFlags.filter(Boolean).length;

  if (portraitCount === 1) {
    const landscapeIndex = portraitFlags[0] ? 1 : 0;
    const portraitIndex = portraitFlags[0] ? 0 : 1;
    return layoutRows(photos, containerAspect, gap, [[landscapeIndex], [portraitIndex]]);
  }

  if (portraitCount === 2) {
    return containerAspect >= 1
      ? layoutRows(photos, containerAspect, gap, [[0, 1]])
      : layoutRows(photos, containerAspect, gap, [[0], [1]]);
  }

  return containerAspect >= 1
    ? layoutRows(photos, containerAspect, gap, [[0, 1]])
    : layoutRows(photos, containerAspect, gap, [[0], [1]]);
}

/** 3 photos: 1 big left (60%) + 2 small right. If all portraits: 3 equal columns. */
function layoutThree(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  const portraitFlags = photos.map((photo) => safeAspect(photo.aspect) < PORTRAIT_THRESHOLD);
  const portraitIndices = photos
    .map((_, index) => index)
    .filter((index) => portraitFlags[index]);
  const landscapeIndices = photos
    .map((_, index) => index)
    .filter((index) => !portraitFlags[index]);

  if (landscapeIndices.length === 3 && containerAspect < 1) {
    return layoutRows(photos, containerAspect, gap, [[0], [1], [2]]);
  }

  if (portraitIndices.length === 3 && containerAspect >= 1) {
    return layoutRows(photos, containerAspect, gap, [[0, 1, 2]]);
  }

  if (landscapeIndices.length === 1 && portraitIndices.length === 2) {
    return layoutRows(photos, containerAspect, gap, [[landscapeIndices[0]], portraitIndices]);
  }

  if (landscapeIndices.length === 2 && portraitIndices.length === 1) {
    return containerAspect < 1
      ? layoutRows(photos, containerAspect, gap, landscapeIndices.map((index) => [index]).concat([[portraitIndices[0]]]))
      : layoutRows(photos, containerAspect, gap, [landscapeIndices, [portraitIndices[0]]]);
  }

  return containerAspect >= 1
    ? layoutRows(photos, containerAspect, gap, [[0, 1], [2]])
    : layoutRows(photos, containerAspect, gap, [[0], [1, 2]]);
}

/** 4 photos: 2x2 grid */
function layoutFour(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  return layoutRows(photos, containerAspect, gap, [[0, 1], [2, 3]]);
}

/** 5 photos: top row 2 (60% height), bottom row 3 (40% height) */
function layoutFive(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  return layoutRows(photos, containerAspect, gap, [[0, 1], [2, 3, 4]]);
}

/** 6 photos: 2x3 or 3x2 depending on container aspect */
function layoutSix(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  return containerAspect >= 1
    ? layoutRows(photos, containerAspect, gap, [[0, 1, 2], [3, 4, 5]])
    : layoutRows(photos, containerAspect, gap, [[0, 1], [2, 3], [4, 5]]);
}

/** 7 photos: top row 3 (55% height), bottom row 4 (45% height) */
function layoutSeven(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  return layoutRows(photos, containerAspect, gap, [[0, 1, 2], [3, 4, 5, 6]]);
}

/** 8 photos: top 3, middle 3, bottom 2 (wider) */
function layoutEight(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  return layoutRows(photos, containerAspect, gap, [[0, 1, 2], [3, 4, 5], [6, 7]]);
}

/** 9 photos: 3x3 grid */
function layoutNine(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  return layoutRows(photos, containerAspect, gap, [[0, 1, 2], [3, 4, 5], [6, 7, 8]]);
}

/**
 * Simple seeded pseudo-random number generator.
 */
function seededRandom(seed: number): () => number {
  let s = (Math.floor(seed) >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Scatter: semi-random positions with rotation, like photos on a table */
function layoutScatter(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number,
  layoutSeed?: number
): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{
      ...fitPhotoToSlot({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, photos[0], containerAspect),
      rotation: 0,
    }];
  }

  const seed = resolveSeed(photos, layoutSeed);
  const rand = seededRandom(seed);

  // Base size: each photo gets roughly 1/sqrt(N) of the container
  const baseSize = Math.min(0.45, 1 / Math.sqrt(n));
  const margin = gap + 0.02; // keep away from edges

  const rects: PhotoRect[] = [];
  for (let i = 0; i < n; i++) {
    // Size variation: 80-110% of base
    const sizeScale = 0.8 + rand() * 0.3;
    const fitted = fitPhotoToSlot(
      { x: 0, y: 0, width: baseSize * sizeScale, height: baseSize * sizeScale },
      photos[i],
      containerAspect
    );
    const w = fitted.width;
    const h = fitted.height;

    // Random position within bounds
    const maxX = 1 - w - margin;
    const maxY = 1 - h - margin;
    const x = margin + rand() * Math.max(0, maxX - margin);
    const y = margin + rand() * Math.max(0, maxY - margin);

    // Random rotation between -8 and +8 degrees
    const rotation = (rand() - 0.5) * 16;

    rects.push({ x, y, width: w, height: h, rotation });
  }

  // Collision relaxation: nudge overlapping photos apart (10 passes with decreasing threshold)
  for (let pass = 0; pass < 10; pass++) {
    // Reduce overlap threshold each pass: start at 30%, end near 15%
    const thresholdFactor = 0.3 - (pass / 9) * 0.15;
    // Increase nudge distance for stronger separation
    const nudge = 0.04 - pass * 0.002; // 0.04 down to ~0.022

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

        // Check if overlap area exceeds threshold of the smaller rect area
        if (overlapX > 0 && overlapY > 0) {
          const overlapArea = overlapX * overlapY;
          const smallerArea = Math.min(a.width * a.height, b.width * b.height);
          if (overlapArea > smallerArea * thresholdFactor) {
            const dx = aCx < bCx ? -1 : 1;
            const dy = aCy < bCy ? -1 : 1;
            a.x += dx * nudge;
            a.y += dy * nudge;
            b.x -= dx * nudge;
            b.y -= dy * nudge;
          }
        }
      }
    }
  }

  // Final validation pass: guarantee no pair overlaps more than 20% of the smaller rect
  const maxOverlapRatio = 0.2;
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

      if (overlapX > 0 && overlapY > 0) {
        const overlapArea = overlapX * overlapY;
        const smallerArea = Math.min(a.width * a.height, b.width * b.height);
        if (overlapArea > smallerArea * maxOverlapRatio) {
          // Force-separate along center-to-center vector
          let dx = bCx - aCx;
          let dy = bCy - aCy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1e-6) {
            // Coincident centers — pick arbitrary direction
            dx = 1;
            dy = 0;
          } else {
            dx /= dist;
            dy /= dist;
          }
          // Iteratively push apart until overlap <= 20%
          const step = 0.005;
          for (let iter = 0; iter < 200; iter++) {
            a.x -= dx * step;
            a.y -= dy * step;
            b.x += dx * step;
            b.y += dy * step;
            const newACx = a.x + a.width / 2;
            const newACy = a.y + a.height / 2;
            const newBCx = b.x + b.width / 2;
            const newBCy = b.y + b.height / 2;
            const newOX = (a.width + b.width) / 2 - Math.abs(newACx - newBCx);
            const newOY = (a.height + b.height) / 2 - Math.abs(newACy - newBCy);
            if (newOX <= 0 || newOY <= 0 || newOX * newOY <= smallerArea * maxOverlapRatio) {
              break;
            }
          }
        }
      }
    }
  }

  // Clamp all positions to keep within bounds
  for (const r of rects) {
    r.x = Math.max(margin, Math.min(r.x, 1 - r.width - margin));
    r.y = Math.max(margin, Math.min(r.y, 1 - r.height - margin));
  }

  // Post-clamp validation: if clamping reintroduced overlap > 20%, shrink the offending rects
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlapX = (a.width + b.width) / 2 - Math.abs((a.x + a.width / 2) - (b.x + b.width / 2));
      const overlapY = (a.height + b.height) / 2 - Math.abs((a.y + a.height / 2) - (b.y + b.height / 2));
      if (overlapX > 0 && overlapY > 0) {
        const overlapArea = overlapX * overlapY;
        const smallerArea = Math.min(a.width * a.height, b.width * b.height);
        if (overlapArea > smallerArea * maxOverlapRatio) {
          // Shrink the later rect slightly to reduce overlap
          const shrink = 0.92;
          b.width *= shrink;
          b.height *= shrink;
          // Re-clamp
          b.x = Math.max(margin, Math.min(b.x, 1 - b.width - margin));
          b.y = Math.max(margin, Math.min(b.y, 1 - b.height - margin));
        }
      }
    }
  }

  return scaleRectsToInnerBounds(rects, gap);
}

/** Diagonal: staircase composition with light overlap from top-left to bottom-right. */
function layoutDiagonal(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];

  const baseSize = Math.max(0.24, Math.min(0.58, 0.92 - n * 0.04));
  const stepX = Math.max(0.08, baseSize * 0.56);
  const stepY = Math.max(0.06, baseSize * 0.42);
  const slots: LayoutSlot[] = [];

  for (let i = 0; i < n; i++) {
    const sizeScale = 1 - Math.min(i, 4) * 0.04;
    const slotSize = baseSize * sizeScale;
    slots.push({
      x: i * stepX,
      y: i * stepY,
      width: slotSize,
      height: slotSize,
    });
  }

  return scaleRectsToInnerBounds(fillSlots(photos, slots, containerAspect), gap);
}

/** Rows: justified gallery rows with widths proportional to each photo's aspect ratio. */
function layoutRowsTemplate(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number
): PhotoRect[] {
  return layoutJustifiedRows(photos, containerAspect, gap);
}

/** Magazine: lead image as a hero with a smaller editorial strip beside or below it. */
function layoutMagazine(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];
  if (n === 1) {
    return fillSlots(
      photos,
      [{ x: gap, y: gap, width: 1 - gap * 2, height: 1 - gap * 2 }],
      containerAspect
    );
  }

  const innerWidth = 1 - gap * 2;
  const innerHeight = 1 - gap * 2;
  const remainingPhotos = photos.slice(1);

  if (containerAspect >= 1) {
    const heroWidth = innerWidth * 0.62;
    const stripWidth = innerWidth - heroWidth - gap;
    const heroSlot: LayoutSlot = { x: gap, y: gap, width: heroWidth, height: innerHeight };
    const stripSlot: LayoutSlot = {
      x: gap + heroWidth + gap,
      y: gap,
      width: stripWidth,
      height: innerHeight,
    };
    const stripRects = layoutRectsWithinSlot(
      layoutJustifiedRows(remainingPhotos, stripWidth / Math.max(stripSlot.height, 0.1), gap * 0.6),
      stripSlot,
      gap * 0.6
    );

    return [
      fitPhotoToSlot(heroSlot, photos[0], containerAspect),
      ...stripRects,
    ];
  }

  const heroHeight = innerHeight * 0.6;
  const stripHeight = innerHeight - heroHeight - gap;
  const heroSlot: LayoutSlot = { x: gap, y: gap, width: innerWidth, height: heroHeight };
  const stripSlot: LayoutSlot = {
    x: gap,
    y: gap + heroHeight + gap,
    width: innerWidth,
    height: stripHeight,
  };
  const stripRects = layoutRectsWithinSlot(
    layoutJustifiedRows(remainingPhotos, Math.max(stripSlot.width, 0.1) / Math.max(stripSlot.height, 0.1), gap * 0.6),
    stripSlot,
    gap * 0.6
  );

  return [
    fitPhotoToSlot(heroSlot, photos[0], containerAspect),
    ...stripRects,
  ];
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
  customProportions?: { rows?: number[]; cols?: number[] },
  layoutSeed?: number
): PhotoRect[] {
  const gapPx = gap ?? 8;
  const g = gapPx / GAP_REFERENCE_WIDTH; // gap as fraction (resolution-independent)

  switch (template) {
    case "grid":
      return layoutGrid(photos, containerAspect, g, customProportions);
    case "hero":
      return layoutHero(photos, containerAspect, g, customProportions);
    case "masonry":
      return layoutMasonry(photos, containerAspect, g);
    case "filmstrip":
      return layoutFilmstrip(photos, containerAspect, g);
    case "scatter":
      return layoutScatter(photos, containerAspect, g, layoutSeed);
    case "polaroid":
      return layoutPolaroid(photos, containerAspect, g, layoutSeed);
    case "overlap":
      return layoutOverlap(photos, containerAspect, g, layoutSeed);
    case "full":
      return layoutFull(photos, containerAspect);
    case "diagonal":
      return layoutDiagonal(photos, containerAspect, g);
    case "rows":
      return layoutRowsTemplate(photos, containerAspect, g);
    case "magazine":
      return layoutMagazine(photos, containerAspect, g);
    default:
      return computeAutoLayout(photos, containerAspect, gapPx);
  }
}

export function computedRectsToFreeTransforms(
  photos: Array<{ id: string; caption?: string }>,
  rects: PhotoRect[],
  options?: {
    containerWidthPx?: number;
    containerHeightPx?: number;
    captionFontSizePx?: number;
  },
): FreePhotoTransform[] {
  const containerWidthPx = options?.containerWidthPx ?? 0;
  const containerHeightPx = options?.containerHeightPx ?? 0;
  const captionFontSizePx = options?.captionFontSizePx ?? 14;
  const captionScale = containerWidthPx > 0 ? containerWidthPx / 1000 : 1;
  const captionHeight =
    containerHeightPx > 0
      ? (captionFontSizePx * captionScale * 2) / containerHeightPx
      : 0;

  return photos.reduce<FreePhotoTransform[]>((acc, photo, index) => {
      const rect = rects[index];
      if (!rect) {
        return acc;
      }

      const hasCaption = Boolean(photo.caption?.trim());
      const photoHeight = hasCaption
        ? Math.max(rect.height - captionHeight, rect.height * 0.2)
        : rect.height;

      acc.push({
        photoId: photo.id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: photoHeight,
        rotation: rect.rotation ?? 0,
        zIndex: index,
        caption: {
          text: photo.caption,
          offsetX: 0,
          offsetY: photoHeight / 2 + 0.04,
          rotation: 0,
        },
      });
      return acc;
    }, []);
}

/** Grid: equal-sized cells filling rows/columns, with optional custom proportions */
function layoutGrid(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number,
  customProportions?: { rows?: number[]; cols?: number[] }
): PhotoRect[] {
  const n = photos.length;
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

  const slots: LayoutSlot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    let x = gap;
    for (let c = 0; c < col; c++) x += colWidths[c] + gap;
    let y = gap;
    for (let r = 0; r < row; r++) y += rowHeights[r] + gap;
    slots.push({
      x,
      y,
      width: colWidths[col],
      height: rowHeights[row],
    });
  }
  return fillSlots(photos, slots, containerAspect);
}

/** Hero: first photo large (~60% area), remaining in smaller grid */
function layoutHero(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number,
  customProportions?: { rows?: number[]; cols?: number[] }
): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];
  if (n === 1) {
    return fillSlots(
      photos,
      [{ x: gap, y: gap, width: 1 - gap * 2, height: 1 - gap * 2 }],
      containerAspect
    );
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

  const slots: LayoutSlot[] = [{ x: gap, y: gap, width: heroW, height: heroH }];

  for (let i = 0; i < remaining; i++) {
    const row = i % rows;
    const col = Math.floor(i / rows);
    const colCount = Math.ceil(remaining / rows);
    const cellW = colCount > 1 ? (rightW - gap * (colCount - 1)) / colCount : rightW;
    slots.push({
      x: gap * 2 + heroW + col * (cellW + gap),
      y: gap + row * (cellH + gap),
      width: cellW,
      height: cellH,
    });
  }

  return fillSlots(photos, slots, containerAspect);
}

/** Masonry: alternating tall and short photos in columns */
function layoutMasonry(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];
  if (n === 1) {
    return fillSlots(
      photos,
      [{ x: gap, y: gap, width: 1 - gap * 2, height: 1 - gap * 2 }],
      containerAspect
    );
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
    const cellH = heightForWidth(colW, photos[i].aspect, containerAspect);
    const x = gap + minCol * (colW + gap);
    const y = colTops[minCol];
    rects[i] = { x, y, width: colW, height: cellH };
    colTops[minCol] = y + cellH + gap;
  }

  return scaleRectsToInnerBounds(rects, gap);
}

/** Polaroid: photos as Polaroid-style cards with white borders, slight rotation, scattered */
function layoutPolaroid(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number,
  layoutSeed?: number
): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];

  const seed = resolveSeed(photos, layoutSeed);
  const rand = seededRandom(seed);

  if (n === 1) {
    const rotation = (rand() - 0.5) * 10;
    return [{
      ...fitPhotoToSlot({ x: 0.3, y: 0.25, width: 0.4, height: 0.5 }, { ...photos[0], aspect: photos[0].aspect * 0.88 }, containerAspect),
      rotation,
    }];
  }

  const baseSize = Math.min(0.42, 0.85 / Math.sqrt(n));
  const margin = gap + 0.03;

  const rects: PhotoRect[] = [];
  for (let i = 0; i < n; i++) {
    const sizeScale = 0.85 + rand() * 0.3;
    const fitted = fitPhotoToSlot(
      { x: 0, y: 0, width: baseSize * sizeScale, height: baseSize * sizeScale * 1.15 },
      { ...photos[i], aspect: photos[i].aspect * 0.88 },
      containerAspect
    );
    const w = fitted.width;
    const h = fitted.height;

    const maxX = 1 - w - margin;
    const maxY = 1 - h - margin;
    const x = margin + rand() * Math.max(0, maxX - margin);
    const y = margin + rand() * Math.max(0, maxY - margin);

    // Rotation between -8° and +8°
    const rotation = (rand() - 0.5) * 16;

    rects.push({ x, y, width: w, height: h, rotation });
  }

  // Light collision relaxation — allow more overlap than scatter for a natural pile feel
  for (let pass = 0; pass < 6; pass++) {
    const nudge = 0.03 - pass * 0.003;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlapX = (a.width + b.width) / 2 - Math.abs((a.x + a.width / 2) - (b.x + b.width / 2));
        const overlapY = (a.height + b.height) / 2 - Math.abs((a.y + a.height / 2) - (b.y + b.height / 2));
        if (overlapX > 0 && overlapY > 0) {
          const overlapArea = overlapX * overlapY;
          const smallerArea = Math.min(a.width * a.height, b.width * b.height);
          if (overlapArea > smallerArea * 0.4) {
            const dx = (a.x + a.width / 2) < (b.x + b.width / 2) ? -1 : 1;
            const dy = (a.y + a.height / 2) < (b.y + b.height / 2) ? -1 : 1;
            a.x += dx * nudge;
            a.y += dy * nudge;
            b.x -= dx * nudge;
            b.y -= dy * nudge;
          }
        }
      }
    }
  }

  // Clamp within bounds
  for (const r of rects) {
    r.x = Math.max(margin, Math.min(r.x, 1 - r.width - margin));
    r.y = Math.max(margin, Math.min(r.y, 1 - r.height - margin));
  }

  return rects;
}

/** Overlap: photos stacked with depth, each offset right and down */
function layoutOverlap(
  photos: PhotoMeta[],
  containerAspect: number,
  gap: number,
  layoutSeed?: number
): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{
      ...fitPhotoToSlot({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, photos[0], containerAspect),
      rotation: 0,
    }];
  }

  const rand = seededRandom(resolveSeed(photos, layoutSeed));
  const rects: PhotoRect[] = [];
  // Back photo is largest, front photo is smallest
  const maxScale = 0.7;
  const minScale = 0.45;
  const scaleStep = n > 1 ? (maxScale - minScale) / (n - 1) : 0;

  // Offset each photo slightly right and down
  // Reduce offsetStep dynamically so all photos fit within [0, 1]
  const maxOffset = 0.06;
  const maxTotalOffset = (1 - maxScale) / 2; // max offset that keeps startPos >= 0
  const offsetStep = Math.min(maxOffset, n > 1 ? maxTotalOffset / (n - 1) : maxOffset);
  // Center the stack
  const totalOffsetX = offsetStep * (n - 1);
  const totalOffsetY = offsetStep * (n - 1);
  const startX = (1 - maxScale - totalOffsetX) / 2;
  const startY = (1 - maxScale - totalOffsetY) / 2;

  for (let i = 0; i < n; i++) {
    const jitter = (rand() - 0.5) * offsetStep * 0.9;
    const scale = maxScale - i * scaleStep - rand() * 0.015;
    const x = startX + i * offsetStep + jitter;
    const y = startY + i * offsetStep + (rand() - 0.5) * offsetStep * 0.8;
    const rotation = (rand() - 0.5) * 10;
    rects.push({
      ...fitPhotoToSlot({ x, y, width: scale, height: scale }, photos[i], containerAspect),
      rotation,
    });
  }

  return scaleRectsToInnerBounds(rects, gap);
}

/** Full: single photo fits the whole container while preserving its aspect. */
function layoutFull(photos: PhotoMeta[], containerAspect: number): PhotoRect[] {
  if (photos.length === 0) return [];
  return fillSlots(
    [photos[0]],
    [{ x: 0, y: 0, width: 1, height: 1 }],
    containerAspect
  );
}

/** Filmstrip: single horizontal row, all same height */
function layoutFilmstrip(photos: PhotoMeta[], containerAspect: number, gap: number): PhotoRect[] {
  const n = photos.length;
  if (n === 0) return [];

  const totalAspect = photos.reduce((sum, photo) => sum + safeAspect(photo.aspect), 0);
  const innerWidth = 1 - gap * 2;
  const availW = 1 - gap * (n + 1);
  const availH = 1 - gap * 2;
  const rowH = Math.min(availH, (availW * safeContainerAspect(containerAspect)) / totalAspect);
  const usedW = photos.reduce((sum, photo) => sum + widthForHeight(rowH, photo.aspect, containerAspect), 0)
    + gap * Math.max(0, n - 1);
  const yOff = (1 - rowH) / 2;
  let x = gap + (innerWidth - usedW) / 2;
  const rects: PhotoRect[] = [];
  for (let i = 0; i < n; i++) {
    const w = widthForHeight(rowH, photos[i].aspect, containerAspect);
    rects.push({ x, y: yOff, width: w, height: rowH });
    x += w + gap;
  }

  return rects;
}
