"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Code2,
  Github,
  Linkedin,
  Mail,
  Megaphone,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { DbTeamMember } from "@/types/certificate";
import { DEPARTMENTS, NETWORK_NODES, type TeamMember } from "./data";
import { TeamMascot } from "./TeamMascot";

type WingPresentation = {
  id: string;
  departmentId?: string;
  networkNodeId: string;
  number: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
};

const WING_PRESENTATION: WingPresentation[] = [
  {
    id: "technology",
    departmentId: "dept-tech",
    networkNodeId: "node-tech",
    number: "01",
    tagline: "Code · Web · AI",
    description:
      "Building the apps, tools and AI features that power our community projects.",
    icon: Code2,
  },
  {
    id: "events-ops",
    departmentId: "dept-events",
    networkNodeId: "node-events",
    number: "02",
    tagline: "Planning · Logistics · Experience",
    description:
      "Planning and running workshops, hackathons and talks from start to finish.",
    icon: CalendarDays,
  },
  {
    id: "media",
    departmentId: "dept-media",
    networkNodeId: "node-media",
    number: "03",
    tagline: "Film · Photo · Content",
    description:
      "Capturing, editing and publishing the stories behind every build and event.",
    icon: Video,
  },
  {
    id: "public-relations",
    networkNodeId: "node-outreach",
    number: "04",
    tagline: "Outreach · Partnerships · Voice",
    description:
      "Connecting the community with partners, sponsors, colleges and the wider tech scene.",
    icon: Megaphone,
  },
];

type DirectoryRecord = Pick<
  DbTeamMember,
  "name" | "pic_url" | "branch" | "year" | "role"
>;

function getWing(wing: WingPresentation) {
  const department = wing.departmentId
    ? DEPARTMENTS.find((item) => item.id === wing.departmentId)
    : undefined;
  const networkNode = NETWORK_NODES.find(
    (item) => item.id === wing.networkNodeId
  );
  const name =
    department?.name ??
    networkNode?.department ??
    "Builder Wing";
  const members = department?.members ?? [];

  return { ...wing, name, members, networkNode };
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getDirectoryRecord(
  member: TeamMember,
  directory: DirectoryRecord[]
): DirectoryRecord | undefined {
  const normalizedName = member.name.trim().toLowerCase();
  return directory.find(
    (record) => record.name.trim().toLowerCase() === normalizedName
  );
}

function MemberPhoto({
  name,
  src,
  sizes,
  className,
}: {
  name: string;
  src?: string | null;
  sizes: string;
  className: string;
}) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (hasError || !src) {
    return (
      <span
        className={`${className} flex items-center justify-center bg-[var(--surface-raised)] text-sm font-semibold text-white/55`}
        aria-label={`${name} photo unavailable`}
      >
        {getInitials(name)}
      </span>
    );
  }

  return (
    <span className={`${className} relative block overflow-hidden bg-[var(--surface-raised)]`}>
      <Image
        src={src}
        alt={name}
        fill
        sizes={sizes}
        unoptimized
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </span>
  );
}

