"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Linkedin, Instagram, Mail } from "lucide-react";
import { ArrowRight } from "@/components/ui/animate-ui/icons/arrow-right";
import { Sparkles } from "@/components/ui/animate-ui/icons/sparkles";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const FOOTER_LINKS = [
  {
    heading: "Community",
    links: [
      { label: "About", href: "/about" },
      { label: "Events", href: "/events" },
      { label: "Team", href: "/team" },
      { label: "Gallery", href: "/gallery" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Learning Hub", href: "/learning-hub" },
      { label: "AWS Console", href: "https://console.aws.amazon.com/" },
      { label: "AWS Skill Builder", href: "https://skillbuilder.aws" },
      { label: "AWS Educate", href: "https://aws.amazon.com/education/awseducate/" },
    ],
  },
  {
    heading: "Connect",
    links: [
      { label: "Meetup", href: "https://www.meetup.com/tulas-university-dehradun/", hoverClass: "group-hover:text-[#F64060]", arrowColor: "group-hover:text-[#F64060]" },
      { label: "WhatsApp", href: "https://chat.whatsapp.com/Dy6s9Lo9rFpLNbrMkgUgQ6?s=cl&p=a&mlu=4&ilr=4", hoverClass: "group-hover:text-[#25D366]", arrowColor: "group-hover:text-[#25D366]" },
      { label: "LinkedIn", href: "https://www.linkedin.com/company/aws-tulas/", hoverClass: "group-hover:text-[#0A66C2]", arrowColor: "group-hover:text-[#0A66C2]" },
      { label: "Instagram", href: "https://www.instagram.com/aws.sbgtulas", hoverClass: "group-hover:text-[#E4405F]", arrowColor: "group-hover:text-[#E4405F]" },
      { label: "Email Us", href: "mailto:awssbg@tulas.edu.in", hoverClass: "group-hover:text-[#FF9900]", arrowColor: "group-hover:text-[#FF9900]" },
    ],
  },
];

const MeetupIcon = ({ size = 24, className = "", ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M21.16 11.23c-1.35-1.92-3.13-2.61-4.81-2.07-1 .31-1.74 1.07-2.18 1.96a4.29 4.29 0 0 0-4.04-1.96c-1.63.15-2.85 1.15-3.4 2.45-.19-.4-.44-.76-.78-1.07-1.12-1.07-2.6-1.11-3.6-.1-1.03 1.03-1.07 2.62.1 3.73.54.51 1.25.75 1.95.73-1.03 1.05-1 2.7.07 3.76 1.05 1.03 2.72 1.02 3.78-.05.57-.57.88-1.32.93-2.1.84.58 1.83.74 2.7.53 1.1-.28 2.05-1 2.62-1.94 1.16 1.54 3.03 1.95 4.67 1.06 1.7-.93 2.37-3.04 1.99-4.93z"/>
  </svg>
);

const WhatsAppIcon = ({ size = 24, className = "", ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.99c-.002 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c-.001 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662a11.87 11.87 0 005.705 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const SOCIALS = [
  {
    icon: MeetupIcon,
    href: "https://www.meetup.com/tulas-university-dehradun/",
    label: "Meetup",
    hoverClass: "hover:text-[#F64060] hover:bg-[#F64060]/15 hover:border-[#F64060]/40 hover:shadow-[0_0_15px_rgba(246,64,96,0.35)]",
  },
  {
    icon: WhatsAppIcon,
    href: "https://chat.whatsapp.com/Dy6s9Lo9rFpLNbrMkgUgQ6?s=cl&p=a&mlu=4&ilr=4",
    label: "WhatsApp",
    hoverClass: "hover:text-[#25D366] hover:bg-[#25D366]/15 hover:border-[#25D366]/40 hover:shadow-[0_0_15px_rgba(37,211,102,0.35)]",
  },
  {
    icon: Linkedin,
    href: "https://www.linkedin.com/company/aws-tulas/",
    label: "LinkedIn",
    hoverClass: "hover:text-[#0A66C2] hover:bg-[#0A66C2]/15 hover:border-[#0A66C2]/40 hover:shadow-[0_0_15px_rgba(10,102,194,0.35)]",
  },
  {
    icon: Instagram,
    href: "https://www.instagram.com/aws.sbgtulas",
    label: "Instagram",
    hoverClass: "hover:text-[#E4405F] hover:bg-[#E4405F]/15 hover:border-[#E4405F]/40 hover:shadow-[0_0_15px_rgba(228,64,95,0.35)]",
  },
  {
    icon: Mail,
    href: "mailto:awssbg@tulas.edu.in",
    label: "Email",
    hoverClass: "hover:text-[#FF9900] hover:bg-[#FF9900]/15 hover:border-[#FF9900]/40 hover:shadow-[0_0_15px_rgba(255,153,0,0.35)]",
  },
];

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!footerRef.current) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) return;

    // 1. Ambient Glow Parallax float (ends at top 50% so it doesn't trigger scroll loops at document bottom)
    gsap.fromTo(
      ".footer-glow",
      { y: -20, scale: 0.95, opacity: 0.5 },
      {
        y: 10,
        scale: 1.05,
        opacity: 0.9,
        ease: "none",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top bottom",
          end: "top 50%",
          scrub: 0.5,
        },
      }
    );

    // 2. Smooth layered entrance for footer content
    gsap.fromTo(
      [".footer-brand-col", ".footer-link-col", ".footer-bottom-bar"],
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.08,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      }
    );

    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 200);
    return () => clearTimeout(refreshTimer);
  }, { scope: footerRef });

  return (
    <footer ref={footerRef} className="relative z-10 border-t border-white/[0.05] bg-bg overflow-hidden">
      {/* Decorative gradient blur */}
      <div
        aria-hidden
        className="footer-glow pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="relative mx-auto max-w-content px-4 sm:px-6 pb-12 pt-16 md:pt-20">
        <div className="grid gap-12 lg:gap-16 lg:grid-cols-12">

          {/* Brand column */}
          <div className="footer-brand-col flex flex-col gap-6 lg:col-span-5">
            <Link
              href="/"
              className="flex items-center gap-3 font-display text-lg font-semibold tracking-tight text-text-primary transition-opacity hover:opacity-80 w-fit"
            >
              <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/[0.05] p-1.5 ring-1 ring-white/10">
                <Image src="/logos/SBG_logo.png" alt="AWS SBG Logo" fill className="object-contain p-1" />
              </div>
              AWS Student Builder Group
            </Link>
            <p className="max-w-[320px] text-[15px] leading-relaxed text-text-secondary">
              A student-led community at Tulas University, Dehradun dedicated to building,
              learning, and deploying real-world applications on AWS.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7 lg:pl-10">
            {FOOTER_LINKS.map((col) => (
              <div key={col.heading} className="footer-link-col">
                <h4 className="font-display text-[15px] font-semibold text-text-primary">{col.heading}</h4>
                <ul className="mt-5 flex flex-col gap-3.5">
                  {col.links.map((link) => {
                    const isExternal = link.href.startsWith("http") || link.href.startsWith("mailto");
                    const hoverClass = (link as any).hoverClass || "group-hover:text-primary-light";
                    const arrowColor = (link as any).arrowColor || "group-hover:text-primary-light";
                    return (
                      <li key={link.label}>
                        {isExternal ? (
                          <a href={link.href} target="_blank" rel="noopener noreferrer" className="group flex w-fit items-center gap-1.5 text-[14px] text-text-secondary transition-colors">
                            <span className={`transition-all duration-200 ${hoverClass}`}>{link.label}</span>
                            <ArrowRight size={14} className={`-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 ${arrowColor}`} animateOnHover />
                          </a>
                        ) : (
                          <Link href={link.href} className="group flex w-fit items-center gap-1.5 text-[14px] text-text-secondary transition-colors">
                            <span className={`transition-all duration-200 ${hoverClass}`}>{link.label}</span>
                            <ArrowRight size={14} className={`-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 ${arrowColor}`} animateOnHover />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom-bar mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/[0.05] pt-8 sm:flex-row">
          <div className="flex items-center gap-4">
            {SOCIALS.map((social) => {
              const Icon = social.icon;
              return (
                <a key={social.label} href={social.href} aria-label={social.label} target="_blank" rel="noopener noreferrer" className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] text-text-secondary transition-all duration-300 ${social.hoverClass}`}>
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
          <p className="text-[13px] text-muted">
            © {new Date().getFullYear()}&nbsp;&nbsp;AWS SBG, Tulas University. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
