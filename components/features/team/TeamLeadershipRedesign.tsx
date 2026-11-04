"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { Github, Linkedin, Mail } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { LEADERSHIP_TEAM, type LeadershipMember } from "./data";
import { TeamMascot } from "./TeamMascot";

function LeaderPhoto({ leader }: { leader: LeadershipMember }) {
  const [hasError, setHasError] = useState(false);
  const initials = leader.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="relative h-24 w-24 shrink-0 rounded-full bg-[var(--surface-raised)] p-1 ring-2 ring-[var(--accent)] sm:h-28 sm:w-28">
      <div className="relative h-full w-full overflow-hidden rounded-full bg-[#292116]">
        {hasError ? (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white/55"
            aria-label={`${leader.name} photo unavailable`}
          >
            {initials}
          </div>
        ) : (
          <Image
            src={leader.avatar}
            alt={leader.name}
            fill
            sizes="(max-width: 640px) 96px, 112px"
            className="object-cover object-center"
            onError={() => setHasError(true)}
          />
        )}
      </div>
    </div>
  );
}

function SocialButton({
  label,
  href,
  children,
}: {
  label: string;
  href?: string;
  children: ReactNode;
}) {
  const available = Boolean(href && href !== "#");
  const className =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/65 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]";

  if (!available) {
    return (
      <span className={`${className} cursor-not-allowed opacity-40`} aria-label={`${label} unavailable`} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target={href?.startsWith("mailto:") ? undefined : "_blank"}
      rel={href?.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      className={`${className} hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:-translate-y-0.5`}
      aria-label={label}
    >
      {children}
    </a>
  );
}

function LeadershipCard({ leader, index }: { leader: LeadershipMember; index: number }) {
  const isFaculty = leader.id === "faculty-coordinator";
  const emailHref =
    leader.socials.email && leader.socials.email !== "#"
      ? `mailto:${leader.socials.email}`
      : leader.socials.email;

  return (
    <article className="team-lead-card group relative flex min-w-0 items-start gap-4 overflow-hidden rounded-3xl border border-white/[0.09] bg-[var(--surface)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[0_18px_60px_rgba(255,153,0,0.09)] sm:gap-6 sm:p-7">
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--accent-soft)] opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
      />
      <LeaderPhoto leader={leader} />
      <div className="relative min-w-0 flex-1 text-left">
        <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          {isFaculty ? "Faculty Coordinator" : "Community Lead"}
        </span>
        <h3 className="mt-3 break-words font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          {leader.name}
        </h3>
        <p className="mt-1 text-sm font-medium text-[var(--accent)]/90">{leader.role}</p>
        {leader.bio && (
          <p className="mt-3 text-sm leading-6 text-white/60">{leader.bio}</p>
        )}
        <div className="mt-5 flex gap-2.5">
          <SocialButton label="GitHub" href={leader.socials.github}>
            <Github className="h-4 w-4" aria-hidden="true" />
          </SocialButton>
          <SocialButton label="LinkedIn" href={leader.socials.linkedin}>
            <Linkedin className="h-4 w-4" aria-hidden="true" />
          </SocialButton>
          <SocialButton label="Email" href={emailHref}>
            <Mail className="h-4 w-4" aria-hidden="true" />
          </SocialButton>
        </div>
      </div>
      <span className="absolute right-4 top-4 font-mono text-[10px] tracking-[0.18em] text-white/30">
        0{index + 1}
      </span>
    </article>
  );
}

export function TeamLeadershipRedesign() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const revealTargets = sectionRef.current?.querySelectorAll<HTMLElement>(".team-lead-reveal");
        if (revealTargets?.length) {
          gsap.fromTo(
            revealTargets,
            { y: 20, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.65,
              stagger: 0.12,
              ease: "power2.out",
              scrollTrigger: { trigger: sectionRef.current, start: "top 82%" },
            }
          );
        }

        const mascot = sectionRef.current?.querySelector<HTMLElement>(".team-lead-mascot");
        if (mascot) {
          gsap.to(mascot, {
            y: -7,
            duration: 3.4,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        }
      });
      return () => media.revert();
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="leadership"
      aria-labelledby="team-leadership-title"
      className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24 lg:px-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-[var(--accent-soft)] blur-[100px]"
      />
      <div className="team-lead-reveal relative mb-10 max-w-2xl sm:mb-12">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          LEADERSHIP &amp; ADVISORY
        </p>
        <h2 id="team-leadership-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Community <span className="text-[var(--accent)]">Leadership.</span>
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
          Guiding the next generation of cloud architects and software builders
        </p>
      </div>

      <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
        <div className="grid min-w-0 gap-4 sm:gap-5">
          {LEADERSHIP_TEAM.map((leader, index) => (
            <div className="team-lead-reveal" key={leader.id}>
              <LeadershipCard leader={leader} index={index} />
            </div>
          ))}
        </div>

        <div className="relative mx-auto flex min-h-[250px] w-full max-w-[280px] items-end justify-center lg:min-h-[360px]">
          <div
            aria-hidden="true"
            className="absolute bottom-5 left-1/2 h-52 w-52 -translate-x-1/2 rotate-[-9deg] rounded-[3rem] border border-[var(--accent-border)] bg-[linear-gradient(145deg,rgba(255,153,0,0.13),rgba(28,23,13,0.48))]"
          />
          <div className="team-lead-mascot absolute inset-x-[8%] bottom-0 top-[8%]">
            <TeamMascot
              alt="Kio celebrating the AWS Student Builder Group leaders"
              className="object-contain object-bottom"
              src="/team/kio-holding-trophy.png"
            />
          </div>
          <p className="absolute right-0 top-2 rounded-2xl rounded-br-sm border border-[var(--accent-border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-white shadow-xl">
            Meet our leaders!
          </p>
        </div>
      </div>
    </section>
  );
}
