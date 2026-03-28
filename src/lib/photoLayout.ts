export interface PhotoRect {
  /** All values as fractions of container (0-1) */
  x: number;
  y: number;
  width: number;
  height: number;
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
