// ============================================================
// Media row types and the SAFE column list for public queries
// ============================================================

import type { MediaKind, MediaPurpose } from "./policy.ts";
import type { MediaStatus } from "./status.ts";

/** Full row — server code only. Never send this to a browser. */
export interface MediaItemRow {
  id: string;
  event_id: string;
  uploaded_by: string | null;
  kind: MediaKind;
  purpose: MediaPurpose;
  mime_type: string;
  size_bytes: number;
  original_key: string;
  web_key: string | null;
  thumb_key: string | null;
  poster_key: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  caption: string | null;
  status: MediaStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * The ONLY columns public pages may select. Deliberately excludes
 * `uploaded_by` (staff identity), `original_key` (private S3 path) and
 * `size_bytes`/`mime_type`. tests/media/status.test.ts guards this list.
 */
export const PUBLIC_MEDIA_COLUMNS = [
  "id",
  "event_id",
  "kind",
  "purpose",
  "width",
  "height",
  "duration_s",
  "caption",
  "web_key",
  "thumb_key",
  "poster_key",
  "created_at",
] as const;

export type PublicMediaItem = Pick<MediaItemRow, (typeof PUBLIC_MEDIA_COLUMNS)[number]>;

/** Ready-made string for supabase `.select(...)`. */
export const PUBLIC_MEDIA_SELECT = PUBLIC_MEDIA_COLUMNS.join(", ");
