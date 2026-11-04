"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { TEAM_WINGS } from "@/lib/team/group-members";
import { TeamMascot } from "./TeamMascot";

export function TeamHeroRedesign() {
  const heroRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const revealTargets = heroRef.current?.querySelectorAll<HTMLElement>(".team-hero-reveal");
        if (revealTargets?.length) {
          gsap.fromTo(
            revealTargets,
            { y: 22, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power2.out" }
          );
        }

        const mascot = heroRef.current?.querySelector<HTMLElement>(".team-hero-mascot");
        if (mascot) {
          gsap.to(mascot, {
            y: -8,
            duration: 3.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        }
      });
      return () => media.revert();
    },
    { scope: heroRef }
  );

  return (
    <section
      ref={heroRef}
      aria-labelledby="team-hero-title"
      className="relative isolate overflow-hidden px-5 pb-16 pt-32 sm:px-8 sm:pb-20 sm:pt-36 lg:min-h-[680px] lg:px-10 lg:pb-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-20 h-[27rem] w-[27rem] rotate-12 rounded-[5rem] bg-[linear-gradient(145deg,rgba(255,153,0,0.18),rgba(255,153,0,0.015)_65%)] blur-[1px] sm:right-0 lg:right-[8%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-0 h-72 w-[46rem] -rotate-[18deg] bg-[linear-gradient(90deg,transparent,rgba(255,153,0,0.055),transparent)]"
      />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="relative z-10 min-w-0 text-center lg:text-left">
          <p className="team-hero-reveal mx-auto inline-flex min-h-10 items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 text-[10px] font-semibold tracking-[0.2em] text-[var(--accent)] sm:text-xs lg:mx-0">
            THE TEAM BEHIND AWS SBG
          </p>
          <h1
            id="team-hero-title"
            className="team-hero-reveal mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Meet Our
            <br className="hidden sm:block" />{" "}
            <span className="text-[var(--accent)]">AWS Builders.</span>
          </h1>
          <p className="team-hero-reveal mx-auto mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base lg:mx-0">
            Community leaders and {TEAM_WINGS.length} specialized Builder Wings, united by one goal: learn, build and grow together.
          </p>

          <div className="team-hero-reveal mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <a
              href="#wings"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 text-sm font-bold text-[#171008] shadow-[0_10px_35px_rgba(255,153,0,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#FFAD33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            >
              Explore Builder Wings
            </a>
            <a
              href="#leadership"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-white/[0.02] px-6 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            >
              Meet the Leaders
            </a>
          </div>

          <div className="team-hero-reveal mt-7 flex flex-wrap justify-center gap-2 lg:justify-start">
            {[`${TEAM_WINGS.length} Builder Wings`, "2026 Core Team", "All Branches"].map((chip) => (
              <span
                key={chip}
                className="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/[0.035] px-4 text-xs text-white/70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="team-hero-reveal relative mx-auto flex min-h-[290px] w-full max-w-[470px] items-center justify-center sm:min-h-[390px] lg:min-h-[500px]">
          <div
            aria-hidden="true"
            className="absolute inset-x-[9%] top-[8%] bottom-[7%] rotate-[8deg] rounded-[3rem] border border-[var(--accent-border)] bg-[linear-gradient(145deg,rgba(255,153,0,0.18),rgba(28,23,13,0.72)_55%)] shadow-[0_0_90px_rgba(255,153,0,0.09)]"
          />
          <div className="team-hero-mascot absolute inset-x-[13%] bottom-0 top-[10%]">
            <TeamMascot
              alt="Kio pointing toward the AWS Student Builder Group team"
              className="object-contain object-bottom drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
              src="/team/kio-point-left.png"
            />
          </div>
          <div className="absolute left-0 top-5 max-w-[210px] rounded-2xl rounded-bl-sm border border-[var(--accent-border)] bg-[var(--surface)] px-4 py-3 text-xs font-medium leading-relaxed text-white shadow-xl sm:left-1 sm:top-8 sm:text-sm">
            Meet the people behind the magic!
          </div>
          <div
            aria-hidden="true"
            className="absolute bottom-7 right-2 h-16 w-16 rounded-full bg-[var(--accent-soft)] blur-2xl sm:right-0 sm:h-24 sm:w-24"
          />
        </div>
      </div>
    </section>
  );
}
