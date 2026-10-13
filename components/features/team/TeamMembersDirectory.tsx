"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import {
  Users,
  Briefcase,
  GraduationCap,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { PixelHeading } from "@/components/ui/pixel-heading-character";
import type { DbTeamMember } from "@/types/certificate";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function TeamMembersDirectory() {
  const [members, setMembers] = useState<DbTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBatch, setActiveBatch] = useState<string>("2026-27");

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch("/api/team-members", { cache: "no-store" });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setMembers(json.data);
          // If 2026-27 exists, default to it, otherwise take first available batch
          const batches = Array.from(
            new Set(json.data.map((m: DbTeamMember) => m.batch || "2026-27"))
          ).sort((a: any, b: any) => b.localeCompare(a));
          if (batches.length > 0 && !batches.includes("2026-27")) {
            setActiveBatch(batches[0] as string);
          }
        }
      } catch (err) {
        console.error("Failed to load team members:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMembers();
  }, []);

  // Compute available batches
  const availableBatches = useMemo(() => {
    const set = new Set<string>();
    set.add("2026-27");
    members.forEach((m) => {
      if (m.batch?.trim()) set.add(m.batch.trim());
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [members]);

  // Filter members by active batch
  const currentBatchMembers = useMemo(() => {
    return members.filter((m) => (m.batch || "2026-27") === activeBatch);
  }, [members, activeBatch]);

  // Don't render the section if still loading and no members, or if DB is empty and user has not added any members
  if (!loading && members.length === 0) {
    return null;
  }

  return (
    <section className="relative py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 max-w-content mx-auto">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-36 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Section Header */}
      <div className="relative max-w-3xl mx-auto text-center mb-10 sm:mb-14">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono mb-3">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Student Builder Roster</span>
        </div>

        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
          Builders{" "}
          <PixelHeading mode="uniform" className="text-gradient">
            Directory.
          </PixelHeading>
        </h2>
        <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-md mx-auto">
          Meet the student architects and core builders driving our cloud community
        </p>
      </div>

      {/* Batch Navigation Separator / Tabs */}
      <div className="relative z-10 flex flex-col items-center gap-4 mb-10">
        <div className="p-1 rounded-2xl bg-[#0F0F16] border border-white/[0.08] flex items-center gap-1.5 overflow-x-auto max-w-full shadow-lg">
          {availableBatches.map((batch) => {
            const isSelected = activeBatch === batch;
            const isCurrent = batch === "2026-27";
            const batchCount = members.filter((m) => (m.batch || "2026-27") === batch).length;

            return (
              <button
                key={batch}
                onClick={() => setActiveBatch(batch)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-md shadow-cyan-500/25 scale-[1.02]"
                    : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <span>Batch {batch}</span>
                {isCurrent && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                      isSelected ? "bg-black/30 text-white" : "bg-cyan-500/20 text-cyan-300"
                    }`}
                  >
                    Current Team
                  </span>
                )}
                {batch < "2026-27" && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                      isSelected ? "bg-black/30 text-white" : "bg-white/[0.08] text-[#71717A]"
                    }`}
                  >
                    Alumni
                  </span>
                )}
                <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-[#52525B]"}`}>
                  ({batchCount})
                </span>
              </button>
            );
          })}
        </div>

        {/* Batch Status Caption */}
        <div className="text-center text-xs text-[#71717A] font-mono">
          Showing{" "}
          <span className="text-cyan-400 font-bold">{currentBatchMembers.length}</span> builders in{" "}
          <span className="text-white font-semibold">Batch {activeBatch}</span>
          {activeBatch === "2026-27"
            ? " (Active Working Committee)"
            : activeBatch < "2026-27"
            ? " (Previous Batch)"
            : " (Upcoming Cohort)"}
        </div>
      </div>

      {/* Grid of Team Members */}
      {currentBatchMembers.length === 0 ? (
        <div className="relative z-10 max-w-md mx-auto p-8 rounded-2xl bg-[#0D0D14] border border-white/[0.08] text-center space-y-2">
          <Users className="w-8 h-8 mx-auto text-[#52525B]" />
          <h4 className="text-sm font-semibold text-white">Batch {activeBatch} Details Coming Soon</h4>
          <p className="text-xs text-[#71717A]">
            The team lineup for this cohort is currently being finalized.
          </p>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {currentBatchMembers.map((member) => (
            <div
              key={member.id}
              className="group relative p-5 rounded-2xl bg-[#0D0D14] border border-white/[0.06] hover:border-cyan-500/30 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-1"
            >
              {/* Top Accent Gradient line on hover */}
              <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/0 group-hover:via-cyan-500/50 to-transparent transition-all duration-300" />

              <div className="space-y-4">
                {/* Header Profile Row */}
                <div className="flex items-start gap-3.5">
                  {/* Photo / Avatar */}
                  <div className="w-13 h-13 rounded-xl overflow-hidden border border-white/[0.1] bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0 group-hover:border-cyan-500/40 transition-colors">
                    {member.pic_url ? (
                      <img
                        src={member.pic_url}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <span
                      className={`text-sm font-bold text-cyan-400 font-mono ${
                        member.pic_url ? "hidden" : ""
                      }`}
                    >
                      {getInitials(member.name)}
                    </span>
                  </div>

                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {member.name}
                    </h3>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        <Briefcase className="w-2.5 h-2.5" />
                        <span className="truncate">{member.role}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Academic Metadata */}
                <div className="pt-3 border-t border-white/[0.04] space-y-1 text-xs text-[#A1A1AA]">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                    <span className="truncate">
                      {member.course} · {member.branch}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                    <span className="truncate text-[11px] text-[#71717A]">{member.year}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Batch pill */}
              <div className="mt-3 pt-2.5 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-mono text-[#52525B]">
                <span>AWS SBG</span>
                <span>Cohort {member.batch || "2026-27"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
