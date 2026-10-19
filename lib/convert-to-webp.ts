// ============================================================
// Client-side Image → WebP Converter
// ============================================================
//
// Converts any browser-supported image format (PNG, JPG, BMP,
// GIF, AVIF, TIFF, etc.) to WebP using the Canvas API.
//
// Quality is set to 1.0 (maximum) by default so the converted
// image remains visually identical to the original.
//
// Usage:
//   import { convertToWebp } from "@/lib/convert-to-webp";
//   const webpFile = await convertToWebp(originalFile);
//
// ============================================================

/**
 * Convert any image File to WebP format at the specified quality.
 *
 * @param file     - The source image file (PNG, JPG, BMP, etc.)
 * @param quality  - WebP quality: 0.0 (lowest) to 1.0 (highest). Default 1.0.
 * @returns          A new File with `.webp` extension and `image/webp` MIME type.
 */
export async function convertToWebp(
  file: File,
  quality: number = 1.0
): Promise<File> {
  // Already .webp — skip conversion
  if (file.type === "image/webp") {
    return file;
  }

  // SVGs don't rasterize well through canvas at arbitrary sizes — skip them
  if (file.type === "image/svg+xml") {
    return file;
  }

  const blobUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(blobUrl);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    ctx.drawImage(img, 0, 0);

    const webpBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error(`WebP conversion failed for "${file.name}".`));
        },
        "image/webp",
        quality
      );
    });

    // Derive new filename: photo.png → photo.webp
    const baseName = file.name.replace(/\.[^.]+$/, "") || file.name;
    const webpFile = new File([webpBlob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    return webpFile;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Batch-convert multiple image Files to WebP.
 * Returns results in the same order. If a single file fails,
 * the error is logged and that file is returned unconverted.
 */
export async function convertMultipleToWebp(
  files: File[],
  quality: number = 1.0
): Promise<File[]> {
  return Promise.all(
    files.map(async (file) => {
      try {
        return await convertToWebp(file, quality);
      } catch (err) {
        console.warn(`[convert-to-webp] Skipping "${file.name}":`, err);
        return file; // Return original as fallback
      }
    })
  );
}

// ── Internal Helpers ────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image."));
    img.src = src;
  });
}
