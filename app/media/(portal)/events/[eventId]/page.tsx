import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePortalPage } from "@/lib/auth/require-portal-page";
import { isUuid } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { DriveImport } from "@/components/features/media/DriveImport";
import { Uploader } from "@/components/features/media/Uploader";
import { MediaList, type MediaListItem } from "@/components/features/media/MediaList";

// Live data behind sign-in: never cache.
export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "Date to be announced";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Date to be announced";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function EventMediaPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  // Layouts are not re-run on client navigation, so check the role here too.
  const session = await requirePortalPage();

  const { eventId } = await params;
  if (!isUuid(eventId)) notFound();

  const db = getAdminClient();
  if (!db) {
    return (
      <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        The database is not configured.
      </p>
    );
  }

  const eventRes = await db
    .from("events")
    .select("id, name, event_date")
    .eq("id", eventId.toLowerCase())
    .maybeSingle();
  if (eventRes.error) {
    console.error("[media] event load error:", eventRes.error.message);
    return (
      <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Could not load this event. Please try again shortly.
      </p>
    );
  }
  if (!eventRes.data) notFound();
  const event = eventRes.data as { id: string; name: string; event_date: string | null };

  // Unfinished (pending) and failed uploads are noise here: show real items only.
  const mediaRes = await db
    .from("media_items")
    .select("id, uploaded_by, kind, purpose, status, size_bytes, caption, source, created_at")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .in("status", ["processing", "ready", "hidden"])
    .order("created_at", { ascending: false })
    .limit(200);

  const loadFailed = !!mediaRes.error;
  if (mediaRes.error) console.error("[media] items load error:", mediaRes.error.message);

  // Mirrors lib/media/access.ts: admins manage anything, members only their own.
  const isAdmin = session.role === "super_admin" || session.role === "admin";
  const items: MediaListItem[] = (mediaRes.data ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as "image" | "video",
    purpose: r.purpose as "cover" | "gallery",
    status: r.status as string,
    size_bytes: r.size_bytes === null ? null : Number(r.size_bytes),
    source: r.source === "drive" ? "drive" : "s3",
    caption: (r.caption as string | null) ?? null,
    created_at: r.created_at as string,
    mine: r.uploaded_by === session.user.id,
    canManage: isAdmin || r.uploaded_by === session.user.id,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/media" className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All events
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{event.name}</h2>
        <p className="mt-1 text-xs font-mono text-[#A1A1AA]">{formatDate(event.event_date)}</p>
      </div>

      <Uploader eventId={event.id} />
      <DriveImport eventId={event.id} />

      {loadFailed ? (
        <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load the uploaded items. Please try again shortly.
        </p>
      ) : (
        <MediaList items={items} />
      )}
    </div>
  );
}
