"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Sparkles, Trophy, Users, Terminal } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const BENEFITS = [
  { icon: Trophy, label: "Official AWS Badge & Certificate" },
  { icon: Shield, label: "Free AWS Cloud Credits" },
  { icon: Sparkles, label: "Direct Mentorship & Workshops" },
  { icon: Users, label: "Core Team Reveal Recognition" },
];

export function TeamCTA() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const memberCardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (cardContainerRef.current) {
      gsap.fromTo(
        cardContainerRef.current,
        { y: 35, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: {
            trigger: cardContainerRef.current,
            start: "top 85%",
            once: true,
          },
        }
      );
    }

    if (pillsRef.current) {
      const pills = pillsRef.current.querySelectorAll(".gsap-cta-pill");
      gsap.fromTo(
        pills,
        { y: 20, opacity: 0, scale: 0.94 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: {
            trigger: pillsRef.current,
            start: "top 88%",
            once: true,
          },
        }
      );
    }

    if (memberCardRef.current) {
      gsap.fromTo(
        memberCardRef.current,
        { y: 30, opacity: 0, scale: 0.94 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          delay: 0.15,
          ease: "back.out(1.2)",
          scrollTrigger: {
            trigger: memberCardRef.current,
            start: "top 88%",
            once: true,
          },
        }
      );
    }

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 200);
    return () => clearTimeout(timer);
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 max-w-content mx-auto">
      <div
        ref={cardContainerRef}
        className="relative rounded-3xl overflow-hidden border border-primary/30 shadow-[0_0_50px_-15px_rgba(124,58,237,0.35)]"
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-bg-card" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-bg-card to-bg-card" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.25)_0%,_transparent_65%)]" />

        <div className="relative z-10 p-6 sm:p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
          {/* Left — Text content */}
          <div className="flex-1 text-center lg:text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-[10px] sm:text-xs font-mono text-primary-light mb-4 sm:mb-6">
              <span className="animate-pulse">✦</span>
              <span>Limited Slots · Cohort 2026</span>
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold font-display text-text-primary tracking-tight leading-tight mb-3 sm:mb-4">
              Your name on the{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-primary-light via-accent to-purple-300 bg-clip-text text-transparent">
                  2026 Core Team
                </span>
                <svg
                  className="absolute -bottom-1.5 sm:-bottom-2 left-0 right-0 w-full"
                  height="8"
                  viewBox="0 0 300 8"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,5 Q75,0 150,5 Q225,10 300,5"
                    stroke="url(#underline-gradient)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="underline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#A78BFA" />
                      <stop offset="100%" stopColor="#C084FC" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>{" "}
              Reveal.
            </h2>

            <p className="text-text-secondary text-xs sm:text-base leading-relaxed mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0">
              Builder Wing slots are limited. Don&apos;t wait for the reveal to wish you had applied. Claim your spot today.
            </p>

            {/* Benefit pills */}
            <div ref={pillsRef} className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6 sm:mb-8">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="gsap-cta-pill flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-bg-surface/80 border border-border text-[10px] sm:text-xs font-mono text-text-secondary"
                >
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-light shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start w-full">
              <Link
                href="/register"
                className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold text-xs sm:text-sm shadow-[0_0_35px_-5px_rgba(124,58,237,0.7)] hover:shadow-[0_0_50px_-5px_rgba(124,58,237,0.9)] hover:scale-[1.02] transition-all duration-300 text-center"
              >
                <span>Submit Your Application</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#wings"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-bg-surface border border-border hover:border-primary/40 text-text-secondary hover:text-text-primary font-bold text-xs sm:text-sm transition-all duration-300 hover:scale-[1.02] text-center"
              >
                <span>View Builder Wings</span>
              </a>
            </div>
          </div>

          {/* Right — Holographic Pass Card */}
          <div ref={memberCardRef} className="w-full sm:w-auto shrink-0 lg:w-72 flex justify-center">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full max-w-[280px] rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-bg-card to-bg-card p-5 sm:p-6 shadow-[0_0_50px_-12px_rgba(124,58,237,0.4)] backdrop-blur-xl"
            >
              {/* Card glow */}
              <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.25)_0%,_transparent_60%)] pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-primary-light" />
                    <span className="text-[9px] font-mono text-primary-light tracking-widest uppercase">AWS SBG Tulas</span>
                  </div>
                  <span className="text-[9px] font-mono text-muted">2026</span>
                </div>

                {/* Avatar placeholder */}
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-3.5 shadow-inner">
                  <span className="text-xl font-bold text-primary-light font-mono">?</span>
                </div>

                <div className="h-2.5 w-24 bg-white/10 rounded-full mb-1.5" />
                <div className="h-2 w-16 bg-white/5 rounded-full mb-4" />

                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-primary/15 border border-primary/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-primary-light font-medium">Core Member · 2026</span>
                </div>

                <p className="text-[9px] text-muted font-mono mt-3.5 text-center">
                  Your slot is waiting.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
