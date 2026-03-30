#!/usr/bin/env node
/**
 * Generate Lottie JSON files for all icon variant × style combinations.
 * Default variants (first in each mode) already exist as {mode}-{style}.json.
 * This script generates non-default variants as {mode}-{variant}-{style}.json.
 */
import { writeFileSync } from "fs";
import { join } from "path";

const LOTTIE_DIR = join(import.meta.dirname, "..", "public", "lottie");

// Color mappings per mode [r, g, b, a] in 0-1 range
const MODE_COLORS = {
  flight: [0.231, 0.51, 0.965, 1],
  car: [0.937, 0.267, 0.267, 1],
  train: [0.133, 0.773, 0.369, 1],
  bus: [0.976, 0.451, 0.086, 1],
  ferry: [0.024, 0.714, 0.831, 1],
  walk: [0.545, 0.361, 0.965, 1],
  bicycle: [0.518, 0.8, 0.086, 1],
};

// Soft background colors per mode
const MODE_SOFT_BG = {
  flight: [0.831, 0.892, 0.992, 1],
  car: [0.992, 0.871, 0.871, 1],
  train: [0.843, 0.949, 0.882, 1],
  bus: [0.996, 0.906, 0.831, 1],
  ferry: [0.831, 0.949, 0.965, 1],
  walk: [0.906, 0.871, 0.992, 1],
  bicycle: [0.906, 0.957, 0.831, 1],
};

