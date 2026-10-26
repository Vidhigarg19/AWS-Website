"use client";

import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function TeamDepartments() {
  const containerRef = React.useRef<HTMLElement>(null);

  useGSAP(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    gsap.from(".team-dept-el", {
      opacity: 0,
      y: 20,
      stagger: 0.12,
      duration: 0.65,
      ease: "power2.out",
      scrollTrigger: {
        trigger: ".team-dept-header",
        start: isMobile ? "top 95%" : "top 85%",
        toggleActions: "play reverse play reverse",
      },
    });
  }, { scope: containerRef });

  return (
    <section ref={containerRef} id="team" className="relative w-full overflow-hidden">

      {/* Full-width cinematic banner */}
      <div className="relative w-full bg-bg border-y border-border/60 py-20 sm:py-28 px-4 sm:px-6">

        {/* Background glow orbs */}
        <div className="pointer-events-none absolute left-1/4 top-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 -translate-y-1/2 w-[400px] h-[250px] bg-accent/8 rounded-full blur-[100px]" />

        {/* Subtle grid overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* Top glow line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="team-dept-header relative z-10 max-w-3xl mx-auto flex flex-col items-center text-center gap-8">

          {/* Eyebrow */}
          <p className="team-dept-el text-[11px] uppercase tracking-[0.16em] text-muted">
            Our Team · Cohort 2026
          </p>

          {/* Main headline */}
          <div className="team-dept-el space-y-2">
            <h2 className="font-display text-[42px] sm:text-[56px] md:text-[68px] font-bold leading-none tracking-tight text-white">
              Team
            </h2>
            <h2 className="font-display text-[42px] sm:text-[56px] md:text-[68px] font-bold leading-none tracking-tight bg-gradient-to-r from-primary-light via-accent to-purple-300 bg-clip-text text-transparent pb-3">
              Revealing Soon
            </h2>
          </div>

          {/* CTAs */}
          <div className="team-dept-el flex flex-col sm:flex-row items-center gap-3">
            <a
              href="/team"
              className="px-8 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.2] text-text-secondary hover:text-text-primary font-semibold text-sm transition-all duration-200 backdrop-blur-sm"
            >
              Explore Wings
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
