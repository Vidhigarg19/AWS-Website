// UpcomingEventCard component – displays the next upcoming event (current or upcoming) under the Hero section
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calendar, Clock, ArrowRight } from "lucide-react";

/** Raw row shape returned by GET /api/events */
type DbRow = {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  event_timing: string;
  speaker_name: string | null;
  attendance_open: boolean;
};

/** Mapped UI shape */
type UiEvent = {
  title: string;
  date: string;
  location: string;
  description: string;
};

/** Formats YYYY-MM-DD → human-readable date */
function formatDisplayDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function UpcomingEventCard() {
  const [event, setEvent] = React.useState<UiEvent | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load events");

        const rows = json.data as DbRow[];

        // Find first non-past event (same logic as the Events page)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = rows.find(
          (row) => new Date(row.event_date + "T00:00:00") >= today
        );

        if (upcoming) {
          setEvent({
            title: upcoming.name,
            date: formatDisplayDate(upcoming.event_date),
            location: upcoming.speaker_name
              ? `Speaker: ${upcoming.speaker_name}`
              : "",
            description: upcoming.description ?? "",
          });
        }
      } catch (e: any) {
        toast.error(e.message || "Could not fetch upcoming event");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null; // don't render placeholder – keep hero layout stable
  if (!event) return null;

  return (
    <section className="mt-8 w-full max-w-3xl mx-auto animate-fade-in">
      <div className="rounded-2xl border border-border bg-bg-card/60 p-6 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl font-bold text-text-primary">{event.title}</h3>
          <Link href="/events" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View all events <ArrowRight size={14} />
          </Link>
        </div>
        <p className="text-sm text-text-secondary mb-4 line-clamp-2">{event.description}</p>
        <div className="flex flex-wrap gap-4 text-sm text-muted">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="shrink-0" />
            <span>{event.date}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