function SocialLink({
  label,
  href,
  children,
}: {
  label: string;
  href?: string;
  children: React.ReactNode;
}) {
  const isAvailable = Boolean(href && href !== "#");
  const sharedClass =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/65 transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  if (!isAvailable) {
    return (
      <span
        className={`${sharedClass} cursor-not-allowed opacity-35`}
        aria-label={`${label} unavailable`}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target={href?.startsWith("mailto:") ? undefined : "_blank"}
      rel={href?.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      className={sharedClass}
      aria-label={label}
    >
      {children}
    </a>
  );
}

function MemberSocials({ member }: { member: TeamMember }) {
  return (
    <div className="mt-4 flex gap-2">
      <SocialLink label="GitHub" href={member.socials.github}>
        <Github className="h-4 w-4" aria-hidden="true" />
      </SocialLink>
      <SocialLink label="LinkedIn" href={member.socials.linkedin}>
        <Linkedin className="h-4 w-4" aria-hidden="true" />
      </SocialLink>
      <SocialLink
        label="Email"
        href={
          member.socials.email && member.socials.email !== "#"
            ? `mailto:${member.socials.email}`
            : member.socials.email
        }
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
      </SocialLink>
    </div>
  );
}

function WingMemberCard({
  member,
  wingName,
  directory,
}: {
  member: TeamMember;
  wingName: string;
  directory: DirectoryRecord[];
}) {
  const directoryRecord = getDirectoryRecord(member, directory);
  const shortRole =
    member.role?.trim() ||
    member.specializations.slice(0, 2).join(" · ") ||
    `Building with the ${wingName}`;

  return (
    <article className="team-wing-person group min-w-0 rounded-2xl border border-white/[0.08] bg-[var(--surface)] p-4 transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[0_14px_42px_rgba(255,153,0,0.08)]">
      <div className="flex items-start gap-3">
        <MemberPhoto
          name={member.name}
          src={directoryRecord?.pic_url || member.avatar}
          sizes="56px"
          className="h-14 w-14 shrink-0 rounded-full border border-white/10"
        />
        <div className="min-w-0 flex-1">
          <span className="inline-flex min-h-6 items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Member
          </span>
          <h4 className="mt-2 break-words text-sm font-semibold text-white">
            {member.name}
          </h4>
        </div>
      </div>
      <p className="mt-3 break-words text-[11px] leading-5 text-white/50">
        {directoryRecord?.branch || "Branch not listed"} ·{" "}
        {directoryRecord?.year || "Year not listed"}
      </p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/65">
        {shortRole}
      </p>
    </article>
  );
}

function WingRoleCard({
  member,
  badge,
  directory,
}: {
  member: TeamMember;
  badge: "Wing Lead" | "Co-Lead";
  directory: DirectoryRecord[];
}) {
  const directoryRecord = getDirectoryRecord(member, directory);
  const roleDescription =
    member.bio?.trim() ||
    member.specializations.slice(0, 2).join(" · ") ||
    `Helping guide the ${member.department} team.`;

  return (
    <article className="team-wing-person group flex min-w-0 items-start gap-4 rounded-2xl border border-white/[0.09] bg-[var(--surface)] p-4 transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[0_16px_50px_rgba(255,153,0,0.08)] sm:gap-5 sm:p-5">
      <MemberPhoto
        name={member.name}
        src={directoryRecord?.pic_url || member.avatar}
        sizes="(max-width: 639px) 64px, 80px"
        className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 sm:h-20 sm:w-20"
      />
      <div className="min-w-0 flex-1">
        <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          {badge}
        </span>
        <h4 className="mt-2 break-words font-display text-base font-bold text-white sm:text-lg">
          {member.name}
        </h4>
        <p className="mt-1 break-words text-xs text-white/50">
          {directoryRecord?.branch || "Branch not listed"} ·{" "}
          {directoryRecord?.year || "Year not listed"}
        </p>
        <p className="mt-2 text-xs leading-5 text-white/65">{roleDescription}</p>
        <MemberSocials member={member} />
      </div>
    </article>
  );
}

function WingSection({
  wing,
  directory,
  index,
}: {
  wing: ReturnType<typeof getWing>;
  directory: DirectoryRecord[];
  index: number;
}) {
  const Icon = wing.icon;
  const roleMembers = wing.members.filter((member) =>
    /\b(?:co[-\s]?lead|lead)\b/i.test(member.role)
  );
  const coLeads = roleMembers.filter((member) =>
    /\bco[-\s]?lead\b/i.test(member.role)
  );
  const leads = roleMembers.filter(
    (member) => !/\bco[-\s]?lead\b/i.test(member.role)
  );
  const leaderCards = [
    ...leads.map((member) => ({ member, badge: "Wing Lead" as const })),
    ...coLeads.map((member) => ({ member, badge: "Co-Lead" as const })),
  ];
  const members = wing.members.filter(
    (member) => !roleMembers.includes(member)
  );

  return (
    <section
      id={wing.id}
      aria-labelledby={`${wing.id}-title`}
      className="team-wing-section relative mx-auto max-w-7xl scroll-mt-28 px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/4 h-56 w-56 rounded-full bg-[var(--accent-soft)] opacity-40 blur-[100px]"
      />
      <div className="team-wing-reveal relative flex flex-col gap-6 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            {wing.number} / {String(WING_PRESENTATION.length).padStart(2, "0")}
          </p>
          <h3
            id={`${wing.id}-title`}
            className="mt-2 break-words font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            {wing.name.replace(/Wing$/i, "").trim()}{" "}
            <span className="text-[var(--accent)]">Wing.</span>
          </h3>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] sm:text-xs">
            {wing.tagline}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            {wing.description}
          </p>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] transition duration-300 hover:rotate-3 hover:scale-105 sm:h-16 sm:w-16 sm:self-center">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      </div>

      {leaderCards.length > 0 && (
        <div className="team-wing-reveal mt-7 grid min-w-0 gap-4 sm:grid-cols-2">
          {leaderCards.map(({ member, badge }) => (
            <WingRoleCard
              key={`${member.id}-${badge}`}
              member={member}
              badge={badge}
              directory={directory}
            />
          ))}
        </div>
      )}

      {members.length > 0 ? (
        <div className="mt-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {members.map((member) => (
            <div className="team-wing-reveal min-w-0" key={member.id}>
              <WingMemberCard
                member={member}
                wingName={wing.name}
                directory={directory}
              />
            </div>
          ))}
        </div>
      ) : leaderCards.length === 0 ? (
        <div className="team-wing-reveal mt-7 rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--surface)] px-5 py-8 text-center">
          <Icon className="mx-auto h-7 w-7 text-[var(--accent)]" aria-hidden="true" />
          <p className="mt-3 font-semibold text-white">Team coming soon</p>
          <p className="mt-1 text-sm text-white/55">
            We&apos;re looking forward to introducing the {wing.name} team.
          </p>
        </div>
      ) : null}
      <span className="sr-only">Wing section {index + 1}</span>
    </section>
  );
}

