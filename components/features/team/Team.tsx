"use client";

import * as React from "react";

import { TeamHeroRedesign } from "./TeamHeroRedesign";
import { TeamSelectionRoadmap } from "./TeamSelectionRoadmap";
import { TeamWingsRedesign } from "./TeamWingsRedesign";
import { TeamLeadershipRedesign } from "./TeamLeadershipRedesign";
import { TeamMembersDirectory } from "./TeamMembersDirectory";
import { TeamFAQ } from "./TeamFAQ";
import { TeamCTA } from "./TeamCTA";

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

        {/* ─── Content Sections ────────────────────────── */}
        <div className="relative">
          <div className="border-t border-border/40">
            <TeamSelectionRoadmap />
          </div>

          <div className="border-t border-border/40">
            <TeamWingsRedesign />
          </div>

          <div className="border-t border-border/40">
            <TeamLeadershipRedesign />
          </div>

          <div className="border-t border-border/40">
            <TeamMembersDirectory />
          </div>

          <div className="border-t border-border/40">
            <TeamFAQ />
          </div>
        </div>

        <div className="relative border-t border-border/40">
          <TeamCTA />
        </div>
      </div>
    </div>
  );
}
