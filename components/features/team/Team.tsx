"use client";

import * as React from "react";

import { TeamHeroRedesign } from "./TeamHeroRedesign";
import { TeamLeadershipRedesign } from "./TeamLeadershipRedesign";
import { TeamRosterRedesign } from "./TeamRosterRedesign";
import { TeamFAQ } from "./TeamFAQ";
import { TeamMascot } from "./TeamMascot";

export function Team() {
  return (
    <div
      className="relative isolate w-full overflow-x-clip text-[var(--foreground)]"
      style={{
        "--background": "#070604",
        "--surface": "#0F0C08",
        "--surface-raised": "#1C170D",
        "--foreground": "#FFFFFF",
        "--accent": "#FF9900",
        "--accent-soft": "rgba(255,153,0,0.12)",
        "--accent-border": "rgba(255,153,0,0.25)",
        "--muted": "rgba(255,255,255,0.6)",
        backgroundColor: "var(--background)",
      } as React.CSSProperties}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -left-1/4 top-[24rem] h-80 w-[90rem] -rotate-[17deg] bg-[linear-gradient(90deg,transparent,rgba(255,153,0,0.045),transparent)]" />
        <div className="absolute -right-1/3 top-[78rem] h-72 w-[80rem] rotate-[22deg] bg-[linear-gradient(90deg,transparent,rgba(255,153,0,0.035),transparent)]" />
      </div>

      <div className="relative z-10">
        <TeamHeroRedesign />

        <div className="border-t border-white/[0.08]">
          <TeamLeadershipRedesign />
        </div>
        <div className="border-t border-white/[0.08]">
          <TeamRosterRedesign />
        </div>
        <div className="border-t border-white/[0.08]">
          <TeamFAQ />
        </div>
        <section
          aria-label="Team closing"
          className="relative mx-auto flex min-h-[250px] max-w-7xl items-center justify-center overflow-hidden px-5 py-10 sm:min-h-[300px] sm:px-8 lg:px-10"
        >
          <div aria-hidden="true" className="absolute inset-x-1/4 bottom-0 h-32 rounded-full bg-[var(--accent-soft)] blur-[90px]" />
          <div className="relative flex min-h-[220px] w-full max-w-[300px] items-end justify-center">
            <div aria-hidden="true" className="absolute bottom-0 left-1/2 h-44 w-44 -translate-x-1/2 rotate-[-8deg] rounded-[2.5rem] border border-[var(--accent-border)] bg-[linear-gradient(145deg,rgba(255,153,0,0.14),rgba(28,23,13,0.52))]" />
            <div className="absolute inset-x-[10%] bottom-0 top-[7%]">
              <TeamMascot
                alt="Kio bowing goodbye to the AWS Student Builder Group community"
                className="object-contain object-bottom"
                src="/team/kio-bow-end.png"
              />
            </div>
            <p className="absolute right-0 top-0 rounded-2xl rounded-br-sm border border-[var(--accent-border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-white shadow-xl">
              See you soon!
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
