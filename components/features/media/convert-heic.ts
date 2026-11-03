// Browser-only: turns an iPhone HEIC photo into a JPEG File.
// The converter (a few MB of WebAssembly) is loaded only when a HEIC file is
// actually chosen, so everyone else pays nothing.

import { HEIC_JPEG_QUALITY, heicToJpegName } from "@/lib/media/heic";

export async function convertHeicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import("heic-to/next");
  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: HEIC_JPEG_QUALITY });
  return new File([blob], heicToJpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
}
