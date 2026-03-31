const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

export interface ImageDimensions {
  width: number;
  height: number;
}

function hasBrowserImageApis(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Image !== "undefined" &&
    typeof document !== "undefined"
  );
}

function getTargetDimensions(
  width: number,
  height: number,
): ImageDimensions {
  if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
    return { width, height };
  }

  if (width > height) {
    return {
      width: MAX_IMAGE_DIMENSION,
      height: Math.round(height * (MAX_IMAGE_DIMENSION / width)),
    };
  }

  return {
    width: Math.round(width * (MAX_IMAGE_DIMENSION / height)),
    height: MAX_IMAGE_DIMENSION,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  fallback: Blob,
): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? fallback),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function drawCompressedImage(
  src: string,
  fallback: Blob,
): Promise<Blob> {
  if (!hasBrowserImageApis()) {
    return fallback;
  }

  const img = await loadImage(src);
  const { width, height } = getTargetDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return fallback;
  }

  context.drawImage(img, 0, 0, width, height);
  return canvasToBlob(canvas, fallback);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function isImageOversized(dimensions: ImageDimensions): boolean {
  return (
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION
  );
}

export async function getImageDimensions(
  src: string,
): Promise<ImageDimensions | null> {
  if (!hasBrowserImageApis()) {
    return null;
  }

  try {
    const img = await loadImage(src);
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    };
  } catch {
    return null;
  }
}

export async function compressImage(file: File): Promise<Blob> {
  if (!hasBrowserImageApis()) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    return await drawCompressedImage(objectUrl, file);
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressDataUrl(dataUrl: string): Promise<Blob> {
  const fallback = await dataUrlToBlob(dataUrl);

  if (!hasBrowserImageApis()) {
    return fallback;
  }

  try {
    return await drawCompressedImage(dataUrl, fallback);
  } catch {
    return fallback;
  }
}
