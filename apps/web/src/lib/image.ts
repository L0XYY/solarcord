"use client";

// Read a device image file, resize it on a canvas, and return a compact data URL.
// (We store these directly — no object storage needed on the free tier. Resizing
//  keeps them small enough for the DB; move to R2/S3 for production scale.)
export async function fileToDataUrl(
  file: File,
  opts: { maxW: number; maxH: number; format?: "image/jpeg" | "image/png"; quality?: number },
): Promise<string> {
  const { maxW, maxH, format = "image/jpeg", quality = 0.85 } = opts;

  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = sourceUrl;
  });

  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(format, quality);
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // reject huge source files before processing
