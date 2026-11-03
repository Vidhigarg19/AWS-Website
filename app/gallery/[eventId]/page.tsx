import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, Film } from "lucide-react";
import { isUuid } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { getEventMedia } from "@/lib/media/public-data";
import { formatEventDate } from "@/lib/media/format";
import { MediaGrid, type LightboxItem } from "@/components/features/gallery/Lightbox";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
}

async function loadEvent(eventId: string): Promise<EventRow | null> {
  const db = getAdminClient();
  if (!db) return null;
  const { data, error } = await db.from("events").select("id, name, event_date").eq("id", eventId).maybeSingle();
  if (error) {
    console.error("[gallery/[eventId]] event load error:", error.message);
    return null;
  }
  return (data as EventRow | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  if (!isUuid(eventId)) return { title: "Gallery" };
  const event = await loadEvent(eventId.toLowerCase());
  if (!event) return { title: "Gallery" };
  return {
    title: `${event.name} — Gallery`,
    description: `Photos and videos from ${event.name}, an AWS Student Builder Group event at Tula's University.`,
    alternates: { canonical: `/gallery/${event.id}` },
  };
}

export default async function EventGalleryPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!isUuid(eventId)) notFound();

  const event = await loadEvent(eventId.toLowerCase());
  if (!event) notFound();

  const { cover, items } = await getEventMedia(event.id);
  const all: LightboxItem[] = [...(cover ? [cover] : []), ...items];
  const photoCount = all.filter((i) => i.kind === "image").length;
  const videoCount = all.filter((i) => i.kind === "video").length;

  return (
    <main className="relative mx-auto max-w-content px-4 sm:px-6 pt-28 pb-20 md:pt-32 md:pb-28">
      <Link href="/gallery" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All events
      </Link>

      <h1 className="mt-4 font-display text-[28px] sm:text-[34px] font-semibold tracking-tight text-text-primary">
        {event.name}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-text-secondary">
        <span>{formatEventDate(event.event_date)}</span>
        {photoCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" aria-hidden="true" /> {photoCount} photo{photoCount === 1 ? "" : "s"}
          </span>
        )}
        {videoCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Film className="h-3.5 w-3.5" aria-hidden="true" /> {videoCount} video{videoCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="mt-10">
        {all.length === 0 ? (
          <p className="rounded-2xl border border-border bg-bg-card/40 p-8 text-center text-sm text-text-secondary">
            No photos or videos have been uploaded for this event yet.
          </p>
        ) : (
          <MediaGrid items={all} />
        )}
      </div>
    </main>
  );
}
