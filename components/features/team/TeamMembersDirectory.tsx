"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import {
  Users,
  Briefcase,
  GraduationCap,
  Calendar,
  Sparkles,
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

  // If load finished and absolutely no team members in DB, don't show empty ghost block
  if (!loading && members.length === 0) {
    return null;
  }

  return (
    <section className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-content mx-auto">
      {/* Ambient Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-48 bg-cyan-500/10 blur-[110px] rounded-full pointer-events-none z-0" />

      {/* Section Header */}
      <div className="relative max-w-2xl mx-auto text-center mb-10 sm:mb-12">
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
        <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-md mx-auto leading-relaxed">
          Meet the student architects and core builders driving our cloud community
        </p>
      </div>

      {/* Batch Navigation Tabs */}
      <div className="relative z-10 flex flex-col items-center gap-3.5 mb-10">
        <div className="p-1 rounded-2xl bg-[#0F0F16] border border-white/[0.08] flex items-center gap-1.5 overflow-x-auto max-w-full shadow-lg no-scrollbar">
          {availableBatches.map((batch) => {
            const isSelected = activeBatch === batch;
            const isCurrent = batch === "2026-27";
            const batchCount = members.filter((m) => (m.batch || "2026-27") === batch).length;

            return (
              <button
                key={batch}
                onClick={() => setActiveBatch(batch)}
                className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
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
      {loading ? (
        /* Skeletal Loader for smooth perceptual performance */
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl bg-[#0D0D14]/70 border border-white/[0.05] animate-pulse flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06]" />
                <div className="w-16 h-4 rounded-md bg-white/[0.04]" />
              </div>
              <div className="space-y-2">
                <div className="w-3/4 h-4 rounded bg-white/[0.07]" />
                <div className="w-1/2 h-3.5 rounded bg-white/[0.04]" />
              </div>
              <div className="pt-3 border-t border-white/[0.04] space-y-1.5">
                <div className="w-4/5 h-3 rounded bg-white/[0.04]" />
                <div className="w-1/3 h-3 rounded bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </div>
      ) : currentBatchMembers.length === 0 ? (
        <div className="relative z-10 max-w-md mx-auto p-8 rounded-2xl bg-[#0D0D14] border border-white/[0.08] text-center space-y-2">
          <Users className="w-8 h-8 mx-auto text-[#52525B]" />
          <h4 className="text-sm font-semibold text-white">Batch {activeBatch} Details Coming Soon</h4>
          <p className="text-xs text-[#71717A]">
            The team lineup for this cohort is currently being finalized.
          </p>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {currentBatchMembers.map((member) => (
            <div
              key={member.id}
              className="group relative p-4 sm:p-4.5 rounded-2xl bg-[#0D0D14] border border-white/[0.06] hover:border-cyan-500/30 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-1"
            >
              {/* Top Accent Gradient line on hover */}
              <div className="absolute top-0 left-4 right-4 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div>
                {/* Header Row: Avatar */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/[0.1] bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0 group-hover:border-cyan-500/40 transition-colors">
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
                      className={`text-xs font-bold text-cyan-400 font-mono ${
                        member.pic_url ? "hidden" : ""
                      }`}
                    >
                      {getInitials(member.name)}
                    </span>
                  </div>
                </div>

                {/* Identity: Full Width Name & Role */}
                <div className="mt-3 min-w-0">
                  <h3 className="text-[14.5px] sm:text-[15px] font-semibold text-white tracking-tight group-hover:text-cyan-300 transition-colors truncate">
                    {member.name}
                  </h3>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 max-w-full">
                      <Briefcase className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{member.role}</span>
                    </span>
                  </div>
                </div>

                {/* Academic Metadata */}
                <div className="pt-3 mt-3 border-t border-white/[0.04] space-y-1 text-xs text-[#A1A1AA]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GraduationCap className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                    <span className="truncate text-[11.5px]">
                      {member.course} · {member.branch}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                    <span className="truncate text-[11px] text-[#71717A] font-mono">{member.year}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Subtle Brand Watermark */}
              <div className="mt-3 pt-2.5 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-mono text-[#52525B]">
                <span>AWS SBG</span>
                <span>Builder #{member.display_order ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
