// UpcomingEventCard component – displays the next upcoming event (current or upcoming) under the Hero section
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UpcomingEventCard() {
  const [event, setEvent] = React.useState<null | {
    title: string;
    date: string;
    isoDate: string;
    location: string;
    description: string;
    status: string;
    id: string;
  }>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load events");
        const events = json.data as Array<any>;
        // Find first non‑past event (current or upcoming)
        const upcoming = events.find((e) => e.status !== "past");
        if (upcoming) setEvent(upcoming);
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