export function TeamWingsRedesign() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [directory, setDirectory] = useState<DirectoryRecord[]>([]);
  const wings = useMemo(() => WING_PRESENTATION.map(getWing), []);

  useEffect(() => {
    let isActive = true;

    async function loadDirectory() {
      try {
        const response = await fetch("/api/team-members", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Team member request failed with status ${response.status}`);
        }
        const result: { success?: boolean; data?: DbTeamMember[] } =
          await response.json();
        if (isActive && result.success && Array.isArray(result.data)) {
          setDirectory(result.data);
        }
      } catch (error) {
        console.error("Failed to load team member directory details:", error);
      }
    }

    void loadDirectory();
    return () => {
      isActive = false;
    };
  }, []);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".team-overview-reveal",
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: { trigger: sectionRef.current, start: "top 82%" },
          }
        );
        gsap.utils
          .toArray<HTMLElement>(".team-wing-section")
          .forEach((section) => {
            gsap.fromTo(
              section.querySelectorAll(".team-wing-reveal"),
              { y: 18, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.55,
                stagger: 0.08,
                ease: "power2.out",
                scrollTrigger: { trigger: section, start: "top 82%" },
              }
            );
          });
      });
      return () => media.revert();
    },
    { scope: sectionRef }
  );

  return (
    <div ref={sectionRef}>
      <section
        id="wings"
        aria-labelledby="team-wings-title"
        className="relative mx-auto max-w-7xl scroll-mt-28 px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
      >
        <div className="team-overview-reveal max-w-3xl">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            COHORT 2026
          </p>
          <h2
            id="team-wings-title"
            className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            See Our <span className="text-[var(--accent)]">Builder Wings.</span>
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base">
            Four wings. One community. Pick a wing to meet the team.
          </p>
        </div>

        <div className="mt-8 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          {wings.map((wing) => {
            const Icon = wing.icon;
            const avatarMembers = wing.members.slice(0, 3);
            const extraCount = Math.max(0, wing.members.length - avatarMembers.length);
            return (
              <article
                key={wing.id}
                className="team-overview-reveal group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[var(--surface)] p-5 transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[0_18px_50px_rgba(255,153,0,0.09)] sm:p-6"
              >
                <span className="absolute right-5 top-5 font-mono text-xs tracking-[0.16em] text-white/35">
                  {wing.number}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(255,153,0,0.18)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 pr-12 font-display text-xl font-bold text-white sm:text-2xl">
                  {wing.name}
                </h3>
                <p className="mt-1 text-sm text-white/55">{wing.tagline}</p>
                <div className="mt-5 flex min-h-11 items-center justify-between gap-4">
                  {avatarMembers.length > 0 ? (
                    <div className="flex items-center pl-1.5" aria-label={`${wing.members.length} listed team members`}>
                      {avatarMembers.map((member, index) => (
                        <MemberPhoto
                          key={member.id}
                          name={member.name}
                          src={member.avatar}
                          sizes="36px"
                          className="-ml-1.5 h-9 w-9 rounded-full border-2 border-[var(--surface)]"
                        />
                      ))}
                      {extraCount > 0 && (
                        <span className="-ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-raised)] text-[10px] font-semibold text-white/75">
                          +{extraCount}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-white/45">Team coming soon</span>
                  )}
                  <a
                    href={`#${wing.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    aria-label={`View ${wing.name} team`}
                  >
                    View Team <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <div className="team-overview-reveal relative mx-auto mt-9 flex min-h-[220px] w-full max-w-[280px] items-end justify-center md:min-h-[270px]">
          <div
            aria-hidden="true"
            className="absolute bottom-2 left-1/2 h-44 w-44 -translate-x-1/2 rotate-[8deg] rounded-[2.5rem] border border-[var(--accent-border)] bg-[linear-gradient(145deg,rgba(255,153,0,0.14),rgba(28,23,13,0.52))]"
          />
          <div className="absolute inset-x-[10%] bottom-0 top-[7%]">
            <TeamMascot
              variant="wings"
              alt="Kio helping visitors choose a Builder Wing"
              className="object-contain object-bottom"
            />
          </div>
          <p className="absolute right-0 top-0 rounded-2xl rounded-br-sm border border-[var(--accent-border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-white shadow-xl">
            Which wing is yours?
          </p>
        </div>
      </section>

      {wings.map((wing, index) => (
        <WingSection
          key={wing.id}
          wing={wing}
          directory={directory}
          index={index}
        />
      ))}
    </div>
  );
}
