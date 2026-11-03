// ============================================================
// Make the public versions of an uploaded photo (server only)
// ============================================================
//
// Input:  the original bytes (JPEG / PNG / WebP, already type-checked)
// Output: a "web" WebP (max 1920px) and a "thumb" WebP (max 480px)
//
// What this does on purpose:
//   - Applies the EXIF orientation, THEN drops all metadata. Phone photos
//     carry GPS location, device model and timestamps; the public files carry
//     none of it. (The private original keeps it, but is never served.)
//   - Never enlarges a small image.
//   - Refuses absurd dimensions (decompression bombs) before decoding.
//   - Reads only the first frame of animated images.
// ============================================================

import sharp from "sharp";

export const WEB_MAX_PX = 1920;
export const THUMB_MAX_PX = 480;
/** ~80 megapixels. A 12 MP phone photo is 12M; this leaves room for pro cameras. */
export const MAX_INPUT_PIXELS = 80_000_000;

export interface ProcessedImage {
  web: Uint8Array;
  thumb: Uint8Array;
  /** Dimensions of the web version (after rotation). */
  width: number;
  height: number;
}

/** The file could not be decoded as an image. Not a server fault. */
export class UnreadableImageError extends Error {
  constructor(message = "The image could not be read.") {
    super(message);
    this.name = "UnreadableImageError";
  }
}

export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  try {
    const open = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", pages: 1 });

    const web = await open()
      .rotate() // apply EXIF orientation; output has no metadata
      .resize({ width: WEB_MAX_PX, height: WEB_MAX_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const thumb = await open()
      .rotate()
      .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    return {
      web: new Uint8Array(web.data),
      thumb: new Uint8Array(thumb),
      width: web.info.width,
      height: web.info.height,
    };
  } catch (err) {
    // sharp reports bad input, oversize and corrupt data as plain Errors.
    throw new UnreadableImageError(err instanceof Error ? err.message : undefined);
  }
}
