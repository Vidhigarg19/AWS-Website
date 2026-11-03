// ============================================================
// iPhone photos (HEIC/HEIF) — PURE helpers
// ============================================================
//
// The server cannot decode HEIC (its image library ships without the HEVC
// decoder for patent reasons), so the BROWSER converts HEIC to JPEG before
// upload (components/features/media/Uploader.tsx). After that the file is an
// ordinary JPEG and takes the normal path, including server-side verification.
//
// The server never accepts image/heic: a client that skips conversion is
// rejected by the same allowlist as any other unsupported type.
// ============================================================

interface FileLike {
  name: string;
  type: string;
}

const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

/**
 * Browsers often report "" for .heic (no OS mapping), so the extension counts too.
 */
export function isHeicFile(file: FileLike): boolean {
  if (HEIC_TYPES.has(file.type.toLowerCase())) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

/** IMG_1234.HEIC -> IMG_1234.jpg (the name is only a label; keys never use it). */
export function heicToJpegName(name: string): string {
  const base = name.replace(/\.(heic|heif)$/i, "");
  return `${base || "photo"}.jpg`;
}

/** JPEG quality for the conversion. High: the server re-encodes to WebP afterwards. */
export const HEIC_JPEG_QUALITY = 0.92;
