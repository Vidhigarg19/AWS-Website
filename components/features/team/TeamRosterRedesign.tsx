"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Code2,
  Github,
  Linkedin,
  Mail,
  Megaphone,
  Video,
  type LucideIcon,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { DbTeamMember } from "@/types/certificate";
import {
  groupTeamMembers,
  normalizeTeamBatch,
  TEAM_WINGS,
  type TeamMemberForGrouping,
  type TeamWingKey,
  type WingRole,
} from "@/lib/team/group-members";

gsap.registerPlugin(ScrollTrigger);

type TeamDirectoryMember = Omit<DbTeamMember, "role"> &
  TeamMemberForGrouping & {
  role: string;
  socials?: {
    github?: string;
    linkedin?: string;
    email?: string;
  } | null;
  github?: string | null;
  linkedin?: string | null;
  email?: string | null;
};

const WING_ICONS: Record<TeamWingKey, LucideIcon> = {
  technology: Code2,
  "events-ops": CalendarDays,
  media: Video,
  "public-relations": Megaphone,
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getSocialHref(member: TeamDirectoryMember, platform: "github" | "linkedin" | "email") {
  const value = member.socials?.[platform] || member[platform];
  if (typeof value !== "string" || !value.trim() || value.trim() === "#") {
    return undefined;
  }
  return platform === "email" && !value.startsWith("mailto:")
    ? `mailto:${value}`
    : value;
}

function SocialIcon({
  label,
  href,
  children,
}: {
  label: string;
  href?: string;
  children: React.ReactNode;
}) {
  if (!href) return null;

  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/65 transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {children}
    </a>
  );
}

