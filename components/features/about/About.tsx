"use client";

import * as React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { PixelHeading } from "@/components/ui/pixel-heading-character";
import { Spotlight } from "@/components/ui/spotlight";
import dynamic from "next/dynamic";

// three.js (~130 KB gzip) is decorative here: load it after hydration instead of in the first-load bundle.
const MagicRings = dynamic(() => import("@/components/ui/magic-rings"), { ssr: false });

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function About() {
  const containerRef = React.useRef<HTMLElement>(null);

  useGSAP(() => {
    gsap.from(".about-header-element", {
      opacity: 0,
      y: 20,
      stagger: 0.12,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: {
        trigger: ".about-header-container",
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 200);
    return () => clearTimeout(refreshTimer);
  }, { scope: containerRef });

  return (
    <section ref={containerRef} id="about" className="bg-grid bg-noise relative overflow-hidden bg-bg min-h-screen">
      <Spotlight className="-top-24 left-32 md:-top-20 md:left-60" fill="#A78BFA" />
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/4 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/3 h-[350px] w-[350px] translate-x-1/4 rounded-full bg-accent/8 blur-[120px]"
      />

      <div className="relative mx-auto max-w-content px-4 sm:px-6 pt-28 pb-16 md:pt-32 md:pb-24 lg:pt-36 lg:pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          <div className="max-w-3xl flex-1 about-header-container">
            <p className="about-header-element text-[11px] uppercase tracking-[0.16em] text-muted">
              About AWS SBG
            </p>
            <h2 className="about-header-element mt-4 font-display text-[32px] sm:text-[36px] md:text-[48px] font-semibold leading-[1.1] tracking-tight text-text-primary">
              We don&apos;t just learn cloud.
              <br />
              <PixelHeading mode="uniform" className="text-gradient">We build on it.</PixelHeading>
            </h2>
            <div className="about-header-element mt-6 sm:mt-8 max-w-2xl space-y-4">
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-text-secondary">
                AWS Student Builder Group at Tulas University is a student-led community where
                aspiring developers, cloud engineers, AI enthusiasts, and builders come together to
                learn by building.
              </p>
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-text-secondary">
                Instead of only attending sessions, members create real-world applications, deploy
                production-ready projects on AWS, contribute to open-source, prepare for
                certifications, participate in hackathons, and collaborate with builders across
                the global AWS community.
              </p>
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-text-secondary">
                Supported by{" "}
                <a
                  href="https://builder.aws.com/content/3C075iQJeEx03mnzHwmXO9zdgEG/aws-student-builder-groups"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-light underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary/60"
                >
                  AWS Builder Center
                </a>
                , our mission is simple:
              </p>
            </div>
            <p className="about-header-element mt-8 font-display text-[20px] sm:text-[24px] md:text-[28px] font-semibold tracking-tight">
              <span className="text-gradient">Learn.</span>{" "}
              <span className="text-text-primary">Build.</span>{" "}
              <span className="text-gradient">Share.</span>{" "}
              <span className="text-text-primary">Grow.</span>
            </p>
          </div>

          <div className="flex-1 flex justify-center lg:justify-end w-full about-header-element">
            <div className="relative w-full max-w-[280px] sm:max-w-[400px] md:max-w-[500px] lg:max-w-[600px] aspect-square rounded-full overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 z-0 pointer-events-none rounded-full overflow-hidden">
                <MagicRings
                  color="#7C3AED"     // primary
                  colorTwo="#06B6D4"  // info
                  ringCount={5}
                  speed={0.8}
                  attenuation={10}
                  lineThickness={2}
                  baseRadius={0.12}
                  radiusStep={0.07}
                  scaleRate={0.1}
                  opacity={0.8}
                  blur={0}
                  noiseAmount={0.1}
                  rotation={0}
                  ringGap={1.5}
                  fadeIn={0.7}
                  fadeOut={0.5}
                  followMouse={false}
                  mouseInfluence={0}
                  hoverScale={1}
                  parallax={0}
                  clickBurst={false}
                />
              </div>
              <div className="relative z-10 w-[150px] h-[150px] sm:w-[200px] sm:h-[200px] md:w-[260px] md:h-[260px] rounded-full bg-white flex items-center justify-center shadow-[0_0_50px_-10px_rgba(124,58,237,0.4)] pointer-events-none overflow-hidden border-[4px] border-primary/20">
                <Image
                  src="/logos/tulas+sbg.png"
                  alt="Tulas University and AWS SBG Logo"
                  width={250}
                  height={250}
                  className="w-[85%] h-[85%] object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
