// ============================================================
// Turn safe DB rows into what the public pages render — PURE
// ============================================================
//
// Input is PublicMediaItem (lib/media/types.ts): the column-limited shape
// public pages are allowed to select. This file never sees uploaded_by,
// original_key, mime_type or size_bytes — they are not in that type.
//
// A row is renderable only once it has a web_key: `processing` images do
// not yet have one, so they are left out everywhere here, not just filtered
// by status. (See media_items_ready_has_web_key in the migration — the DB
// enforces the same thing from the other side.)
// ============================================================

import { publicUrl } from "./keys.ts";
import { driveThumbUrl, drivePreviewUrl, DRIVE_ID_PATTERN } from "./drive.ts";
import type { MediaKind, MediaPurpose } from "./policy.ts";
import type { PublicMediaItem } from "./types.ts";

export interface PublicMediaView {
  id: string;
  eventId: string;
  kind: MediaKind;
  purpose: MediaPurpose;
  caption: string | null;
  width: number | null;
  height: number | null;
  durationS: number | null;
  createdAt: string;
  /** Full-size / playable file. */
  url: string;
  /** Grid thumbnail. Falls back to `url` for a video (no separate thumb yet). */
  thumbUrl: string;
  /** Poster frame for a video. Undefined for an image. */
  posterUrl?: string;
  /** Google Drive player (iframe src) for a Drive video. `url` is then a still image. */
  embedUrl?: string;
  source: "s3" | "drive";
}

/**
 * One row -> one view, or null if it is not ready to show (no public file yet,
 * or an S3 row while the CDN is not configured). Drive rows need no CDN.
 */
export function toPublicView(row: PublicMediaItem, cdnBase: string | null): PublicMediaView | null {
  const common = {
    id: row.id,
    eventId: row.event_id,
    kind: row.kind,
    purpose: row.purpose,
    caption: row.caption,
    width: row.width,
    height: row.height,
    durationS: row.duration_s,
    createdAt: row.created_at,
  };

  if (row.source === "drive") {
    if (!row.drive_file_id || !DRIVE_ID_PATTERN.test(row.drive_file_id)) return null;
    const url = driveThumbUrl(row.drive_file_id, 1600);
    return {
      ...common,
      source: "drive",
      url,
      thumbUrl: driveThumbUrl(row.drive_file_id, 480),
      posterUrl: row.kind === "video" ? url : undefined,
      embedUrl: row.kind === "video" ? drivePreviewUrl(row.drive_file_id) : undefined,
    };
  }

  if (!row.web_key || !cdnBase) return null;
  const url = publicUrl(cdnBase, row.web_key);
  const thumbUrl = row.thumb_key ? publicUrl(cdnBase, row.thumb_key) : url;
  const posterUrl = row.poster_key ? publicUrl(cdnBase, row.poster_key) : undefined;
  return { ...common, source: "s3", url, thumbUrl, posterUrl };
}

/** Maps a batch, silently dropping rows that are not renderable (never throws on bad data). */
export function toPublicViews(rows: readonly PublicMediaItem[], cdnBase: string | null): PublicMediaView[] {
  const out: PublicMediaView[] = [];
  for (const row of rows) {
    const v = toPublicView(row, cdnBase);
    if (v) out.push(v);
  }
  return out;
}

export interface EventLike {
  id: string;
  name: string;
  event_date: string | null;
}

export interface GalleryGroup {
  event: EventLike;
  cover: PublicMediaView | null;
  items: PublicMediaView[];
}

/**
 * Groups items by event, newest items first within each group, groups
 * ordered by event date (most recent / soonest-unknown first). Events with
 * no media at all are left out — nothing for the gallery to show.
 */
export function groupByEvent(
  events: readonly EventLike[],
  items: readonly PublicMediaView[]
): GalleryGroup[] {
  const byEvent = new Map<string, PublicMediaView[]>();
  for (const item of items) {
    const list = byEvent.get(item.eventId);
    if (list) list.push(item);
    else byEvent.set(item.eventId, [item]);
  }

  const groups: GalleryGroup[] = [];
  for (const event of events) {
    const all = byEvent.get(event.id);
    if (!all || all.length === 0) continue;

    const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const cover = sorted.find((i) => i.purpose === "cover") ?? null;
    // The cover is featured separately; the grid shows the rest.
    const gallery = sorted.filter((i) => i !== cover);

    groups.push({ event, cover, items: gallery });
  }

  // null event_date (TBA) sorts first, like the rest of the site's event lists.
  groups.sort((a, b) => {
    const da = a.event.event_date;
    const db = b.event.event_date;
    if (da === db) return 0;
    if (da === null) return -1;
    if (db === null) return 1;
    return db.localeCompare(da);
  });

  return groups;
}

/** The single cover to show for one event (landing card / Events page), or null. */
export function pickCover(items: readonly PublicMediaView[]): PublicMediaView | null {
  return (
    items.find((i) => i.purpose === "cover") ??
    items.find((i) => i.kind === "image") ?? // a cover must be a still image
    items[0] ??
    null
  );
}
