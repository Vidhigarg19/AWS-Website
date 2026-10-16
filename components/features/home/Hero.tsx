"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  ArrowRight, 
  Users, 
  Cpu,
  Cloud
} from "lucide-react";
import { cn } from "@/lib/utils";
import GlassCoinCarousel from "@/components/ui/3d-glass-coin-carousel";
import { FlipText } from "@/components/ui/flip-text";

const HERO_STATS = [
  { value: "2026", label: "Launch Year", icon: Cloud, featuredMobile: true },
  { value: "6", label: "Wings", icon: Cpu },
  { value: "AWS", label: "Community", icon: Sparkles },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-[100svh] sm:min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#08080d] via-[#0f091f] to-[#08080d] text-white flex flex-col justify-between select-none pt-20 pb-8 sm:pt-32 sm:pb-16"
    >
      {/* ── 3D Glass Coin Carousel WebGL Layer ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-full h-full opacity-40 sm:opacity-55 mix-blend-screen">
          <GlassCoinCarousel
            coinsCount={9}
            radius={2.35}
            coinRadius={0.65}
            coinThickness={0.12}
            speed={0.1}
            color1="#7C3AED"
            color2="#C084FC"
            maxOpacity={0.85}
            centerText=""
            className="w-full h-full"
          />
        </div>
      </div>

      {/* ── Ambient Radial Atmosphere Flares ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[600px] sm:w-[1000px] h-[380px] sm:h-[450px] rounded-full bg-gradient-to-b from-primary/30 via-purple-600/20 to-transparent blur-[110px] sm:blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-12 right-2 sm:right-20 w-[280px] sm:w-[480px] h-[280px] sm:h-[350px] rounded-full bg-cyan-500/15 blur-[90px] sm:blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-2 sm:left-16 w-[250px] sm:w-[420px] h-[250px] sm:h-[300px] rounded-full bg-primary/15 blur-[100px] sm:blur-[120px]"
      />

      {/* ── Subtle Vignette & Grid Mask ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,transparent_20%,#08080d_95%)]" />

      {/* ── Main Hero Content Wrapper ── */}
      <div className="relative z-10 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 text-center flex-1 flex flex-col items-center justify-center my-auto">
        
        {/* ── Social Proof & Live Status Capsule ── */}
        <div className="flex items-center justify-center mb-4 sm:mb-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/25 bg-primary/10 backdrop-blur-md shadow-[0_0_15px_rgba(124,58,237,0.12)] max-w-[92vw] opacity-85"
          >
            {/* Live Indicator Pulse */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>

            {/* Avatars */}
            <div className="flex items-center -space-x-1.5 shrink-0">
              <img 
                src="https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100" 
                alt="Student Builder 1"
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-black object-cover"
              />
              <img 
                src="https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100" 
                alt="Student Builder 2"
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-black object-cover"
              />
              <img 
                src="https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=100" 
                alt="Student Builder 3"
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-black object-cover"
              />
            </div>

            <span className="text-[11px] sm:text-xs font-semibold text-white/90 truncate tracking-wide">
              Official AWS Student Community
            </span>
          </motion.div>
        </div>

        {/* ── Main Dynamic Hero Content ── */}
        <div className="w-full flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center w-full"
          >
            {/* Main Dynamic Headline */}
            <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold leading-[1.18] sm:leading-[1.16] tracking-tight mb-3 sm:mb-5 max-w-4xl px-2">
              {/* Desktop layout */}
              <span className="hidden sm:inline">
                <span className="text-white drop-shadow-md">Where Student Builders </span>
                <FlipText
                  words={[
                    "Create the Cloud Future",
                    "Build on AWS Cloud",
                    "Architect AI Systems",
                    "Innovate Together",
                  ]}
                  duration={5000}
                  className="text-transparent bg-clip-text animate-aurora"
                  style={{
                    backgroundImage: "linear-gradient(90deg, #9333EA, #C084FC, #38BDF8, #A855F7, #9333EA)",
                    backgroundSize: "200% auto",
                  }}
                />
              </span>

              {/* Mobile layout */}
              <span className="block sm:hidden">
                <span className="text-white drop-shadow-md block">Where Student Builder</span>
                <FlipText
                  words={[
                    "Build on AWS Cloud",
                    "Architect AI Systems",
                    "Innovate Together",
                  ]}
                  duration={5000}
                  className="text-transparent bg-clip-text animate-aurora"
                  style={{
                    backgroundImage: "linear-gradient(90deg, #9333EA, #C084FC, #38BDF8, #A855F7, #9333EA)",
                    backgroundSize: "200% auto",
                  }}
                />
              </span>
            </h1>

            {/* Subheading / Subtext Description */}
            <p className="text-sm sm:text-base md:text-lg text-text-secondary max-w-2xl text-center mb-6 sm:mb-8 font-sans leading-relaxed px-4">
              Join a community where students learn by building — through <span className="text-text-primary font-semibold">hands-on workshops, hackathons, mentorship, and real projects</span> that prepare you for the future.
            </p>

            {/* ── High-Impact CTA Buttons (Stacked on Mobile, Side-by-Side on Desktop) ── */}
            <div className="relative z-20 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0 max-w-xs sm:max-w-none">
              <Link
                href="/register"
                className="group relative z-30 w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-3.5 bg-gradient-to-r from-primary via-purple-600 to-purple-500 text-white font-bold text-sm md:text-base rounded-xl sm:rounded-2xl transition-all duration-300 shadow-[0_4px_14px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.45)] hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-2 overflow-hidden border border-white/20 whitespace-nowrap cursor-pointer"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <span className="relative z-10 flex items-center justify-center gap-2 w-full pointer-events-none">
                  <Sparkles className="w-4 h-4 text-purple-200 shrink-0" />
                  <span>Join Group</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300 shrink-0" />
                </span>
              </Link>

              <Link
                href="/about"
                className="group relative z-30 inline-flex items-center justify-center gap-2 px-6 sm:px-9 py-3.5 sm:py-3.5 text-white bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 font-bold text-xs sm:text-base rounded-xl sm:rounded-2xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <Users className="w-4 h-4 text-primary-light shrink-0" />
                <span>About Us</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-300 shrink-0" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ── Metric Cards Bento Layout (Mobile & Desktop) ── */}
        <div className="mt-6 sm:mt-12 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 max-w-xl w-full px-2">
          {HERO_STATS.map((stat, sIdx) => {
            const Icon = stat.icon;
            const isFeatured = stat.featuredMobile;
            return (
              <div
                key={sIdx}
                className={cn(
                  "group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.04] border border-white/10 hover:border-primary/50 hover:bg-white/[0.08] transition-all duration-300 backdrop-blur-md shadow-sm",
                  isFeatured ? "col-span-2 sm:col-span-1 py-3.5 sm:py-4" : "col-span-1"
                )}
              >
                <div className="flex items-center gap-1.5 text-base sm:text-xl md:text-2xl font-extrabold text-white mb-0.5 group-hover:text-purple-300 transition-colors">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{stat.value}</span>
                </div>
                <div className="text-xs text-white/70 font-medium text-center truncate w-full">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
