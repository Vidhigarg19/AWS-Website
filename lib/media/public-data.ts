// ============================================================
// Server-side data fetchers for the public pages (server only)
// ============================================================
//
// Every query here selects ONLY lib/media/types.ts's PUBLIC_MEDIA_SELECT —
// never `.select("*")` — so uploader identity and private S3 keys can never
// leak through these paths, no matter what gets added to media_items later.
//
// If S3/CDN is not configured (lib/storage/config.ts), S3 rows are skipped
// (Drive rows still show). Pages render rather than 500. A missing cover or gallery
// section is a worse outcome, but not a broken site.
// ============================================================

import { getAdminClient } from "../supabase/admin";
import { getStorage } from "../storage/s3";
import { groupByEvent, pickCover, toPublicViews, type EventLike, type GalleryGroup, type PublicMediaView } from "./public-view";
import { PUBLIC_MEDIA_SELECT, type PublicMediaItem } from "./types";

/** Covers for several events in one query. Missing/unconfigured -> empty map. */
export async function getEventCovers(eventIds: readonly string[]): Promise<Map<string, PublicMediaView>> {
  const out = new Map<string, PublicMediaView>();
  if (eventIds.length === 0) return out;

  const storage = getStorage();
  const db = getAdminClient();
  if (!db) return out;

  const { data, error } = await db
    .from("media_items")
    .select(PUBLIC_MEDIA_SELECT)
    .in("event_id", eventIds)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[media/public-data] getEventCovers error:", error.message);
    return out;
  }

  const views = toPublicViews((data ?? []) as unknown as PublicMediaItem[], storage?.config.cdnUrl ?? null);
  const byEvent = new Map<string, PublicMediaView[]>();
  for (const v of views) {
    const list = byEvent.get(v.eventId);
    if (list) list.push(v);
    else byEvent.set(v.eventId, [v]);
  }
  for (const [eventId, items] of byEvent) {
    const cover = pickCover(items);
    if (cover) out.set(eventId, cover);
  }
  return out;
}

/** Cover for a single event, or null. */
export async function getEventCover(eventId: string): Promise<PublicMediaView | null> {
  return (await getEventCovers([eventId])).get(eventId) ?? null;
}

/** Everything ready and public for one event, newest first (gallery excludes the cover). */
export async function getEventMedia(eventId: string): Promise<{ cover: PublicMediaView | null; items: PublicMediaView[] }> {
  const storage = getStorage();
  const db = getAdminClient();
  if (!db) return { cover: null, items: [] };

  const { data, error } = await db
    .from("media_items")
    .select(PUBLIC_MEDIA_SELECT)
    .eq("event_id", eventId)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[media/public-data] getEventMedia error:", error.message);
    return { cover: null, items: [] };
  }

  const all = toPublicViews((data ?? []) as unknown as PublicMediaItem[], storage?.config.cdnUrl ?? null);
  const cover = pickCover(all.filter((i) => i.purpose === "cover"));
  const items = all.filter((i) => i !== cover);
  return { cover, items };
}

/** The full gallery: every event that has at least one ready item, grouped. */
export async function getGalleryGroups(events: readonly EventLike[]): Promise<GalleryGroup[]> {
  const storage = getStorage();
  const db = getAdminClient();
  if (!db || events.length === 0) return [];

  const { data, error } = await db
    .from("media_items")
    .select(PUBLIC_MEDIA_SELECT)
    .in("event_id", events.map((e) => e.id))
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[media/public-data] getGalleryGroups error:", error.message);
    return [];
  }

  const views = toPublicViews((data ?? []) as unknown as PublicMediaItem[], storage?.config.cdnUrl ?? null);
  return groupByEvent(events, views);
}
