import { getAdminClient } from "@/lib/supabase/admin";

// Always fresh: this lists live data and sits behind sign-in.
export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Date to be announced";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Date to be announced";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function MediaHomePage() {
  // Layout already verified the role. This page only READS the event list.
  const db = getAdminClient();
  let events: EventRow[] = [];
  let loadFailed = false;

  if (!db) {
    loadFailed = true;
  } else {
    const { data, error } = await db
      .from("events")
      .select("id, name, event_date")
      .order("event_date", { ascending: false, nullsFirst: true });

    if (error) {
      console.error("[media] events load error:", error.message);
      loadFailed = true;
    } else {
      events = (data ?? []) as EventRow[];
    }
  }

  return (
    <section aria-labelledby="events-heading" className="space-y-4">
      <div>
        <h2 id="events-heading" className="text-lg font-semibold">Events</h2>
        <p className="mt-1 text-sm text-[#A1A1AA]">
          Events created by the super admin appear here. Photo and video uploads
          for each event are coming next.
        </p>
      </div>

      {loadFailed ? (
        <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load events. Please try again shortly.
        </p>
      ) : events.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-[#A1A1AA]">
          No events yet. Ask a super admin to create one.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-4 p-4">
              <span className="font-medium">{event.name}</span>
              <span className="shrink-0 text-xs font-mono text-[#A1A1AA]">
                {formatDate(event.event_date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