// Shape vertices for each variant (all face right for Lottie rotation)
const VARIANT_SHAPES = {
  flight: {
    // airplane is default, already exists
    jet: {
      v: [[-22, -10], [24, 0], [-22, 10], [-14, 0]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0]],
    },
    balloon: {
      v: [[-6, -22], [6, -22], [16, -8], [10, 8], [4, 20], [-4, 20], [-10, 8], [-16, -8]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  },
  car: {
    suv: {
      v: [[-20, -12], [-16, -18], [16, -18], [20, -12], [20, 10], [16, 14], [-16, 14], [-20, 10]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
    sports: {
      v: [[-24, -4], [-18, -12], [18, -12], [24, -4], [24, 6], [20, 10], [-20, 10], [-24, 6]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  },
  train: {
    steam: {
      v: [[-16, -20], [14, -20], [20, -14], [20, 8], [16, 20], [-10, 20], [-18, 14], [-18, -14]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
    metro: {
      v: [[-12, -22], [12, -22], [18, -16], [18, 16], [12, 22], [-12, 22], [-18, 16], [-18, -16]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  },
  bus: {
    coach: {
      v: [[-24, -10], [24, -10], [26, -4], [26, 8], [22, 12], [-22, 12], [-26, 8], [-26, -4]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
    double: {
      v: [[-18, -20], [18, -20], [20, -14], [20, 14], [16, 20], [-16, 20], [-20, 14], [-20, -14]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  },
  ferry: {
    sailboat: {
      v: [[-4, 20], [0, -22], [20, 10], [14, 20]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0]],
    },
    speedboat: {
      v: [[-22, 8], [-14, -14], [14, -14], [22, 0], [16, 14], [-16, 14]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  },
  walk: {
    hiker: {
      v: [[-2, -22], [8, -16], [12, -6], [8, 4], [14, 16], [6, 20], [-6, 20], [-14, 16], [-8, 4], [-12, -6], [-8, -16]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
    runner: {
      v: [[4, -22], [14, -12], [12, 0], [20, 14], [10, 20], [-2, 10], [-14, 20], [-20, 14], [-12, 0], [-10, -12]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  },
  bicycle: {
    scooter: {
      v: [[-14, -8], [-6, -20], [6, -20], [14, -8], [12, 12], [0, 20], [-12, 12]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
    motorcycle: {
      v: [[-20, -6], [-12, -18], [12, -18], [20, -6], [16, 10], [0, 18], [-16, 10]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  },
};

// Standard bounce animation keyframes (shared by all icons)
const POSITION_KEYFRAMES = [
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 0, s: [60, 60, 0], to: [0, -1, 0], ti: [0, 0, 0] },
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 15, s: [60, 54, 0], to: [0, 0, 0], ti: [0, -1, 0] },
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 30, s: [60, 60, 0], to: [0, -1, 0], ti: [0, 0, 0] },
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 45, s: [60, 54, 0], to: [0, 0, 0], ti: [0, -1, 0] },
  { t: 60, s: [60, 60, 0] },
];

const SCALE_KEYFRAMES = [
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 0, s: [100, 100, 100] },
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 15, s: [108, 108, 100] },
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 30, s: [100, 100, 100] },
  { i: { x: 0.667, y: 1 }, o: { x: 0.333, y: 0 }, t: 45, s: [108, 108, 100] },
  { t: 60, s: [100, 100, 100] },
];

function buildLottie(name, style, mode, shape) {
  const color = MODE_COLORS[mode];
  const softBg = MODE_SOFT_BG[mode];

  let bgGroup;
  if (style === "solid") {
    bgGroup = {
      ty: "gr",
      it: [
        { ty: "el", d: 1, s: { a: 0, k: [88, 88] }, p: { a: 0, k: [0, 0] }, nm: "bg-ellipse" },
        { ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: "bg-fill" },
      ],
      nm: "bg-group",
      np: 2,
    };
  } else if (style === "outline") {
    bgGroup = {
      ty: "gr",
      nm: "bg-group",
      np: 3,
      it: [
        { ty: "el", d: 1, s: { a: 0, k: [88, 88] }, p: { a: 0, k: [0, 0] }, nm: "bg-ellipse" },
        { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: "bg-fill" },
        { ty: "st", c: { a: 0, k: color }, o: { a: 0, k: 100 }, w: { a: 0, k: 7 }, lc: 2, lj: 2, ml: 4, bm: 0, nm: "bg-stroke" },
      ],
    };
  } else {
    // soft
    bgGroup = {
      ty: "gr",
      nm: "bg-group",
      np: 3,
      it: [
        { ty: "el", d: 1, s: { a: 0, k: [88, 88] }, p: { a: 0, k: [0, 0] }, nm: "bg-ellipse" },
        { ty: "fl", c: { a: 0, k: softBg }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: "bg-fill" },
        { ty: "st", c: { a: 0, k: color }, o: { a: 0, k: 28 }, w: { a: 0, k: 3 }, lc: 2, lj: 2, ml: 4, bm: 0, nm: "bg-stroke" },
      ],
    };
  }

  const iconFillColor = style === "solid" ? [1, 1, 1, 1] : color;

  const iconGroup = {
    ty: "gr",
    nm: "icon-group",
    np: 2,
    it: [
      {
        ty: "sh",
        d: 1,
        ks: { a: 0, k: { c: true, ...shape } },
        nm: "icon-path",
      },
      { ty: "fl", c: { a: 0, k: iconFillColor }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: "icon-fill" },
    ],
  };

  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 120,
    h: 120,
    nm: name,
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "icon-layer",
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 1, k: POSITION_KEYFRAMES },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 1, k: SCALE_KEYFRAMES },
        },
        ao: 0,
        shapes: [bgGroup, iconGroup],
        ip: 0,
        op: 60,
        st: 0,
        bm: 0,
      },
    ],
  };
}

const STYLES = ["solid", "outline", "soft"];
let count = 0;

for (const [mode, variants] of Object.entries(VARIANT_SHAPES)) {
  for (const [variant, shape] of Object.entries(variants)) {
    for (const style of STYLES) {
      const name = `${mode}-${variant}-${style}`;
      const lottie = buildLottie(name, style, mode, shape);
      const filePath = join(LOTTIE_DIR, `${name}.json`);
      writeFileSync(filePath, JSON.stringify(lottie));
      count++;
    }
  }
}

console.log(`Generated ${count} Lottie variant files.`);
