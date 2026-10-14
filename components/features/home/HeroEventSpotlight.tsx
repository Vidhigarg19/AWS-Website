"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  Users,
  CheckCircle2,
  Award,
  Terminal,
  ExternalLink,
  BellRing,
  Layers,
  Flame,
  Radio,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================
export type SpotlightMode = "upcoming" | "past";

interface UpcomingEventData {
  title: string;
  badge: string;
  tagline: string;
  dateStr: string;
  timeStr: string;
  venue: string;
  description: string;
  seatsLeft: number;
  totalSeats: number;
  speakers: Array<{
    name: string;
    role: string;
    avatar: string;
  }>;
  tags: string[];
  targetDate: string; // ISO date for countdown
}

interface PastEventData {
  title: string;
  badge: string;
  tagline: string;
  dateStr: string;
  venue: string;
  description: string;
  stats: Array<{
    value: string;
    label: string;
  }>;
  highlights: string[];
  speakers: Array<{
    name: string;
    role: string;
    avatar: string;
  }>;
  recapUrl: string;
}

// ============================================================================
// Mock Data (Ready to be wired to database)
// ============================================================================
const UPCOMING_EVENT_DATA: UpcomingEventData = {
  title: "AWS GenAI & Cloud Architect Summit 2026",
  badge: "NEXT FLAGSHIP EVENT",
  tagline: "Hands-on buildathon with Amazon Bedrock, Serverless & Production Pipelines",
  dateStr: "Saturday, 25 October 2026",
  timeStr: "10:00 AM – 03:30 PM IST",
  venue: "Auditorium 2 & AWS Cloud Lab, Tulas University",
  description:
    "An intensive, project-driven summit designed to take students from foundational cloud concepts to deploying autonomous AI agents on AWS. Experience live architecture reviews, hands-on labs, and win exclusive AWS swag & certification vouchers.",
  seatsLeft: 24,
  totalSeats: 120,
  speakers: [
    {
      name: "Piyush Rawat",
      role: "AWS Student Lead",
      avatar: "PR",
    },
    {
      name: "Guest AWS Architect",
      role: "Solutions Architect, AWS",
      avatar: "AWS",
    },
    {
      name: "Core Builder Team",
      role: "Technical Leads, SBG",
      avatar: "SBG",
    },
  ],
  tags: ["Amazon Bedrock", "Serverless Lambda", "DynamoDB", "LangChain / Agents"],
  targetDate: "2026-10-25T10:00:00",
};

const PAST_EVENT_DATA: PastEventData = {
  title: "Serverless Cloud Bootcamp & Live Buildathon",
  badge: "FLAGSHIP RECAP · COMPLETED",
  tagline: "180+ Student Builders deployed production microservices in 4 hours",
  dateStr: "12 September 2026",
  venue: "Computer Center Lab 3 & Central Auditorium",
  description:
    "A record-breaking hands-on technical workshop where participants architected, coded, and deployed real-world serverless APIs and dynamic event handlers on AWS with zero prior cloud backend experience.",
  stats: [
    { value: "180+", label: "Builders Trained" },
    { value: "48", label: "Live Microservices" },
    { value: "100%", label: "Hands-on Completion" },
    { value: "₹25K", label: "AWS Credits Granted" },
  ],
  highlights: [
    "Built event-driven microservices with AWS Lambda & API Gateway",
    "NoSQL data modeling in DynamoDB with automated TTL",
    "Automated CI/CD deployments using AWS CloudFormation & GitHub Actions",
  ],
  speakers: [
    {
      name: "Piyush Rawat",
      role: "Technical Lead",
      avatar: "PR",
    },
    {
      name: "Abhay Rawat",
      role: "DevOps Mentor",
      avatar: "AR",
    },
    {
      name: "Harsh Kumar",
      role: "Cloud Associate",
      avatar: "HK",
    },
  ],
  recapUrl: "/gallery",
};

// ============================================================================
// Subcomponents
// ============================================================================

