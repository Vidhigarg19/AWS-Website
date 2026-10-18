// ============================================================
// S3 object keys — PURE, server-generated, never user-controlled
// ============================================================
//
//   events/{eventId}/original/{mediaId}.{ext}   private  (image uploads)
//   events/{eventId}/video/{mediaId}.{ext}      public   (videos, served as uploaded)
//   events/{eventId}/web/{mediaId}.webp         public   (image display size)
//   events/{eventId}/thumb/{mediaId}.webp       public   (grid thumbnail)
//   events/{eventId}/poster/{mediaId}.webp      public   (video poster frame)
//
// Keys are built ONLY from two UUIDs and an allowlisted extension, so a
// client can never choose a path, overwrite another event's file, or use
// "../" tricks. CloudFront may read only the public areas; `original/` is
// never served.
// ============================================================

import { isUuid } from "../auth/roles.ts";
import { ALLOWED_EXTENSIONS, type MediaKind } from "./policy.ts";

export type KeyArea = "original" | "video" | "web" | "thumb" | "poster";

const PUBLIC_AREAS: readonly KeyArea[] = ["video", "web", "thumb", "poster"];

function assertIds(eventId: string, mediaId: string): [string, string] {
  if (!isUuid(eventId) || !isUuid(mediaId)) {
    throw new Error("Invalid event or media id.");
  }
  // S3 keys are case-sensitive: always lowercase so one file has one key.
  return [eventId.toLowerCase(), mediaId.toLowerCase()];
}

function assertExt(ext: string): string {
  if (!ALLOWED_EXTENSIONS.includes(ext)) throw new Error("Unsupported file extension.");
  return ext;
}

/** Where the browser uploads the file. Images go to the private area. */
export function buildUploadKey(
  eventId: string,
  mediaId: string,
  kind: MediaKind,
  ext: string
): string {
  const [e, m] = assertIds(eventId, mediaId);
  const area: KeyArea = kind === "video" ? "video" : "original";
  return `events/${e}/${area}/${m}.${assertExt(ext)}`;
}

/** Keys of the generated public variants of an image (or a video's poster). */
export function buildVariantKeys(eventId: string, mediaId: string) {
  const [e, m] = assertIds(eventId, mediaId);
  return {
    web: `events/${e}/web/${m}.webp`,
    thumb: `events/${e}/thumb/${m}.webp`,
    poster: `events/${e}/poster/${m}.webp`,
  };
}

const KEY_PATTERN =
  /^events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(original|video|web|thumb|poster)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]{3,4})$/;

export interface ParsedKey {
  eventId: string;
  area: KeyArea;
  mediaId: string;
  ext: string;
}

/** Strict parser. Returns null for anything we did not generate ourselves. */
export function parseMediaKey(key: string): ParsedKey | null {
  const m = KEY_PATTERN.exec(key);
  if (!m) return null;
  const [, eventId, area, mediaId, ext] = m;
  if (!ALLOWED_EXTENSIONS.includes(ext)) return null;
  return { eventId, area: area as KeyArea, mediaId, ext };
}

/** True only for keys CloudFront is allowed to serve (never `original/`). */
export function isPublicKey(key: string): boolean {
  const parsed = parseMediaKey(key);
  return parsed !== null && PUBLIC_AREAS.includes(parsed.area);
}

/**
 * Builds the public URL for a key. Refuses private keys, so a bug elsewhere
 * can never turn an `original/` key into a link.
 */
export function publicUrl(cdnBase: string, key: string): string {
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(cdnBase)) {
    throw new Error("CDN base URL must be an https origin without a trailing slash.");
  }
  if (!isPublicKey(key)) throw new Error("Refusing to build a public URL for a non-public key.");
  return `${cdnBase}/${key}`;
}
