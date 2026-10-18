"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { ApiResponse, DbEvent } from "@/types/certificate";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const MEETUP_URL = "https://www.meetup.com/tulas-university-dehradun/";

/** Formats YYYY-MM-DD into display date and day of week */
function parseEventDate(iso: string) {
  if (!iso || iso.trim() === "") {
    return { formatted: "Announcing Soon", dayOfWeek: "Stay Tuned" };
  }
  try {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) {
      return { formatted: iso, dayOfWeek: "" };
    }
    const formatted = d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const dayOfWeek = d.toLocaleDateString("en-IN", { weekday: "long" });
    return { formatted, dayOfWeek };
  } catch {
    return { formatted: iso, dayOfWeek: "" };
  }
}

/** Curated conference backdrops for past events cards */
const PAST_EVENT_IMAGES = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=600&q=80",
];

export default function UpcomingEventCard() {
  const containerRef = React.useRef<HTMLElement>(null);
  const [upcomingEvent, setUpcomingEvent] = React.useState<DbEvent | null>(null);
  const [pastEvents, setPastEvents] = React.useState<
    { title: string; date: string; image: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        if (!res.ok) return;

        const json: ApiResponse<DbEvent[]> = await res.json();
        if (!json.success || !Array.isArray(json.data)) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Upcoming events: future dated events or TBA (null/empty date), sorted earliest first
        const upcoming = json.data
          .filter((item) => {
            if (!item.event_date || item.event_date.trim() === "") return true;
            const d = new Date(item.event_date + "T00:00:00");
            return !isNaN(d.getTime()) && d >= today;
          })
          .sort((a, b) => {
            if (!a.event_date) return 1;
            if (!b.event_date) return -1;
            const timeA = new Date(a.event_date + "T00:00:00").getTime();
            const timeB = new Date(b.event_date + "T00:00:00").getTime();
            return timeA - timeB;
          });

        // Past events: strictly genuine events with a valid date before today, sorted latest first (up to 3 recent, NO presets)
        const past = json.data
          .filter((item) => {
            if (!item.event_date || item.event_date.trim() === "") return false;
            const d = new Date(item.event_date + "T00:00:00");
            return !isNaN(d.getTime()) && d < today;
          })
          .sort((a, b) => {
            const timeA = new Date((a.event_date ?? "") + "T00:00:00").getTime();
            const timeB = new Date((b.event_date ?? "") + "T00:00:00").getTime();
            return timeB - timeA;
          });

        if (isMounted) {
          if (upcoming.length > 0) {
            setUpcomingEvent(upcoming[0]);
          }

          // Strictly map ONLY genuine past events from database (up to 3 recent, NO mock filler)
          if (past.length > 0) {
            const mappedPast = past.slice(0, 3).map((item, idx) => ({
              title: item.name,
              date: parseEventDate(item.event_date ?? "").formatted,
              image: PAST_EVENT_IMAGES[idx % PAST_EVENT_IMAGES.length],
            }));
            setPastEvents(mappedPast);
          } else {
            setPastEvents([]);
          }
        }
      } catch (err) {
        console.error("Failed to load events:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  // Recalculate ScrollTrigger markers when data finishes updating
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        ScrollTrigger.refresh();
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [upcomingEvent, pastEvents]);

  // GSAP Entrance Animations
  useGSAP(
    () => {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

      gsap.from(".upcoming-header-el", {
        opacity: 0,
        y: 16,
        stagger: 0.08,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".upcoming-header",
          start: isMobile ? "top 95%" : "top 90%",
          toggleActions: "play none none none",
          once: true,
        },
      });

      gsap.from(".upcoming-featured-card", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".upcoming-featured-card",
          start: isMobile ? "top 95%" : "top 90%",
          toggleActions: "play none none none",
          once: true,
        },
      });
    },
    { scope: containerRef }
  );

  const isFallback = !upcomingEvent;

  // Use real database upcoming event if available, or fallback community announcement
  const event = upcomingEvent || {
    id: "aws-upcoming-session",
    name: "Next AWS Event in the Works",
    description:
      "We are cooking up our next hands-on AWS Event Session and hackathon. Join our Meetup group to get notified the second registrations open!",
    event_date: "",
    event_timing: "To Be Announced",
    speaker_name: "AWS Student Builder Group",
    attendance_open: false,
  };

  const { formatted: eventDateFormatted, dayOfWeek: eventDayOfWeek } =
    parseEventDate(event.event_date ?? "");

  return (
    <section
      ref={containerRef}
      aria-label="Community Events Showcase"
      className="relative w-full bg-[#08080d] py-12 sm:py-20 overflow-hidden select-none"
    >
      {/* ── Ambient Background Glows ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/4 top-1/4 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[650px] rounded-full bg-primary/12 blur-[150px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-1/4 bottom-10 h-[400px] w-[600px] rounded-full bg-accent/10 blur-[160px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 z-10">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── TOP SECTION: "What's Next?" & UPCOMING EVENT CARD ────────── */}
        {/* ════════════════════════════════════════════════════════════════ */}

        <div className="relative">
          {/* Section Header Left */}
          <div className="upcoming-header max-w-2xl mb-8 sm:mb-12">
            <div className="upcoming-header-el inline-flex items-center gap-2 mb-2 sm:mb-3">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-light" />
              <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.18em] text-white/70 font-semibold">
                UPCOMING EVENT
              </span>
              <span className="w-8 sm:w-12 h-px bg-white/20" />
            </div>

            <h2 className="upcoming-header-el font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
              What&apos;s{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-purple-300 to-accent">
                Next?
              </span>
            </h2>

            <p className="upcoming-header-el text-sm sm:text-base text-white/65 mt-2.5 max-w-xl leading-relaxed">
              Join our upcoming event and be part of hands-on learning, engaging
              sessions and a growing community of builders.
            </p>
          </div>

          {/* ── THE FEATURED UPCOMING EVENT CARD ── */}
          <div className="upcoming-featured-card relative mt-8 sm:mt-12">
            {/* Peeking AWS Cloud Mascot for Desktop (Positioned on top border between upcoming event label and Register button) */}
            <div className="hidden lg:block absolute -top-24 xl:-top-28 right-56 xl:right-72 w-32 xl:w-36 z-20 pointer-events-none select-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <Image
                src="/chatbotmascot.png"
                alt="AWS Builder Mascot"
                width={200}
                height={200}
                className="w-full h-auto object-contain"
                priority
              />
            </div>

            <div className="relative rounded-[2rem] border border-primary/30 bg-gradient-to-br from-[#12101E]/95 via-[#0C0B15]/95 to-[#08070F]/95 p-5 sm:p-7 md:p-8 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(124,58,237,0.25)] ring-1 ring-white/10 overflow-hidden">
            {/* Top ambient highlight gradient line */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="pointer-events-none absolute -top-24 left-1/3 h-48 w-80 rounded-full bg-primary/20 blur-3xl" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* Left Column: Embedded Mini-Poster Stage Frame */}
              <div className="lg:col-span-5 w-full">
                <div className="relative rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-br from-[#1A1333] via-[#100C22] to-[#080511] p-5 sm:p-6 min-h-[260px] sm:min-h-[290px] flex flex-col justify-between shadow-2xl group">
                  {/* Atmospheric background conference image overlay */}
                  <div className="absolute inset-0 z-0">
                    <Image
                      src="https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80"
                      alt="Event Stage Atmosphere"
                      fill
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      className="object-cover opacity-25 group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#080511] via-[#100C22]/80 to-transparent" />
                  </div>

                  {/* Top Bar of Poster */}
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                      <Image
                        src="/logos/AWS_logo.svg"
                        alt="AWS"
                        width={30}
                        height={18}
                        className="h-3.5 w-auto brightness-200"
                      />
                      <div className="text-[9px] font-mono uppercase tracking-widest text-white/80 font-bold leading-tight">
                        STUDENT
                        <br />
                        BUILDER GROUP
                      </div>
                    </div>

                    {/* Mobile Mascot: Positioned cleanly between Student Builder Group text and SBG logo */}
                    <div className="flex lg:hidden items-center justify-center shrink-0 pointer-events-none select-none">
                      <Image
                        src="/chatbotmascot.png"
                        alt="AWS Builder Mascot"
                        width={48}
                        height={48}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                        priority
                      />
                    </div>

                    <div className="w-7 h-7 rounded-full border border-primary/30 bg-white/[0.05] p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      <Image
                        src="/logos/SBG_logo.png"
                        alt="AWS Builder Logo"
                        width={20}
                        height={20}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Middle Title Preview */}
                  <div className="relative z-10 my-auto py-3">
                    <div className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight leading-none">
                      AWS
                    </div>
                    <div className="text-2xl sm:text-3xl font-display font-extrabold text-primary-light tracking-tight mt-0.5">
                      {event.name}
                    </div>
                    <div className="mt-2.5 inline-block px-3 py-1 rounded-full border border-primary/30 text-[9.5px] font-mono tracking-widest uppercase text-white/90 bg-primary/20 backdrop-blur-md font-semibold">
                      {isFallback ? "ANNOUNCING SOON" : "OFFICIAL COMMUNITY EVENT"}
                    </div>
                  </div>

                  {/* Bottom Venue Pill */}
                  <div className="relative z-10 flex items-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[11px] text-white/90 backdrop-blur-md">
                      <MapPin className="w-3 h-3 text-primary-light shrink-0" />
                      <span className="truncate">Tula&apos;s University, Dehradun</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Detailed Info & Registration CTA */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                {/* Header row with UPCOMING EVENT and Register Now Button */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-primary-light">
                    <Calendar className="w-4 h-4" />
                    <span className="text-[11px] sm:text-xs font-mono uppercase font-bold tracking-wider">
                      {isFallback ? "COMMUNITY ANNOUNCEMENT" : "UPCOMING EVENT"}
                    </span>
                  </div>

                  {/* REGISTER NOW CTA BUTTON -> Redirects to Meetup */}
                  <a
                    href={MEETUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#6C63FF] via-[#7C3AED] to-[#8B5CF6] hover:brightness-110 text-white text-xs sm:text-sm font-bold tracking-wide shadow-lg shadow-[#7C3AED]/30 transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <span>{isFallback ? "Join on Meetup" : "Register Now"}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>

                {/* Big Title */}
                <div>
                  <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    {event.name}
                  </h3>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mt-3 line-clamp-3">
                    {event.description ||
                      "Join us for our upcoming hands-on session featuring keynote highlights, community discussions, and hands-on workshops. Learn, network, and explore the latest in cloud technology with fellow builders."}
                  </p>
                </div>

                {/* Bottom Metadata 3 Columns: Date, Time, Venue */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.08]">
                  {/* Date */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-primary-light shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10.5px] font-mono uppercase text-white/50 tracking-wider font-semibold">
                        Date
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                        {eventDateFormatted}
                      </div>
                      <div className="text-[11px] text-white/60">
                        {eventDayOfWeek || "Upcoming"}
                      </div>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-primary-light shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10.5px] font-mono uppercase text-white/50 tracking-wider font-semibold">
                        Time
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                        {event.event_timing || "11:00 AM - 01:00 PM"}
                      </div>
                      <div className="text-[11px] text-white/60">IST</div>
                    </div>
                  </div>

                  {/* Venue */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-primary-light shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10.5px] font-mono uppercase text-white/50 tracking-wider font-semibold">
                        Venue
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                        Tula&apos;s University
                      </div>
                      <div className="text-[11px] text-white/60">Dehradun</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── BOTTOM SECTION: "Moments from Our Journey." (PAST EVENTS) ─── */}
        {/* ════════════════════════════════════════════════════════════════ */}

        {pastEvents.length > 0 && (
          <div className="upcoming-past-section mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Title Block */}
            <div
              className={
                pastEvents.length === 1
                  ? "lg:col-span-4 flex flex-col justify-center space-y-2"
                  : "lg:col-span-3 flex flex-col justify-center space-y-2"
              }
            >
              <div className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary-light" />
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 font-semibold">
                  OUR PAST EVENTS
                </span>
                <span className="w-6 h-px bg-white/20" />
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Moments from <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-purple-300 to-accent">
                  Our Journey.
                </span>
              </h3>
            </div>

            {/* Genuine Past Events Photo Cards (strictly 1, 2, or up to 3 recent) */}
            <div
              className={
                pastEvents.length === 1
                  ? "lg:col-span-5 grid grid-cols-1 gap-3.5"
                  : pastEvents.length === 2
                  ? "lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5"
                  : "lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5"
              }
            >
              {pastEvents.map((item, index) => (
                <div
                  key={index}
                  className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
                >
                  {/* Image Frame */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0C0B14] via-transparent to-transparent opacity-80" />
                  </div>

                  {/* Card Info */}
                  <div className="p-3 sm:p-3.5 flex flex-col justify-between flex-grow">
                    <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-primary-light transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/60">
                      <Calendar className="w-3.5 h-3.5 text-primary-light shrink-0" />
                      <span>{item.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Rightmost "View Our Past Events" Card -> Navigates to /events */}
            <Link
              href="/events"
              className={
                pastEvents.length === 3
                  ? "lg:col-span-2 group rounded-2xl border border-primary/30 bg-gradient-to-b from-white/[0.06] to-white/[0.02] hover:bg-white/[0.09] hover:border-primary/60 transition-all duration-300 p-5 flex flex-col items-center justify-center text-center cursor-pointer shadow-lg hover:shadow-primary/10"
                  : "lg:col-span-3 group rounded-2xl border border-primary/30 bg-gradient-to-b from-white/[0.06] to-white/[0.02] hover:bg-white/[0.09] hover:border-primary/60 transition-all duration-300 p-5 flex flex-col items-center justify-center text-center cursor-pointer shadow-lg hover:shadow-primary/10"
              }
            >
              <span className="text-xs sm:text-sm font-bold text-white group-hover:text-primary-light transition-colors leading-snug">
                View Our Past Events
              </span>
              <div className="w-10 h-10 mt-4 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center text-primary-light group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-md">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
