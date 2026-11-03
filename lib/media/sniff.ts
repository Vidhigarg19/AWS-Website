// ============================================================
// Real file-type detection from the first bytes — PURE
// ============================================================
//
// The Content-Type header and the file extension both come from the browser,
// so an attacker can claim "image/png" for anything. The server (complete
// step / Lambda) reads the first ~16 bytes of the stored object with a Range
// request and checks them here.
//
// This is a safety net, not a full parser: it proves the file STARTS like the
// type it claims. Full decoding (sharp / ffprobe) happens in processing.
// ============================================================

const ascii = (b: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...b.slice(start, end));

const startsWith = (b: Uint8Array, sig: number[]): boolean =>
  b.length >= sig.length && sig.every((v, i) => b[i] === v);

// MP4 "ftyp" brands that mean ordinary MP4 video (HEIC/AVIF/QuickTime brands are NOT here).
const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V "]);

/** Returns the detected MIME type, or null if the bytes match nothing we allow. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && MP4_BRANDS.has(ascii(bytes, 8, 12))) return "video/mp4";
  // EBML header: WebM (also Matroska — ffprobe in processing rejects non-WebM docTypes).
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";

  return null;
}

/** True only if the real bytes match the type the client declared. */
export function matchesDeclaredType(declaredMime: string, bytes: Uint8Array): boolean {
  const detected = sniffMime(bytes);
  return detected !== null && detected === declaredMime;
}