/** Simple, reliable countdown component */
function CountdownDisplay({ targetIso }: { targetIso: string }) {
  const [timeLeft, setTimeLeft] = React.useState({
    days: 10,
    hours: 14,
    minutes: 32,
    seconds: 45,
  });

  React.useEffect(() => {
    const target = new Date(targetIso).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  const units = [
    { label: "DAYS", value: timeLeft.days },
    { label: "HOURS", value: timeLeft.hours },
    { label: "MINS", value: timeLeft.minutes },
    { label: "SECS", value: timeLeft.seconds },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full">
      {units.map((u, i) => (
        <div
          key={i}
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md"
        >
          <span className="font-mono text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-white">
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-[#71717A] mt-0.5">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Section Component
// ============================================================================
export function HeroEventSpotlight() {
  // Allows testing both states on frontend now. Later defaults automatically based on DB query.
  const [activeMode, setActiveMode] = React.useState<SpotlightMode>("upcoming");

  const isUpcoming = activeMode === "upcoming";

  return (
    <section className="relative w-full py-12 sm:py-16 md:py-20 px-4 sm:px-6 overflow-hidden">
      {/* Background radial ambient lights */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -top-24 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-cyan-500/10 via-purple-500/5 to-transparent blur-[120px] rounded-full"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-10 top-1/3 w-[300px] h-[300px] bg-blue-500/5 blur-[90px] rounded-full"
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Section Header with Eyebrow and Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10.5px] font-mono uppercase tracking-[0.2em] font-medium bg-white/[0.04] text-cyan-400 border border-white/[0.08] mb-3">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Event Spotlight</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
              {isUpcoming ? (
                <>
                  What&apos;s Next on the{" "}
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Horizon
                  </span>
                </>
              ) : (
                <>
                  Flagship Event{" "}
                  <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Highlights
                  </span>
                </>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1.5 max-w-xl">
              {isUpcoming
                ? "Experience hands-on cloud architecture and builder workshops at Tulas University."
                : "Upcoming session is being planned with the core team. Check out our recent flagship buildathon below."}
            </p>
          </div>

          {/* Interactive State Toggle (Allows testing upcoming vs past recap) */}
          <div className="self-start sm:self-auto flex items-center p-1 rounded-xl sm:rounded-2xl bg-[#0E0E14] border border-white/[0.08] shadow-inner">
            <button
              type="button"
              onClick={() => setActiveMode("upcoming")}
              className={`px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === "upcoming"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                  : "text-[#71717A] hover:text-white"
              }`}
            >
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>Upcoming Event</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("past")}
              className={`px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === "past"
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-md shadow-purple-500/10"
                  : "text-[#71717A] hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-purple-400" />
              <span>Past Recap</span>
            </button>
          </div>
        </div>

        {/* ── Double-Bezel (Doppelrand) Machine Enclosure Card ── */}
        <div className="relative p-1.5 sm:p-2.5 rounded-[2rem] bg-gradient-to-b from-white/[0.12] via-white/[0.04] to-transparent border border-white/[0.1] shadow-2xl shadow-cyan-950/20">
          <div className="relative rounded-[calc(2rem-0.375rem)] bg-[#0A0A10]/95 backdrop-blur-2xl p-5 sm:p-7 md:p-9 border border-white/[0.06] overflow-hidden">
            {/* Top Accent Gradient line */}
            <div className="absolute top-0 left-8 right-8 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

            <AnimatePresence mode="wait">
              {activeMode === "upcoming" ? (
                /* ==================================================== */
                /* UPCOMING EVENT VIEW                                  */
                /* ==================================================== */
                <motion.div
                  key="upcoming-event-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
                >
                  {/* Left Column: Event Core Info (7 Cols) */}
                  <div className="lg:col-span-7 space-y-4 sm:space-y-5">
                    {/* Status Pill & Live Indicator */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>Registration Open</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-mono text-[#A1A1AA] bg-white/[0.04] border border-white/[0.06]">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>{UPCOMING_EVENT_DATA.seatsLeft} seats remaining</span>
                      </span>
                    </div>

                    {/* Event Title & Tagline */}
                    <div>
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
                        {UPCOMING_EVENT_DATA.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm font-medium text-cyan-300/90 leading-relaxed">
                        {UPCOMING_EVENT_DATA.tagline}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                      {UPCOMING_EVENT_DATA.description}
                    </p>

                    {/* Metadata Chips: Date, Time & Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase text-[#71717A]">Event Date</p>
                          <p className="text-xs font-semibold text-white truncate">
                            {UPCOMING_EVENT_DATA.dateStr}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase text-[#71717A]">Timing</p>
                          <p className="text-xs font-semibold text-white truncate">
                            {UPCOMING_EVENT_DATA.timeStr}
                          </p>
                        </div>
                      </div>

                      <div className="sm:col-span-2 flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase text-[#71717A]">Venue</p>
                          <p className="text-xs font-semibold text-white truncate">
                            {UPCOMING_EVENT_DATA.venue}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Technology Topic Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {UPCOMING_EVENT_DATA.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-lg text-[10.5px] font-mono bg-white/[0.03] text-[#A1A1AA] border border-white/[0.06]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Countdown Box & CTAs (5 Cols) */}
                  <div className="lg:col-span-5 flex flex-col justify-between space-y-5 lg:pl-4 lg:border-l lg:border-white/[0.06]">
                    {/* Countdown Container Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.08] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Countdown to Kickoff</span>
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                          Live
                        </span>
                      </div>
                      <CountdownDisplay targetIso={UPCOMING_EVENT_DATA.targetDate} />
                    </div>

                    {/* Speaker Stack */}
                    <div className="p-4 rounded-2xl bg-[#0E0E16] border border-white/[0.06] space-y-2">
                      <p className="text-[10.5px] font-mono uppercase tracking-wider text-[#71717A]">
                        Featured Speakers & Mentors
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2 overflow-hidden">
                          {UPCOMING_EVENT_DATA.speakers.map((s, i) => (
                            <div
                              key={i}
                              className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 border-2 border-[#0A0A10] flex items-center justify-center text-[10px] font-bold text-white shadow"
                            >
                              {s.avatar}
                            </div>
                          ))}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {UPCOMING_EVENT_DATA.speakers[0].name} + {UPCOMING_EVENT_DATA.speakers.length - 1} others
                          </p>
                          <p className="text-[10.5px] text-[#71717A] truncate">
                            AWS Solutions Architects & SBG Mentors
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Nested "Island" Pill Architecture */}
                    <div className="space-y-2.5 pt-2">
                      <Link
                        href="/events"
                        className="group w-full h-12 px-6 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:brightness-110 text-white font-semibold text-xs sm:text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-between active:scale-[0.98] cursor-pointer"
                      >
                        <span>Reserve Your Free Seat</span>
                        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                          <ArrowRight className="w-4 h-4 text-white" />
                        </span>
                      </Link>

                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href="/events"
                          className="h-10 px-3.5 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
                          <span>Event Details</span>
                        </Link>
                        <a
                          href="https://chat.whatsapp.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-10 px-3.5 rounded-xl text-xs font-medium text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Join Community</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ==================================================== */
                /* PAST EVENT RECAP VIEW (Fallback when no upcoming)    */
                /* ==================================================== */
                <motion.div
                  key="past-event-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
                >
                  {/* Left Column: Past Event Summary & Highlights (7 Cols) */}
                  <div className="lg:col-span-7 space-y-4 sm:space-y-5">
                    {/* Status Pill */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/25">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>{PAST_EVENT_DATA.badge}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-mono text-[#A1A1AA] bg-white/[0.04] border border-white/[0.06]">
                        <Calendar className="w-3 h-3 text-[#71717A]" />
                        <span>{PAST_EVENT_DATA.dateStr}</span>
                      </span>
                    </div>

                    {/* Title & Tagline */}
                    <div>
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
                        {PAST_EVENT_DATA.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm font-medium text-purple-300/90 leading-relaxed">
                        {PAST_EVENT_DATA.tagline}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                      {PAST_EVENT_DATA.description}
                    </p>

                    {/* Impact Stats Grid (4 Bento Cards) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                      {PAST_EVENT_DATA.stats.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] text-center"
                        >
                          <p className="font-mono text-base sm:text-xl font-extrabold text-white">
                            {s.value}
                          </p>
                          <p className="text-[10px] font-mono text-[#71717A] uppercase mt-0.5 truncate">
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Key Technical Highlights */}
                    <div className="space-y-2 pt-2">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-[#71717A]">
                        What Students Built & Shipped:
                      </p>
                      <div className="space-y-1.5">
                        {PAST_EVENT_DATA.highlights.map((h, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-[#A1A1AA]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Notice Card & Gallery Link (5 Cols) */}
                  <div className="lg:col-span-5 flex flex-col justify-between space-y-5 lg:pl-4 lg:border-l lg:border-white/[0.06]">
                    {/* Next Session Announcement Banner */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-purple-500/10 via-cyan-500/5 to-transparent border border-purple-500/20 space-y-3">
                      <div className="flex items-center gap-2 text-purple-300">
                        <BellRing className="w-4 h-4 text-purple-400 shrink-0 animate-bounce" />
                        <h4 className="text-xs font-semibold tracking-wide uppercase font-mono">
                          Next Event In The Works
                        </h4>
                      </div>
                      <p className="text-xs text-[#A1A1AA] leading-relaxed">
                        Our technical leadership team is curating the agenda for our next hands-on cloud hackathon. Dates and speaker announcements will drop right here first!
                      </p>
                      <div className="pt-1">
                        <Link
                          href="/events"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <span>Suggest a topic you want to learn</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Mentors on Stage */}
                    <div className="p-4 rounded-2xl bg-[#0E0E16] border border-white/[0.06] space-y-2">
                      <p className="text-[10.5px] font-mono uppercase tracking-wider text-[#71717A]">
                        Session Mentors
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2 overflow-hidden">
                          {PAST_EVENT_DATA.speakers.map((s, i) => (
                            <div
                              key={i}
                              className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 border-2 border-[#0A0A10] flex items-center justify-center text-[10px] font-bold text-white shadow"
                            >
                              {s.avatar}
                            </div>
                          ))}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {PAST_EVENT_DATA.speakers.map((s) => s.name).join(", ")}
                          </p>
                          <p className="text-[10.5px] text-[#71717A] truncate">
                            Student Builder Leads & DevOps Specialists
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action CTAs */}
                    <div className="space-y-2.5 pt-2">
                      <Link
                        href={PAST_EVENT_DATA.recapUrl}
                        className="group w-full h-12 px-6 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:brightness-110 text-white font-semibold text-xs sm:text-sm tracking-wide transition-all shadow-lg shadow-purple-500/20 flex items-center justify-between active:scale-[0.98] cursor-pointer"
                      >
                        <span>View Photo Gallery & Recap</span>
                        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                          <ArrowRight className="w-4 h-4 text-white" />
                        </span>
                      </Link>

                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href="/learning-hub"
                          className="h-10 px-3.5 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Terminal className="w-3.5 h-3.5 text-[#71717A]" />
                          <span>Code & Slides</span>
                        </Link>
                        <Link
                          href="/events"
                          className="h-10 px-3.5 rounded-xl text-xs font-medium text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>All Past Events</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
