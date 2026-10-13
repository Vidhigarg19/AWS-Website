"use client";

import * as React from "react";
import LightRays from "@/components/ui/light-rays";

import { TeamHero } from "./TeamHero";
import { TeamSelectionRoadmap } from "./TeamSelectionRoadmap";
import { TeamWingsHiring } from "./TeamWingsHiring";
import { TeamLeadership } from "./TeamLeadership";
import { TeamMembersDirectory } from "./TeamMembersDirectory";
import { TeamFAQ } from "./TeamFAQ";
import { TeamCTA } from "./TeamCTA";

export function Team() {
  return (
    <div className="relative bg-bg text-text-primary overflow-hidden">

      {/* Subtle WebGL Light Rays background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-15">
        <LightRays
          raysOrigin="top-center"
          raysColor="#A855F7"
          raysSpeed={0.5}
          lightSpread={0.7}
          rayLength={1.2}
          followMouse={false}
          mouseInfluence={0}
          noiseAmount={0.1}
          distortion={0.04}
          saturation={1.4}
        />
      </div>

      {/* ─── 1. Hero ─────────────────────────────────── */}
      <TeamHero />

      {/* ─── Content Sections (Plain Background) ─── */}
      <div className="relative bg-bg">

        {/* ─── 2. How Selection Works ──────────────────── */}
        <div className="border-t border-border/40">
          <TeamSelectionRoadmap />
        </div>

        {/* ─── 3. Builder Wings Directory ──────────────── */}
        <div className="border-t border-border/40">
          <TeamWingsHiring />
        </div>

        {/* ─── 4. Advisory Leadership ──────────────────── */}
        <div className="border-t border-border/40">
          <TeamLeadership />
        </div>

        {/* ─── 4.5 Student Builders Roster (by Cohort) ───── */}
        <div className="border-t border-border/40">
          <TeamMembersDirectory />
        </div>

        {/* ─── 5. FAQ ──────────────────────────────────── */}
        <div className="border-t border-border/40">
          <TeamFAQ />
        </div>
      </div>

      {/* ─── 6. Join CTA (Limited Slots · Cohort 2026) ─── */}
      <div className="relative bg-bg border-t border-border/40">
        <TeamCTA />
      </div>
    </div>
  );
}

