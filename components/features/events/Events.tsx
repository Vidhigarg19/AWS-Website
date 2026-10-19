"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Layers,
  Award,
  Zap,
  Camera,
  ArrowRight,
} from "lucide-react";
import { SquareArrowOutUpRight } from "@/components/ui/animate-ui/icons/square-arrow-out-up-right";
import { PixelHeading } from "@/components/ui/pixel-heading-character";
import { Spotlight } from "@/components/ui/spotlight";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { AnimatedCountdown } from "@/components/ui/animated-countdown";
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineHeading,
  TimelineItem,
  TimelineLine,
} from "@/components/ui/timeline";
import { SuggestEventSection } from "@/components/features/events/SuggestEventSection";
import type { ApiResponse, DbEvent } from "@/types/certificate";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const MEETUP_URL = "https://www.meetup.com/tulas-university-dehradun/";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EventStatus = "past" | "current" | "upcoming";

type Event = {
  id: string;
  title: string;
  date: string;
  rawDate: string | null; // null when the event date is TBA
  timing: string | null;
  isoDate: string; // used for countdown target
  speakerName: string | null;
  attendanceOpen: boolean;
  tag: string;
  tagColor: string;
  dotColor: string;
  description: string;
  status: EventStatus;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Formats a YYYY-MM-DD string to a human-readable date. */
function formatDisplayDate(iso: string | null): string {
  if (!iso) return ""; // TBA
  try {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Determines event status relative to today.
 * The first non-past event is labelled "current"; the rest are "upcoming".
 */
function computeStatus(
  eventDate: string | null,
  firstFutureId: string | null,
  id: string
): EventStatus {
  // TBA events (empty / null date) have no confirmed date yet — treat as upcoming
  if (!eventDate || eventDate.trim() === "") {
    return id === firstFutureId ? "current" : "upcoming";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!eventDate) return "past"; // TBA events are not countdown targets
  const date = new Date(eventDate + "T00:00:00");
  // If the date string is malformed, also treat as upcoming rather than concluded
  if (isNaN(date.getTime())) return "upcoming";
  if (date < today) return "past";
  if (id === firstFutureId) return "current";
  return "upcoming";
}

function getNextEvent(events: Event[]): Event | undefined {
  return events.find((e) => e.status === "current" || e.status === "upcoming");
}

function hasConcreteDate(event: Event): boolean {
  return Boolean(event.isoDate && event.isoDate.trim() !== "");
}

function getTimelineDotStatus(status: EventStatus) {
  if (status === "past") return "done" as const;
  if (status === "current") return "current" as const;
  return "default" as const;
}

/* ------------------------------------------------------------------ */
/*  Sub-Components                                                     */
/* ------------------------------------------------------------------ */

function StatusIndicator({ status }: { status: EventStatus }) {
  if (status === "past") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-inset ring-white/10">
        <CheckCircle2 className="h-3 w-3 text-muted" />
        Concluded
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary-light ring-1 ring-inset ring-primary/30 shadow-[0_0_12px_rgba(124,58,237,0.3)]">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-pulse" />
        Up Next
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-text-secondary ring-1 ring-inset ring-white/10">
      <span className="h-1.5 w-1.5 rounded-full bg-text-secondary/60" />
      Upcoming
    </span>
  );
}

function EventCard({ event, className }: { event: Event; className?: string }) {
  const isPast = event.status === "past";
  const isCurrent = event.status === "current";

  return (
    <SpotlightCard
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-all duration-300 flex flex-col h-full",
        isCurrent
          ? "border-primary/40 bg-bg-card/90 shadow-[0_12px_40px_-15px_rgba(124,58,237,0.25)] ring-1 ring-primary/20"
          : isPast
          ? "border-border/60 bg-bg-card/50 hover:border-border hover:bg-bg-card/70"
          : "border-border/80 bg-bg-card/75 hover:border-primary/30 hover:shadow-lg",
        className
      )}
      contentClassName="h-full flex flex-col flex-1"
      spotlightColor={
        isCurrent
          ? "rgba(167, 139, 250, 0.025)"
          : isPast
          ? "rgba(113, 113, 122, 0.01)"
          : "rgba(192, 132, 252, 0.015)"
      }
      borderColor={
        isCurrent
          ? "rgba(167, 139, 250, 0.08)"
          : isPast
          ? "rgba(113, 113, 122, 0.03)"
          : "rgba(192, 132, 252, 0.05)"
      }
    >
      {/* Top ambient glow for Up Next event */}
      {isCurrent && (
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-32 w-64 rounded-full bg-primary/20 blur-2xl" />
      )}

      <div className="p-5 sm:p-6 flex flex-col justify-between h-full flex-1">
        <div className="flex-1 flex flex-col">
          {/* Top row: Status + Category Tag + Registrations Open Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusIndicator status={event.status} />
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${event.tagColor}`}
              >
                {event.tag}
              </span>
            </div>

            {/* Registrations Open indicator for active/upcoming event */}
            {!isPast && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10.5px] font-mono font-semibold uppercase tracking-wider text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Registrations Open
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className={`font-display text-[19px] sm:text-[21px] font-semibold leading-snug tracking-tight transition-colors duration-200 ${
              isPast
                ? "text-text-primary/80 group-hover:text-text-primary"
                : "text-text-primary group-hover:text-primary-light"
            }`}
          >
            {event.title}
          </h3>

          {/* Description */}
          {event.description ? (
            <p className="mt-2.5 text-[14px] leading-relaxed text-text-secondary/90 line-clamp-3">
              {event.description}
            </p>
          ) : (
            <p className="mt-2.5 text-[14px] leading-relaxed text-text-secondary/50 italic line-clamp-3">
              Official community session & workshop.
            </p>
          )}

          {/* Metadata Chips: Date, Timing, Speaker */}
          <div className="mt-auto pt-5 border-t border-white/[0.05] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Date Chip */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-text-secondary">
              <Calendar className="w-3.5 h-3.5 text-primary-light shrink-0" />
              <span className="font-medium truncate">{event.date}</span>
            </div>

            {/* Timing Chip */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-text-secondary">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-medium truncate">{event.timing || "Schedule TBA"}</span>
            </div>

            {/* Speaker Chip */}
            {event.speakerName ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-text-secondary sm:col-span-2">
                <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium truncate">
                  Keynote: <strong className="text-white font-semibold">{event.speakerName}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-text-secondary sm:col-span-2">
                <User className="w-3.5 h-3.5 text-primary-light/80 shrink-0" />
                <span className="font-medium truncate">
                  Host: <strong className="text-white font-semibold">AWS Student Builder Group</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Strip (Footer) */}
        <div className="mt-5 pt-4 border-t border-white/[0.05]">
          {!isPast ? (
            /* Upcoming / Up Next: Prominent CTA to Meetup Registration */
            <div className="flex items-center justify-between gap-3">
              <a
                href={MEETUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:brightness-110 text-white shadow-lg shadow-[#6C63FF]/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <span>Register Now</span>
                <SquareArrowOutUpRight size={14} animateOnHover />
              </a>
              <span className="text-[11px] font-mono text-[#A1A1AA] hidden sm:inline">
                RSVP on Meetup
              </span>
            </div>
          ) : (
            /* Concluded Event: View the Moments in Gallery */
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono text-muted flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70" />
                Session Concluded
              </span>
              <Link
                href="/gallery"
                className="group/btn inline-flex items-center gap-1.5 text-xs text-primary-light hover:text-white transition-colors font-medium cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-primary-light/80 group-hover/btn:text-white transition-colors" />
                <span>View the Moments</span>
                <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}

/** Animated placeholder shown while data loads */
function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg-card/40 p-5 sm:p-6 animate-pulse flex flex-col justify-between h-full space-y-4">
      <div className="space-y-3 flex-1">
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-white/[0.06]" />
          <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-6 w-3/4 rounded bg-white/[0.06]" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-white/[0.04]" />
          <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
        </div>
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="h-8 rounded-xl bg-white/[0.04]" />
          <div className="h-8 rounded-xl bg-white/[0.04]" />
          <div className="h-8 rounded-xl bg-white/[0.04] sm:col-span-2" />
        </div>
      </div>
      <div className="pt-4 border-t border-white/[0.05] flex justify-between items-center">
        <div className="h-4 w-28 rounded bg-white/[0.04]" />
        <div className="h-4 w-24 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function Events() {
  const containerRef = React.useRef<HTMLElement>(null);

  // ── Live data ────────────────────────────────────────────
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setFetchError(null);

      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        const json: ApiResponse<DbEvent[]> = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || `Server returned error (${res.status})`);
        }

        const rawEvents: DbEvent[] = json.data ?? [];

        // Determine the first non-past event so we can label it "current"
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const firstFutureRow = rawEvents.find((row: DbEvent) => {
          const d = new Date(row.event_date + "T00:00:00");
          return !isNaN(d.getTime()) && d >= today;
        });

        const firstFutureId = firstFutureRow?.id ?? null;

        // Map Supabase rows → UI Event shape
        const mapped: Event[] = rawEvents.map((row: DbEvent) => {
          const eventDate = row.event_date ?? "";
          const status = computeStatus(eventDate, firstFutureId, row.id);
          const eventTag = row.event_type || "Event";
          const tagColorMap: Record<string, string> = {
            Workshop:  status === "past" ? "bg-violet-500/10 text-violet-400/60"  : status === "current" ? "bg-violet-500/20 text-violet-300 border border-violet-400/30" : "bg-violet-500/10 text-violet-300",
            Hackathon: status === "past" ? "bg-amber-500/10 text-amber-400/60"    : status === "current" ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"    : "bg-amber-500/10 text-amber-300",
            Quiz:      status === "past" ? "bg-sky-500/10 text-sky-400/60"        : status === "current" ? "bg-sky-500/20 text-sky-300 border border-sky-400/30"          : "bg-sky-500/10 text-sky-300",
            Event:     status === "past" ? "bg-emerald-500/10 text-emerald-400/60": status === "current" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" : "bg-emerald-500/10 text-emerald-300",
          };
          const tagColor = tagColorMap[eventTag] ?? (
            status === "past"
              ? "bg-muted/10 text-muted"
              : status === "current"
              ? "bg-primary/20 text-primary-light border border-primary/30"
              : "bg-primary/10 text-primary-light"
          );
          return {
            id: row.id,
            title: row.name,
            date: formatDisplayDate(eventDate),
            rawDate: eventDate,
            timing: row.event_timing ?? "",
            isoDate: status !== "past" && eventDate ? eventDate + "T00:00:00" : "",
            speakerName: row.speaker_name,
            attendanceOpen: row.attendance_open,
            tag: eventTag,
            tagColor,
            dotColor: status === "past" ? "text-muted" : "text-primary-light",
            description: row.description ?? "",
            status,
          };
        });

        if (!cancelled) setEvents(mapped);
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setFetchError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextEvent = getNextEvent(events);
  const upcomingEvents = events.filter((e) => e.status !== "past");
  // Sort concluded events with most recent first
  const pastEvents = [...events.filter((e) => e.status === "past")].reverse();

  // ── GSAP animations ───────────────────────────────────────
  useGSAP(
    () => {
      if (loading) return;

      gsap.from(".events-hero-left", {
        opacity: 0,
        y: 20,
        duration: 0.7,
        ease: "power2.out",
      });

      gsap.from(".events-hero-right", {
        opacity: 0,
        scale: 0.96,
        duration: 0.8,
        delay: 0.15,
        ease: "power3.out",
      });

      gsap.set(".timeline-event-item", { opacity: 0, x: -20 });
      ScrollTrigger.batch(".timeline-event-item", {
        onEnter: (elements) => {
          gsap.to(elements, {
            opacity: 1,
            x: 0,
            duration: 0.7,
            stagger: 0.15,
            ease: "power3.out",
            overwrite: true,
          });
        },
        start: "top 88%",
      });

      gsap.set(".concluded-event-item", { opacity: 0, y: 20 });
      ScrollTrigger.batch(".concluded-event-item", {
        onEnter: (elements) => {
          gsap.to(elements, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power2.out",
            overwrite: true,
          });
        },
        start: "top 92%",
      });

      const refreshTimer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 200);

      return () => clearTimeout(refreshTimer);
    },
    { scope: containerRef, dependencies: [loading] }
  );

  return (
    <section
      ref={containerRef}
      id="events"
      className="bg-grid bg-noise relative overflow-hidden bg-bg min-h-screen"
    >
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-32 max-h-[800px]" fill="#A78BFA" />

      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 -top-16 h-[420px] w-[500px] -translate-x-1/2 rounded-full bg-primary/8 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-[35%] h-[450px] w-[450px] translate-x-1/4 rounded-full bg-secondary/8 blur-[160px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 bottom-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-accent/5 blur-[180px]"
      />

      <div className="relative mx-auto max-w-content px-4 sm:px-6 pt-28 pb-16 md:pt-36 md:pb-24 lg:pt-36 lg:pb-32">

        {/* ══════════════════════════════════════════════════════ */}
        {/* ── HIGH-IMPACT 2-COLUMN HERO SECTION ────────────────── */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Headlines & Community Value */}
          <div className="events-hero-left lg:col-span-6 xl:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-[10.5px] font-mono uppercase tracking-wider text-primary-light">
              <Sparkles className="w-3.5 h-3.5 text-primary-light" />
              <span>Official Community Calendar</span>
            </div>

            <h1 className="font-display text-[34px] sm:text-[42px] md:text-[50px] font-semibold leading-[1.08] tracking-tight text-text-primary">
              What&apos;s on the{" "}
              <PixelHeading mode="uniform" className="text-gradient">
                schedule.
              </PixelHeading>
            </h1>

            <p className="max-w-xl text-[15px] sm:text-[16px] leading-relaxed text-text-secondary">
              Hands-on cloud workshops, live architectural teardowns, hackathons, and certification study sprints hosted by the AWS Student Builder Group at Tulas University.
            </p>

            {/* Quick Value Points */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 text-xs text-[#D4D4D8]">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Hands-on Cloud Labs</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <Award className="w-3.5 h-3.5 text-primary-light" />
                <span>Verified Credentials</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Free Student Access</span>
              </div>
            </div>
          </div>

          {/* Right Column: Stylish, Bigger Live Countdown Command Stage */}
          <div className="events-hero-right lg:col-span-6 xl:col-span-5 w-full">
            {nextEvent && hasConcreteDate(nextEvent) ? (
              <SpotlightCard
                className="relative overflow-hidden rounded-[2rem] border border-primary/30 bg-gradient-to-b from-[#12111A]/90 to-[#0A0A0F]/90 p-6 sm:p-7 shadow-[0_20px_60px_-15px_rgba(108,99,255,0.25)] backdrop-blur-xl ring-1 ring-white/10"
                spotlightColor="rgba(167, 139, 250, 0.03)"
                borderColor="rgba(192, 132, 252, 0.08)"
              >
                {/* Ambient Top Glow */}
                <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-28 w-60 rounded-full bg-primary/30 blur-3xl" />

                <div className="relative space-y-5">
                  {/* Stage Top Bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10.5px] font-mono uppercase tracking-wider font-semibold text-emerald-400">
                        Next Upcoming Event
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${nextEvent.tagColor}`}
                      >
                        {nextEvent.tag}
                      </span>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                      Registrations Open
                    </span>
                  </div>

                  {/* Event Title Preview */}
                  <div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight line-clamp-2">
                      {nextEvent.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary-light" />
                        <span>{nextEvent.date}</span>
                      </div>
                      {nextEvent.timing && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{nextEvent.timing}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── BIGGER, STYLISH COUNTDOWN DISPLAY ── */}
                  <div className="py-2">
                    <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted mb-2.5 flex items-center gap-1.5">
                      <span>Event starts in:</span>
                    </p>
                    <AnimatedCountdown
                      targetDate={nextEvent.isoDate}
                      variant="modern"
                      size="md"
                      completionMessage="🎉 The event is live now!"
                      containerClassName="w-full bg-black/40 border-white/[0.08] backdrop-blur-md p-2 sm:p-2.5"
                      unitClassName="bg-white/[0.035] border-white/10 hover:border-primary/40 hover:bg-white/[0.06] min-w-0 flex-1 py-2.5 sm:py-3 px-1 sm:px-2"
                      numberClassName="text-2xl sm:text-3xl lg:text-4xl font-bold font-mono tracking-tight text-white"
                      labelClassName="text-[8.5px] sm:text-[9.5px] uppercase font-mono tracking-wider text-muted font-semibold"
                      accentClassName="via-primary/50"
                    />
                  </div>

                  {/* ── CTA BUTTON TO MEETUP ── */}
                  <div className="pt-2 border-t border-white/[0.06]">
                    <a
                      href={MEETUP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-11 px-5 rounded-xl text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-[#6C63FF] via-[#7C3AED] to-[#8B5CF6] hover:brightness-110 text-white shadow-lg shadow-[#6C63FF]/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Register Now on Meetup</span>
                      <SquareArrowOutUpRight size={14} animateOnHover />
                    </a>
                  </div>
                </div>
              </SpotlightCard>
            ) : (
              /* Fallback Stage when no future countdown target is set */
              <SpotlightCard
                className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-bg-card/70 p-6 sm:p-8 backdrop-blur-xl"
                spotlightColor="rgba(167, 139, 250, 0.02)"
                borderColor="rgba(192, 132, 252, 0.05)"
              >
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-light">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Stay Connected With Us
                  </h3>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                    Join our active community on Meetup to get notified first as soon as our next hands-on cloud workshop drops.
                  </p>
                  <a
                    href={MEETUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-white transition-all cursor-pointer"
                  >
                    <span>Visit Meetup Chapter</span>
                    <SquareArrowOutUpRight size={13} />
                  </a>
                </div>
              </SpotlightCard>
            )}
          </div>
        </div>

        {/* ── Loading skeletons ────────────────────────────────── */}
        {loading && (
          <div className="mt-16 space-y-6">
            {[0, 1, 2].map((i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────── */}
        {!loading && fetchError && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center py-16">
            <p className="text-[15px] text-text-secondary font-medium">
              Could not load events right now.
            </p>
            <p className="text-[13px] text-muted max-w-md font-mono bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
              {fetchError}
            </p>
          </div>
        )}

        {/* ── Empty state (No events in DB at all) ─────────────── */}
        {!loading && !fetchError && events.length === 0 && (
          <div className="mt-16 flex flex-col items-center py-20">
            <div className="inline-flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-bg-card/60 backdrop-blur-md px-8 py-7 text-center sm:text-left">
              <p className="text-[12px] uppercase tracking-[0.14em] text-muted flex items-center gap-2 mx-auto sm:mx-0">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-pulse" />
                Coming Soon
              </p>
              <h3 className="font-display text-[22px] sm:text-[26px] font-semibold text-text-primary">
                Events being planned
              </h3>
              <p className="text-[14px] text-text-secondary max-w-sm">
                Our next workshop schedule is in the works. Announcements drop here first!
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* ── SECTION 1: UPCOMING SESSIONS (TIMELINE) ─────────── */}
        {/* ══════════════════════════════════════════════════════ */}
        {!loading && !fetchError && upcomingEvents.length > 0 && (
          <div className="mt-20 sm:mt-24">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-light animate-pulse" />
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
                  Upcoming Sessions
                </h3>
              </div>
              <span className="text-xs font-mono text-muted px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                {upcomingEvents.length} {upcomingEvents.length === 1 ? "Session Scheduled" : "Sessions Scheduled"}
              </span>
            </div>

            <Timeline positions="left" className="gap-0">
              {upcomingEvents.map((event, idx) => (
                <TimelineItem
                  key={event.id || `upcoming-${idx}`}
                  status={event.status === "past" ? "done" : "default"}
                  className="timeline-event-item"
                >
                  <TimelineHeading
                    className={`text-[13px] font-medium ${
                      event.status === "current"
                        ? "text-primary-light font-semibold"
                        : "text-text-secondary"
                    }`}
                  >
                    {event.date}
                  </TimelineHeading>

                  <TimelineDot
                    status={getTimelineDotStatus(event.status)}
                    className={`${event.dotColor} ${
                      event.status === "current"
                        ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-bg scale-125"
                        : ""
                    }`}
                  />

                  {idx < upcomingEvents.length - 1 && (
                    <TimelineLine
                      done={event.status === "past"}
                      className={
                        event.status === "current"
                          ? "bg-gradient-to-b from-primary to-muted"
                          : ""
                      }
                    />
                  )}

                  <TimelineContent className="pb-10 pt-1 w-full max-w-2xl">
                    <div className="group">
                      <EventCard event={event} />
                    </div>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* ── SECTION 2: CONCLUDED SESSIONS (ARCHIVE) ──────────── */}
        {/* ══════════════════════════════════════════════════════ */}
        {!loading && !fetchError && pastEvents.length > 0 && (
          <div className="mt-20 sm:mt-28 pt-12 border-t border-white/[0.08]">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10.5px] font-mono uppercase tracking-wider text-muted mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted" />
                  <span>Completed Archive</span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
                  Concluded Sessions
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-text-secondary max-w-lg leading-relaxed">
                  Browse previous workshops, webinars, and hackathons completed by the AWS Student Builder Group.
                </p>
              </div>

              <span className="text-xs font-mono text-muted px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.06] w-fit">
                {pastEvents.length} {pastEvents.length === 1 ? "Session Concluded" : "Sessions Concluded"}
              </span>
            </div>

            {/* Grid of Concluded Event Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {pastEvents.map((event) => (
                <div key={event.id} className="concluded-event-item h-full flex flex-col">
                  <EventCard event={event} className="h-full flex-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Suggest Event Section ─────────────────────────────── */}
        <SuggestEventSection />
      </div>
    </section>
  );
}
