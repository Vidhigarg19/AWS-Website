"use client";

import * as React from "react";
import { MapPin } from "@/components/ui/animate-ui/icons/map-pin";
import { SquareArrowOutUpRight } from "@/components/ui/animate-ui/icons/square-arrow-out-up-right";
import { Clock } from "@/components/ui/animate-ui/icons/clock";
import { PixelHeading } from "@/components/ui/pixel-heading-character";
import { Spotlight } from "@/components/ui/spotlight";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { AnimatedCountdown } from "@/components/ui/animated-countdown";
import { RecruitmentCTA } from "@/components/recruitment/RecruitmentCTA";
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineHeading,
  TimelineItem,
  TimelineLine,
} from "@/components/ui/timeline";
import { SuggestEventSection } from "@/components/features/events/SuggestEventSection";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EventStatus = "past" | "current" | "upcoming";

type Event = {
  title: string;
  date: string;
  isoDate: string; // used for countdown target
  location: string;
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

/**
 * Determines event status relative to today.
 * The first non-past event is labelled "current"; the rest are "upcoming".
 */
function computeStatus(
  eventDate: string,
  firstFutureId: string | null,
  id: string
): EventStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(eventDate + "T00:00:00");
  if (date < today) return "past";
  if (id === firstFutureId) return "current";
  return "upcoming";
}

function getNextEvent(events: Event[]): Event | undefined {
  return events.find((e) => e.status === "current" || e.status === "upcoming");
}

