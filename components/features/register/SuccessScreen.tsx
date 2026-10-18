"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CursorGrid from "@/components/ui/cursor-grid";
import { ThemeStyles } from "./ThemeStyles";
import {
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Layers,
  Sparkles,
  Zap,
  Terminal,
  Award,
  Globe,
  Users,
  Mail,
  Phone,
  User,
  GraduationCap,
  FileText,
} from "lucide-react";
import dynamic from "next/dynamic";

// WebGL background (ogl) is decorative: load it after hydration instead of in the first-load bundle.
const LightRays = dynamic(() => import("@/components/ui/light-rays"), { ssr: false });

gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface SuccessScreenProps {
  result: {
    id?: string;
    submittedAt?: string;
  };
  formData?: {
    fullName?: string;
    universityEmail?: string;
    phoneNumber?: string;
    rollNumber?: string;
    resumeName?: string;
    resumeUrl?: string;
    year?: string;
    course?: string;
    branch?: string;
    wings?: string[];
  };
}

export function SuccessScreen({ result, formData }: SuccessScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const passCardRef = useRef<HTMLDivElement>(null);
  const gatewayRef = useRef<HTMLDivElement>(null);
  const roadmapRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const candidateName = formData?.fullName?.trim() || "AWS Builder Candidate";
  const wingsList = formData?.wings && formData.wings.length > 0 ? formData.wings : ["Technology", "Cloud"];
  const academicDetails = [
    formData?.year || "Cohort 2026",
    formData?.course || "Engineering",
    formData?.branch && formData.branch !== "N/A" ? formData.branch : "",
  ].filter(Boolean).join(" · ");

  useGSAP(() => {
    // 1. Header Entrance
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current.children,
        { y: 25, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
        }
      );
    }

    // 2. Holographic Boarding Pass Entrance
    if (passCardRef.current) {
      gsap.fromTo(
        passCardRef.current,
        { y: 40, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.9,
          delay: 0.25,
          ease: "power3.out",
        }
      );
    }

    // 3. Community Gateway ScrollTrigger Animation
    if (gatewayRef.current) {
      const gatewayCards = gatewayRef.current.querySelectorAll(".gsap-gateway-card");
      
      gsap.fromTo(
        gatewayRef.current,
        { y: 35, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: {
            trigger: gatewayRef.current,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        }
      );

      if (gatewayCards.length > 0) {
        gsap.fromTo(
          gatewayCards,
          { y: 25, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.65,
            stagger: 0.15,
            ease: "back.out(1.2)",
            scrollTrigger: {
              trigger: gatewayRef.current,
              start: "top 82%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    }

    // 4. Roadmap Timeline Steps ScrollTrigger Animation
    if (roadmapRef.current) {
      const stepCards = roadmapRef.current.querySelectorAll(".gsap-step-card");
      
      gsap.fromTo(
        stepCards,
        { y: 30, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.6,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: roadmapRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    }

    // 5. Explore CTA ScrollTrigger Animation
    if (ctaRef.current) {
      gsap.fromTo(
        ctaRef.current,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ctaRef.current,
            start: "top 92%",
            toggleActions: "play none none none",
          },
        }
      );
    }
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="register-page-theme relative min-h-screen bg-bg w-full overflow-x-hidden text-text-primary font-sans">
      <ThemeStyles />

      {/* ── Ambient Background Lighting ───────────────────────────────── */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] sm:h-[650px] w-[90vw] max-w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-[100px] sm:blur-[140px] opacity-75" />
      <div className="pointer-events-none absolute -left-[20%] top-[30%] h-[300px] sm:h-[500px] w-[300px] sm:w-[500px] rounded-full bg-cyan-500/10 blur-[90px] sm:blur-[130px] opacity-40" />
      <div className="pointer-events-none absolute -right-[20%] bottom-[10%] h-[350px] sm:h-[600px] w-[350px] sm:w-[600px] rounded-full bg-primary/12 blur-[100px] sm:blur-[140px] opacity-45" />

      {/* ── Static Background Grid ────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <CursorGrid
          cellSize={64}
          color="#A855F7"
          radius={0}
          lineWidth={1}
          gridOpacity={0.05}
          maxOpacity={0}
          fillOpacity={0}
          clickPulse={false}
        />
      </div>

      {/* Volumetric Light Rays */}
      <div className="absolute inset-0 z-0 overflow-hidden opacity-25 sm:opacity-30 pointer-events-none">
        <LightRays
          raysOrigin="top-center"
          raysColor="#A855F7"
          raysSpeed={0.7}
          lightSpread={0.8}
          rayLength={1.2}
          followMouse={false}
          mouseInfluence={0}
          noiseAmount={0.1}
          distortion={0.05}
          saturation={1.4}
        />
      </div>

      <main className="relative z-10 w-full max-w-[760px] mx-auto px-3.5 sm:px-6 md:px-8 pt-24 sm:pt-28 md:pt-36 pb-16 sm:pb-24">

        {/* ── Header Celebration ───────────────────────────────────────── */}
        <div
          ref={headerRef}
          className="text-center mb-6 sm:mb-10 px-2"
        >
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight leading-[1.08] mb-2 sm:mb-3">
            Application{" "}
            <span className="bg-gradient-to-r from-primary-light via-accent to-purple-300 bg-clip-text text-transparent">
              Received.
            </span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-text-secondary max-w-lg mx-auto leading-relaxed">
            Welcome to the builder pipeline. Your application profile has been submitted and queued for evaluation.
          </p>
        </div>

        {/* ── Hero Holographic Builder Boarding Pass ───────────────────── */}
        <div
          ref={passCardRef}
          className="relative mb-8 sm:mb-10 rounded-2xl sm:rounded-3xl border border-white/[0.12] bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.7),0_0_32px_-10px_rgba(124,58,237,0.25)] overflow-hidden"
        >
          {/* Top glowing accent line */}
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary-light to-transparent" />

          {/* Ticket Header */}
          <div className="p-4 sm:p-6 md:p-8 border-b border-white/[0.08] relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/30 via-purple-500/20 to-accent/30 border border-white/20 flex items-center justify-center text-primary-light shadow-[0_0_20px_-4px_rgba(168,85,247,0.5)]">
                <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-primary-light" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="font-display font-bold text-xs sm:text-sm tracking-wider text-white truncate">
                    AWS STUDENT BUILDER GROUP
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-mono px-1.5 sm:px-2 py-0.5 rounded bg-primary/20 text-primary-light border border-primary/30 shrink-0">
                    OFFICIAL PASS
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-mono text-muted truncate mt-0.5">
                  Tulas University · Dehradun Cloud Community
                </p>
              </div>
            </div>
          </div>

          {/* Ticket Body: Two-Column Data Grid */}
          <div className="p-4 sm:p-6 md:p-8 relative overflow-hidden">
            {/* Ambient inner card glow */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 sm:w-64 h-48 sm:h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none z-0" />
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">

            {/* Left Column: Candidate & Academic Info */}
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-1">
                  <User className="w-3 h-3 text-primary-light" />
                  <span>Candidate Name</span>
                </p>
                <p className="text-base sm:text-lg font-bold font-display text-text-primary tracking-tight mt-0.5 break-words">
                  {candidateName}
                </p>
              </div>

              <div>
                <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-cyan-300" />
                  <span>Academic Profile</span>
                </p>
                <p className="text-xs sm:text-sm font-mono text-text-secondary mt-0.5 break-words">
                  {academicDetails}
                </p>
              </div>

              <div>
                <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-primary-light" />
                  <span>Applied Wing(s)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {wingsList.map((wing, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-primary/15 border border-primary/30 text-[11px] sm:text-xs font-mono text-primary-light font-medium"
                    >
                      <Layers className="w-3 h-3 text-primary-light" />
                      {wing}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Email Address & Mobile Number */}
            <div className="space-y-3.5 sm:space-y-4 pt-4 md:pt-0 border-t border-white/[0.08] md:border-t-0 md:border-l md:border-white/[0.08] md:pl-6">
              <div>
                <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-1">
                  <Mail className="w-3 h-3 text-emerald-400" />
                  <span>Email Address</span>
                </p>
                <p className="text-xs sm:text-sm font-mono text-text-primary font-medium mt-0.5 break-all">
                  {formData?.universityEmail || "Registered Email"}
                </p>
              </div>

              <div>
                <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-1">
                  <Phone className="w-3 h-3 text-amber-400" />
                  <span>Mobile Number</span>
                </p>
                <p className="text-xs sm:text-sm font-mono text-text-primary font-medium mt-0.5">
                  {formData?.phoneNumber || "Registered Mobile"}
                </p>
              </div>

              {(formData?.resumeName || formData?.resumeUrl) && (
                <div>
                  <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-1">
                    <FileText className="w-3 h-3 text-primary-light" />
                    <span>Attached Resume (PDF)</span>
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary-light text-xs font-mono mt-1 font-medium truncate max-w-full">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{formData.resumeName || "Resume.pdf"}</span>
                  </span>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Ticket Footer / Barcode Banner */}
          <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 bg-white/[0.02] text-center border-t border-white/[0.08] flex items-center justify-start overflow-hidden">
            <span className="font-mono tracking-[0.25em] sm:tracking-[0.35em] text-white/30 text-[10px] sm:text-xs select-none truncate w-full text-left">
              |||||||| | |||||| | |||||||| |||||||| | ||||||||
            </span>
          </div>
        </div>

        {/* ── High-Impact Community Gateway ─────────────────────────────── */}
        <div
          ref={gatewayRef}
          className="mb-8 sm:mb-10 rounded-2xl sm:rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-purple-950/40 to-cyan-950/30 p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(124,58,237,0.3)] relative overflow-hidden"
        >
          {/* Accent glow orb */}
          <div className="absolute top-0 right-0 w-48 sm:w-72 h-48 sm:h-72 bg-gradient-to-br from-primary/20 via-accent/15 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Critical Notice Header */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] sm:text-[11px] font-mono text-amber-300 w-fit mb-3 sm:mb-4">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
            <span>MANDATORY NEXT STEPS FOR SHORTLISTING</span>
          </div>

          <h2 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">
            Complete Your Community Onboarding
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-xl mb-5 sm:mb-6">
            All interview invitations, workshop seat confirmations, cloud credits, and cohort announcements are delivered directly through our official <strong className="text-white">Meetup Group</strong> and the <strong className="text-white">AWS Builder Center</strong>. Join both channels now:
          </p>

          {/* 2 High-Conversion Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">

            {/* Card 1: Official Meetup */}
            <div className="gsap-gateway-card p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-white/[0.10] bg-white/[0.03] hover:border-[#F64060]/50 hover:bg-[#F64060]/5 transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F64060]/20 text-[#ff6b85] border border-[#F64060]/30 font-semibold">
                    STEP 1 · REQUIRED
                  </span>
                  <Users className="w-4 h-4 text-[#F64060]" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Join Official Meetup Group
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  RSVP for offline hands-on workshops, hackathons, and receive direct interview notifications.
                </p>
              </div>

              <a
                href="https://www.meetup.com/tulas-university-dehradun/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl bg-[#F64060] hover:bg-[#e03050] text-white font-bold text-xs sm:text-sm shadow-[0_0_24px_-4px_rgba(246,64,96,0.6)] group-hover:shadow-[0_0_32px_-4px_rgba(246,64,96,0.85)] hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <span>Join Meetup Group</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Card 2: AWS Builder Center */}
            <div className="gsap-gateway-card p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-white/[0.10] bg-white/[0.03] hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                    STEP 2 · RECOMMENDED
                  </span>
                  <Globe className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  AWS Builder Center Community
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Claim your official AWS Student Builder digital badge, access free AWS Cloud credits & global skill labs.
                </p>
              </div>

              <a
                href="https://builder.aws.com/content/3C075iQJeEx03mnzHwmXO9zdgEG/aws-student-builder-groups"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_24px_-4px_rgba(6,182,212,0.5)] group-hover:shadow-[0_0_32px_-4px_rgba(6,182,212,0.8)] hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <span>Join on AWS Builder Center</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>

          {/* Social Proof Badges */}
          <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-center sm:justify-around gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-muted">
            <span className="flex items-center gap-1.5">
              <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-light" />
              Official Badges & Swag
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              Free AWS Cloud Credits
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              Direct AWS Mentorship
            </span>
          </div>
        </div>

        {/* ── Interactive Next Steps Timeline ──────────────────────────── */}
        <div
          ref={roadmapRef}
          className="mb-8 sm:mb-10 space-y-3 sm:space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary-light" />
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white font-mono">
              Selection & Onboarding Roadmap
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Step 1 */}
            <div className="gsap-step-card p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm relative group hover:border-primary/40 hover:bg-white/[0.04] transition-all">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-[11px] sm:text-xs font-mono font-bold text-primary-light mb-2 sm:mb-3">
                01
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-text-primary mb-1">
                Profile Review
              </h3>
              <p className="text-[11px] sm:text-xs text-text-secondary leading-relaxed">
                Core leads review candidate credentials and branch alignment for Cohort 2026.
              </p>
            </div>

            {/* Step 2 */}
            <div className="gsap-step-card p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm relative group hover:border-cyan-500/40 hover:bg-white/[0.04] transition-all">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[11px] sm:text-xs font-mono font-bold text-cyan-300 mb-2 sm:mb-3">
                02
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-text-primary mb-1">
                Builder Interview
              </h3>
              <p className="text-[11px] sm:text-xs text-text-secondary leading-relaxed">
                Shortlisted applicants receive an interview slot via registered email & Meetup announcements.
              </p>
            </div>

            {/* Step 3 */}
            <div className="gsap-step-card p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm relative group hover:border-accent/40 hover:bg-white/[0.04] transition-all">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-[11px] sm:text-xs font-mono font-bold text-accent mb-2 sm:mb-3">
                03
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-text-primary mb-1">
                Cohort Induction
              </h3>
              <p className="text-[11px] sm:text-xs text-text-secondary leading-relaxed">
                Official induction into the AWS SBG Dehradun team, cloud workshops & projects.
              </p>
            </div>
          </div>
        </div>

        {/* ── Return Navigation Button ─────────────────────────────────── */}
        <div ref={ctaRef} className="flex items-center justify-center gap-3">
          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-white/[0.05] border border-white/[0.12] hover:border-white/[0.25] text-white font-semibold text-xs sm:text-sm hover:bg-white/[0.08] transition-all"
          >
            <span>Explore Our Site</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* ── Footer Security Badge ────────────────────────────────────── */}
        <div className="mt-8 sm:mt-10 flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto">
          <div className="inline-flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-muted font-mono leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Official AWS Student Builder Group at Tulas University</span>
          </div>
          <p className="text-[10px] text-muted/70 font-mono mt-0.5">
            No spam, ever.
          </p>
        </div>

      </main>
    </div>
  );
}