function MemberAvatar({ member, size = "large" }: { member: TeamDirectoryMember; size?: "large" | "small" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = size === "large" ? "h-16 w-16 sm:h-[76px] sm:w-[76px]" : "h-12 w-12";

  useEffect(() => {
    setImageFailed(false);
  }, [member.pic_url]);

  return (
    <div
      className={`${dimensions} relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--accent-border)] bg-[var(--surface-raised)] text-sm font-bold text-[var(--accent)]`}
    >
      {member.pic_url && !imageFailed ? (
        <img
          src={member.pic_url}
          alt={member.name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-label={`${member.name} initials`}>{initials(member.name)}</span>
      )}
    </div>
  );
}

function MemberCard({
  member,
  badge,
  badgeType,
  isWingCard = false,
}: {
  member: TeamDirectoryMember;
  badge: string;
  badgeType: WingRole | "core";
  isWingCard?: boolean;
}) {
  const academicLine = [member.branch || member.course, member.year]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ");

  return (
    <article
      className={`team-member-card group min-w-0 rounded-2xl border border-white/[0.09] bg-[var(--surface)] p-4 transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[0_16px_46px_rgba(255,153,0,0.08)] ${
        isWingCard ? "sm:p-5" : ""
      }`}
      data-team-member-id={member.id}
    >
      <div className="flex min-w-0 items-start gap-3">
        <MemberAvatar member={member} size={isWingCard && badgeType !== "member" ? "large" : "small"} />
        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex min-h-7 max-w-full items-center rounded-full border px-2.5 text-[9px] font-semibold uppercase tracking-[0.11em] ${
              badgeType === "core"
                ? "border-white/10 bg-white/[0.04] text-white/65"
                : "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
            }`}
          >
            <span className="truncate">{badge}</span>
          </span>
          <h3 className="mt-2 break-words font-display text-sm font-bold text-white sm:text-base">
            {member.name}
          </h3>
          <p className="mt-1 break-words text-[11px] leading-5 text-white/50">
            {academicLine || "Branch and year not listed"}
          </p>
          {isWingCard && (
            <p className="mt-2 text-xs leading-5 text-white/65">
              {member.role || "Builder"}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <SocialIcon label="GitHub" href={getSocialHref(member, "github")}>
              <Github className="h-4 w-4" aria-hidden="true" />
            </SocialIcon>
            <SocialIcon label="LinkedIn" href={getSocialHref(member, "linkedin")}>
              <Linkedin className="h-4 w-4" aria-hidden="true" />
            </SocialIcon>
            <SocialIcon label="Email" href={getSocialHref(member, "email")}>
              <Mail className="h-4 w-4" aria-hidden="true" />
            </SocialIcon>
          </div>
        </div>
      </div>
    </article>
  );
}

function WingOverviewCard({
  wing,
  members,
}: {
  wing: (typeof TEAM_WINGS)[number];
  members: TeamDirectoryMember[];
}) {
  const Icon = WING_ICONS[wing.key];

  return (
    <article className="team-roster-reveal group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[var(--surface)] p-5 transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[0_18px_50px_rgba(255,153,0,0.09)] sm:p-6">
      <span className="absolute right-5 top-5 font-mono text-xs tracking-[0.16em] text-white/35">
        {String(TEAM_WINGS.findIndex((item) => item.key === wing.key) + 1).padStart(2, "0")}
      </span>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(255,153,0,0.18)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 pr-12 font-display text-xl font-bold text-white sm:text-2xl">
        {wing.name}
      </h3>
      <p className="mt-1 text-sm text-white/55">{wing.overview}</p>
      <div className="mt-5 flex min-h-11 items-center justify-between gap-4">
        <span className="text-xs text-white/55">
          {members.length} {members.length === 1 ? "builder" : "builders"}
        </span>
        <a
          href={`#wing-${wing.key}`}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          aria-label={`View ${wing.name} members`}
        >
          View Team <span aria-hidden="true" className="ml-1">→</span>
        </a>
      </div>
    </article>
  );
}

export function TeamRosterRedesign() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [members, setMembers] = useState<TeamDirectoryMember[]>([]);
  const [activeBatch, setActiveBatch] = useState("2026-27");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadTeamMembers() {
      try {
        const response = await fetch("/api/team-members", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Team member request failed with status ${response.status}`);
        }
        const result: { success?: boolean; data?: TeamDirectoryMember[]; error?: string } =
          await response.json();
        if (!result.success || !Array.isArray(result.data)) {
          throw new Error(result.error || "The team member response was invalid.");
        }
        if (isActive) {
          setMembers(result.data);
          setLoadError(false);
        }
      } catch (error) {
        console.error("Failed to load team member directory:", error);
        if (isActive) setLoadError(true);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadTeamMembers();
    return () => {
      isActive = false;
    };
  }, []);

  const batches = useMemo(
    () =>
      Array.from(
        new Set(members.map((member) => normalizeTeamBatch(member.batch)))
      ).sort((left, right) => right.localeCompare(left)),
    [members]
  );

  useEffect(() => {
    if (batches.length > 0 && !batches.includes(activeBatch)) {
      setActiveBatch(batches.includes("2026-27") ? "2026-27" : batches[0]);
    }
  }, [activeBatch, batches]);

  const batchMembers = useMemo(
    () => members.filter((member) => normalizeTeamBatch(member.batch) === activeBatch),
    [activeBatch, members]
  );
  const grouped = useMemo(() => groupTeamMembers(batchMembers), [batchMembers]);
  const renderedMemberCount = useMemo(
    () =>
      grouped.core.length +
      TEAM_WINGS.reduce((total, wing) => {
        const membersInWing = grouped.wings[wing.key];
        return total + membersInWing.leads.length + membersInWing.coLeads.length + membersInWing.members.length;
      }, 0),
    [grouped]
  );

  useGSAP(
    () => {
      if (isLoading) return;
      const revealTargets = sectionRef.current?.querySelectorAll<HTMLElement>(".team-roster-reveal");
      if (!revealTargets?.length) return;

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          revealTargets,
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            stagger: 0.06,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 84%",
            },
          }
        );
      });
      return () => media.revert();
    },
    { scope: sectionRef, dependencies: [activeBatch, isLoading, members.length], revertOnUpdate: true }
  );

  return (
    <div ref={sectionRef} className="relative">
      <section
        aria-label="Team batch selector"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-8 sm:px-8 lg:px-10"
      >
        <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {batches.map((batch) => {
              const selected = activeBatch === batch;
              const count = members.filter((member) => normalizeTeamBatch(member.batch) === batch).length;
              const isCurrent = batch === "2026-27";
              return (
                <button
                  key={batch}
                  type="button"
                  onClick={() => setActiveBatch(batch)}
                  aria-pressed={selected}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                    selected
                      ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-white/10 bg-white/[0.025] text-white/65 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span>Batch {batch}</span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold tracking-[0.1em]">· CURRENT TEAM</span>
                  )}
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-white/55">
            {isLoading
              ? "Loading team members…"
              : loadError
                ? "The team directory is temporarily unavailable."
                : `Showing ${batchMembers.length} builders in Batch ${activeBatch}`}
          </p>
        </div>
      </section>

      {isLoading ? null : loadError ? (
        <section
          role="status"
          className="mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:px-10"
        >
          <div className="rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--surface)] px-5 py-10 text-center">
            <p className="font-display text-lg font-semibold text-white">
              Team members are coming soon
            </p>
            <p className="mt-2 text-sm text-white/55">
              We couldn&apos;t load the directory right now. Please try again soon.
            </p>
          </div>
        </section>
      ) : batchMembers.length === 0 ? (
        <section
          role="status"
          className="mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:px-10"
        >
          <div className="rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--surface)] px-5 py-10 text-center">
            <p className="font-display text-lg font-semibold text-white">
              Team members are coming soon
            </p>
            <p className="mt-2 text-sm text-white/55">
              Check back soon to meet our community builders.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section
            aria-labelledby="core-committee-title"
            className="mx-auto max-w-7xl scroll-mt-24 px-5 py-12 sm:px-8 sm:py-16 lg:px-10"
          >
            <div className="mb-8">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--accent)] sm:text-xs">
                COMMUNITY OPERATIONS
              </p>
              <h2 id="core-committee-title" className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
                <span className="text-[var(--accent)]">Core Committee.</span>
              </h2>
              <p className="mt-3 text-sm text-white/60">
                The people helping the community learn, build and grow together.
              </p>
            </div>
            {grouped.core.length > 0 ? (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {grouped.core.map((member) => (
                  <div className="team-roster-reveal min-w-0" key={member.id}>
                    <MemberCard member={member} badge={member.role || "Core Committee"} badgeType="core" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 bg-[var(--surface)] p-6 text-sm text-white/55">
                No Core Committee members are listed for this batch yet.
              </p>
            )}
          </section>

          <section
            id="wings"
            aria-labelledby="team-wings-title"
            className="mx-auto max-w-7xl scroll-mt-28 px-5 py-14 sm:px-8 sm:py-20 lg:px-10"
          >
            <div className="team-roster-reveal max-w-3xl">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--accent)] sm:text-xs">
                WING TEAMS · BATCH {activeBatch}
              </p>
              <h2 id="team-wings-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                See Our <span className="text-[var(--accent)]">Builder Wings.</span>
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base">
                Four wings. One community. Pick a wing to meet the team.
              </p>
            </div>
            <div className="mt-8 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              {TEAM_WINGS.map((wing) => (
                <WingOverviewCard key={wing.key} wing={wing} members={batchMembers.filter((member) => {
                  const groupedWing = grouped.wings[wing.key];
                  return [...groupedWing.leads, ...groupedWing.coLeads, ...groupedWing.members].some(
                    (groupMember) => groupMember.id === member.id
                  );
                })} />
              ))}
            </div>
          </section>

          {TEAM_WINGS.map((wing, index) => {
            const Icon = WING_ICONS[wing.key];
            const wingMembers = grouped.wings[wing.key];
            const memberCount =
              wingMembers.leads.length + wingMembers.coLeads.length + wingMembers.members.length;
            const roleCards = [
              ...wingMembers.leads.map((member) => ({ member, badge: "Wing Lead" })),
              ...wingMembers.coLeads.map((member) => ({ member, badge: "Co-Lead" })),
            ];
            return (
              <section
                key={wing.key}
                id={`wing-${wing.key}`}
                aria-labelledby={`wing-${wing.key}-title`}
                className="team-wing-section mx-auto max-w-7xl scroll-mt-28 px-5 py-14 sm:px-8 sm:py-16 lg:px-10"
              >
                <div className="team-roster-reveal relative flex flex-col gap-6 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--accent)] sm:text-xs">
                      {String(index + 1).padStart(2, "0")} / {String(TEAM_WINGS.length).padStart(2, "0")}
                    </p>
                    <h2 id={`wing-${wing.key}-title`} className="mt-2 break-words font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                      {wing.name.replace(/ Wing$/, "")} <span className="text-[var(--accent)]">Wing.</span>
                    </h2>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] sm:text-xs">
                      {wing.overview}
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">{wing.description}</p>
                  </div>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] transition duration-300 hover:rotate-3 hover:scale-105 sm:h-16 sm:w-16 sm:self-center">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                </div>
                <p className="mt-5 text-xs text-white/45">
                  {memberCount} {memberCount === 1 ? "builder" : "builders"}
                </p>
                {memberCount === 0 ? (
                  <div className="team-roster-reveal mt-5 rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--surface)] px-5 py-8 text-center">
                    <Icon className="mx-auto h-7 w-7 text-[var(--accent)]" aria-hidden="true" />
                    <p className="mt-3 font-semibold text-white">Team coming soon</p>
                    <p className="mt-1 text-sm text-white/55">
                      We&apos;re looking forward to introducing the {wing.name} team.
                    </p>
                  </div>
                ) : (
                  <>
                    {roleCards.length > 0 && (
                      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
                        {roleCards.map(({ member, badge }) => (
                          <div className="team-roster-reveal min-w-0" key={member.id}>
                            <MemberCard member={member} badge={badge} badgeType={badge === "Co-Lead" ? "co-lead" : "lead"} isWingCard />
                          </div>
                        ))}
                      </div>
                    )}
                    {wingMembers.members.length > 0 && (
                      <div className="mt-5 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                        {wingMembers.members.map((member) => (
                          <div className="team-roster-reveal min-w-0" key={member.id}>
                                    <MemberCard member={member} badge={member.role || "Member"} badgeType="member" isWingCard />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
          <span className="sr-only" aria-live="polite">
            {`Rendered ${renderedMemberCount} of ${batchMembers.length} team members.`}
          </span>
        </>
      )}
    </div>
  );
}
