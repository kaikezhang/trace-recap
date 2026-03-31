/**
 * Extracts the dominant color from an image by sampling pixels on an offscreen canvas.
 * Results are cached to avoid redundant extraction.
 */

const colorCache = new Map<string, string>();

const DEFAULT_ACCENT_COLOR = "#6366f1"; // indigo-500

/**
 * Extract the dominant color from an image URL.
 * Draws to a small 50×50 offscreen canvas, samples all pixels,
 * and returns the average color as a hex string.
 */
export async function extractDominantColor(imageUrl: string): Promise<string> {
  const cached = colorCache.get(imageUrl);
  if (cached) return cached;

  try {
    const color = await extractColorFromImage(imageUrl);
    colorCache.set(imageUrl, color);
    return color;
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}

/**
 * Clear a specific entry from the color cache (e.g. when a photo is removed).
 */
export function clearColorCache(imageUrl: string): void {
  colorCache.delete(imageUrl);
}

function extractColorFromImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const size = 50;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(DEFAULT_ACCENT_COLOR);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          // Skip fully transparent pixels
          if (alpha < 128) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }

        if (count === 0) {
          resolve(DEFAULT_ACCENT_COLOR);
          return;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Boost saturation slightly so average colors aren't too muddy
        const boosted = boostSaturation(r, g, b, 1.3);
        resolve(rgbToHex(boosted.r, boosted.g, boosted.b));
      } catch {
        resolve(DEFAULT_ACCENT_COLOR);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

function boostSaturation(
  r: number,
  g: number,
  b: number,
  factor: number
): { r: number; g: number; b: number } {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return {
    r: Math.min(255, Math.max(0, Math.round(gray + factor * (r - gray)))),
    g: Math.min(255, Math.max(0, Math.round(gray + factor * (g - gray)))),
    b: Math.min(255, Math.max(0, Math.round(gray + factor * (b - gray)))),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")
  );
}
