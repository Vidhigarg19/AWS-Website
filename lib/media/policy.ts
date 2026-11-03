// ============================================================
// Media upload policy — PURE constants (no framework or Node imports)
// ============================================================
//
// What may be uploaded, and how big. This is the single source of truth used
// by the init API, the presigned-POST policy and the unit tests.
//
// Why these types only:
//   - JPEG / PNG / WebP: every browser can show them and sharp can resize them.
//   - MP4 / WebM: play natively in browsers.
//   - HEIC (iPhone photos) is NOT stored as-is: the browser converts it to JPEG
//     before upload (components/features/media/convert-heic.ts), so only JPEG
//     reaches S3. MOV (iPhone video) is unsupported: export as MP4.
//
// The browser-declared Content-Type is only a first filter. The real type is
// verified from the file's own bytes (see ./sniff.ts).
// ============================================================

export type MediaKind = "image" | "video";

export interface AllowedType {
  kind: MediaKind;
  /** File extension used in the S3 key. Never taken from the user's filename. */
  ext: string;
  maxBytes: number;
}

const MB = 1024 * 1024;

export const IMAGE_MAX_BYTES = 25 * MB;
export const VIDEO_MAX_BYTES = 500 * MB;

export const ALLOWED_TYPES: Readonly<Record<string, AllowedType>> = {
  "image/jpeg": { kind: "image", ext: "jpg", maxBytes: IMAGE_MAX_BYTES },
  "image/png": { kind: "image", ext: "png", maxBytes: IMAGE_MAX_BYTES },
  "image/webp": { kind: "image", ext: "webp", maxBytes: IMAGE_MAX_BYTES },
  "video/mp4": { kind: "video", ext: "mp4", maxBytes: VIDEO_MAX_BYTES },
  "video/webm": { kind: "video", ext: "webm", maxBytes: VIDEO_MAX_BYTES },
};

/** Extensions that can ever appear in an original/video key. */
export const ALLOWED_EXTENSIONS: readonly string[] = Object.values(ALLOWED_TYPES).map(
  (t) => t.ext
);

export const MAX_FILES_PER_REQUEST = 20;
export const MAX_CAPTION_LENGTH = 280;
/** How long a presigned upload permission stays valid. */
export const PRESIGN_TTL_SECONDS = 600;
/** Max not-yet-completed uploads one user may hold (limits orphaned files). */
export const MAX_PENDING_PER_USER = 100;
/** How many leading bytes of an uploaded file we read to check its real type. */
export const SNIFF_BYTES = 32;

export type MediaPurpose = "cover" | "gallery";
export const MEDIA_PURPOSES: readonly MediaPurpose[] = ["cover", "gallery"];