function hasConcreteDate(event: Event): boolean {
  return event.isoDate !== "";
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-inset ring-white/10">
        <span className="h-1.5 w-1.5 rounded-full bg-muted" />
        Completed
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary-light ring-1 ring-inset ring-primary/20">
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

function EventCard({ event }: { event: Event }) {
  const isPast = event.status === "past";

  return (
    <SpotlightCard
      className={`border-border ${isPast ? "opacity-60 hover:opacity-80" : ""}`}
      spotlightColor={isPast ? "rgba(113, 113, 122, 0.02)" : "rgba(167, 139, 250, 0.035)"}
      borderColor={isPast ? "rgba(113, 113, 122, 0.05)" : "rgba(192, 132, 252, 0.1)"}
    >
      <div className="p-5 sm:p-6">
        {/* Top row: status + tag */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <StatusIndicator status={event.status} />
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${event.tagColor}`}
          >
            {event.tag}
          </span>
        </div>

        {/* Title */}
        <h3
          className={`font-display text-[18px] sm:text-[20px] font-semibold leading-snug transition-colors duration-200 ${
            isPast
              ? "text-text-secondary line-through decoration-muted/40"
              : "text-text-primary group-hover:text-primary-light"
          }`}
        >
          {event.title}
        </h3>

        {/* Description */}
        <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed text-text-secondary max-w-2xl">
          {event.description}
        </p>

        {/* Meta row: date + location */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Clock size={14} className="shrink-0 text-text-secondary" animateOnHover />
            <span>{event.date}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <MapPin size={14} className="shrink-0 text-text-secondary" animateOnHover />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {/* CTA — Only shown for the "Up Next" (current) event */}
        {event.status === "current" && (
          <div className="mt-5 flex items-center justify-between">
            <RecruitmentCTA
              variant="secondary"
              openText="Register for Event"
              closedText="Join Community"
              className="px-4 py-2 text-xs"
            />
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/[0.02] text-text-secondary transition-all duration-300 hover:bg-primary hover:border-primary hover:text-white hover:rotate-45 cursor-pointer">
              <SquareArrowOutUpRight size={16} animateOnHover />
            </div>
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}

/** Animated placeholder shown while data loads */
function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg-card/40 p-5 sm:p-6 animate-pulse space-y-3">
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-white/[0.06]" />
        <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
      </div>
      <div className="h-6 w-3/4 rounded bg-white/[0.06]" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-white/[0.04]" />
        <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
      </div>
      <div className="flex gap-4 pt-1">
        <div className="h-4 w-28 rounded bg-white/[0.04]" />
        <div className="h-4 w-36 rounded bg-white/[0.04]" />
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
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setFetchError(null);

      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load events");
        }

        // Determine the first non-past event so we can label it "current"
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const firstFutureRow = (
          json.data as Array<{ id: string; event_date: string }>
        ).find((row) => new Date(row.event_date + "T00:00:00") >= today);

        const firstFutureId = firstFutureRow?.id ?? null;

        // Map Supabase row → UI Event shape
        const mapped: Event[] = (
          json.data as Array<{
            id: string;
            name: string;
            description: string | null;
            event_date: string;
            event_timing: string;
            speaker_name: string | null;
            attendance_open: boolean;
          }>
        ).map((row) => {
          const status = computeStatus(row.event_date, firstFutureId, row.id);
          return {
            title: row.name,
            date: formatDisplayDate(row.event_date),
            isoDate: status !== "past" ? row.event_date + "T00:00:00" : "",
            location: row.speaker_name ? `Speaker: ${row.speaker_name}` : "",
            tag: "Workshop",
            tagColor:
              status === "past"
                ? "bg-muted/10 text-muted"
                : "bg-primary/15 text-primary-light",
            dotColor: status === "past" ? "text-muted" : "text-primary-light",
            description: row.description ?? "",
            status,
          };
        });

        if (!cancelled) setEvents(mapped);
      } catch (err: unknown) {
        if (!cancelled)
          setFetchError(
            err instanceof Error ? err.message : "Could not load events"
          );
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

  // ── GSAP animations (re-run after data loads) ────────────
  useGSAP(
    () => {
      if (loading) return;

      gsap.from(".events-header-el", {
        opacity: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".events-header-container",
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(".countdown-section", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".countdown-section",
          start: "top 90%",
          toggleActions: "play none none reverse",
        },
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
        onLeaveBack: (elements) => {
          gsap.to(elements, {
            opacity: 0,
            x: -20,
            duration: 0.4,
            overwrite: true,
          });
        },
        start: "top 88%",
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
        className="pointer-events-none absolute right-0 top-[40%] h-[400px] w-[400px] translate-x-1/4 rounded-full bg-secondary/6 blur-[150px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 bottom-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-accent/5 blur-[180px]"
      />

      <div className="relative mx-auto max-w-content px-4 sm:px-6 pt-28 pb-16 md:pt-32 md:pb-24 lg:pt-32 lg:pb-32">

        {/* ── Hero Header ──────────────────────────────────────── */}
        <div className="events-header-container">
          <p className="events-header-el text-[11px] uppercase tracking-[0.16em] text-muted">
            Upcoming Events
          </p>
          <h2 className="events-header-el mt-4 font-display text-[32px] sm:text-[36px] md:text-[44px] font-semibold leading-[1.1] tracking-tight text-text-primary">
            What&apos;s on the{" "}
            <PixelHeading mode="uniform" className="text-gradient">
              schedule.
            </PixelHeading>
          </h2>
          <p className="events-header-el mt-4 sm:mt-5 max-w-lg text-[15px] sm:text-[16px] leading-relaxed text-text-secondary">
            Workshops, hackathons, study jams, and build days — there&apos;s
            always something happening in the community.
          </p>
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
            <p className="text-[15px] text-text-secondary">
              Could not load events right now.
            </p>
            <p className="text-[13px] text-muted">{fetchError}</p>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {!loading && !fetchError && events.length === 0 && (
          <div className="mt-16 flex flex-col items-center py-20">
            <div className="inline-flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-bg-card/60 backdrop-blur-md px-8 py-7">
              <p className="text-[12px] uppercase tracking-[0.14em] text-muted flex items-center gap-2 mx-auto">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-pulse" />
                Coming Soon
              </p>
              <p className="font-display text-[22px] sm:text-[26px] font-semibold text-text-primary">
                Events being planned
              </p>
              <p className="text-[14px] text-text-secondary max-w-sm">
                Our next workshop is in the works. Stay tuned — announcements
                drop here first.
              </p>
            </div>
          </div>
        )}

        {/* ── Countdown to next event ───────────────────────────── */}
        {!loading && !fetchError && nextEvent && (
          <div className="countdown-section mt-12 sm:mt-16">
            <div className="flex flex-col items-center sm:items-start">
              {hasConcreteDate(nextEvent) ? (
                <>
                  <p className="text-[12px] uppercase tracking-[0.14em] text-muted mb-4 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-pulse" />
                    Next event starts in
                  </p>
                  <AnimatedCountdown
                    targetDate={nextEvent.isoDate}
                    variant="modern"
                    size="md"
                    completionMessage="🎉 The event is live!"
                    containerClassName="bg-bg-card/60 border-border/60 backdrop-blur-md"
                    unitClassName="bg-white/[0.03] border-white/10 hover:border-primary/30 hover:bg-white/[0.06]"
                    numberClassName="text-text-primary"
                    labelClassName="text-muted"
                    accentClassName="via-primary-light/40"
                  />
                  <p className="mt-3 text-[13px] text-text-secondary">
                    <span className="text-primary-light font-medium">
                      {nextEvent.title}
                    </span>
                    {" "}— {nextEvent.date}
                  </p>
                </>
              ) : (
                <div className="inline-flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-bg-card/60 backdrop-blur-md px-6 py-5">
                  <p className="text-[12px] uppercase tracking-[0.14em] text-muted flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-pulse" />
                    Coming up first
                  </p>
                  <p className="font-display text-[20px] sm:text-[24px] font-semibold text-text-primary">
                    {nextEvent.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary-light ring-1 ring-inset ring-primary/20">
                      <Clock size={12} className="shrink-0" animateOnHover />
                      Dates revealing soon
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Upcoming Events — Timeline ────────────────────────── */}
        {!loading && !fetchError && upcomingEvents.length > 0 && (
          <div className="mt-16 sm:mt-20">
            <Timeline positions="left" className="gap-0">
              {upcomingEvents.map((event, idx) => (
                <TimelineItem
                  key={`upcoming-${idx}`}
                  status={event.status === "past" ? "done" : "default"}
                  className="timeline-event-item"
                >
                  <TimelineHeading
                    className={`text-[13px] font-medium ${
                      event.status === "current"
                        ? "text-primary-light"
                        : "text-text-secondary"
                    }`}
                  >
                    {event.date}
                  </TimelineHeading>

                  <TimelineDot
                    status={getTimelineDotStatus(event.status)}
                    className={`${event.dotColor} ${
                      event.status === "current"
                        ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-bg scale-125"
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

        {/* ── Suggest Event Section ─────────────────────────────── */}
        <SuggestEventSection />
      </div>
    </section>
  );
}
