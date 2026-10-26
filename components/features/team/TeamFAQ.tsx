"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, HelpCircle, Mail } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const FAQS = [
  {
    q: "What are Builder Wings?",
    a: "Builder Wings are specialised student teams (Technology, Events & Ops, Media and Public Relations), each focused on a part of what the community builds and runs.",
  },
  {
    q: "Who leads the community?",
    a: "The community is guided by a Faculty Coordinator and the Builder Group Leader, supported by the Core Committee and the Wing Leads.",
  },
  {
    q: "How do the wings work together?",
    a: "Wings collaborate on workshops, hackathons and events: Technology builds, Events & Ops runs, Media tells the story and Public Relations connects with partners and colleges.",
  },
  {
    q: "How do I find out about upcoming events?",
    a: "Check the Events page and follow us on LinkedIn and Instagram, or join our WhatsApp community.",
  },
  {
    q: "Where can I see past batches?",
    a: "Use the batch selector in the team section to browse earlier batches.",
  },
  {
    q: "How can I contact the team?",
    a: "Write to awssbg@tulas.edu.in.",
  },
];

export function TeamFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const faqListRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // 1. Header reveal
    if (headerRef.current?.children.length) {
      gsap.fromTo(
        headerRef.current.children,
        { y: 25, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 88%",
            once: true,
          },
        }
      );
    }

    // 2. FAQ list stagger
    if (faqListRef.current) {
      const items = faqListRef.current.querySelectorAll(".gsap-faq-item");
      if (items.length) {
        gsap.fromTo(
          items,
          { y: 25, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            stagger: 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: faqListRef.current,
              start: "top 85%",
              once: true,
            },
          }
        );
      }
    }

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 200);
    return () => clearTimeout(timer);
  }, { scope: sectionRef });

  // Recalculate trigger bounds when accordion items open or close
  React.useEffect(() => {
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 320);
    return () => clearTimeout(timer);
  }, [openIdx]);

  return (
    <section ref={sectionRef} aria-labelledby="team-faq-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 lg:gap-20 items-start">

        {/* Left sticky header (Desktop) / Top header (Mobile) */}
        <div ref={headerRef} className="lg:sticky lg:top-28">
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
            <HelpCircle className="w-3 h-3 text-[var(--accent)]" />
            <span>Got Questions?</span>
          </div>

          <h2 id="team-faq-title" className="text-3xl sm:text-4xl font-bold font-display text-white tracking-tight leading-tight mb-3">
            Frequently <br className="hidden sm:inline" />
            <span className="text-[var(--accent)]">
              Asked Questions.
            </span>
          </h2>
          
          <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
            Learn how our community and Builder Wings work together.
          </p>

          {/* Desktop Contact Card */}
          <div className="hidden lg:block mt-8 p-5 rounded-2xl bg-[var(--surface)] border border-white/10">
            <p className="text-xs text-white/50 font-mono mb-1.5">Have a different question?</p>
            <a
              href="mailto:awssbg@tulas.edu.in"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <Mail className="w-4 h-4" />
              <span>awssbg@tulas.edu.in →</span>
            </a>
          </div>
        </div>

        {/* Right — FAQ accordion with GSAP Stagger */}
        <div ref={faqListRef} className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`gsap-faq-item rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isOpen
                    ? "border-[var(--accent-border)] bg-[var(--accent-soft)] shadow-lg shadow-black/20"
                    : "border-white/[0.09] bg-[var(--surface)] hover:border-white/20"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`team-faq-panel-${idx}`}
                  className="flex min-h-14 w-full items-center justify-between gap-3 p-4 sm:p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--accent)] select-none active:bg-white/[0.02]"
                >
                  <span className={`text-xs sm:text-sm font-semibold font-display transition-colors leading-snug ${isOpen ? "text-white" : "text-white/70 hover:text-white"}`}>
                    {faq.q}
                  </span>
                  <div aria-hidden="true" className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 ${isOpen ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-white/10 text-white/50"}`}>
                    {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </button>

                <motion.div
                  id={`team-faq-panel-${idx}`}
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden={!isOpen}
                  style={{ overflow: "hidden" }}
                >
                  <p className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-white/60 leading-relaxed border-t border-[var(--accent-border)] pt-3">
                    {faq.a}
                  </p>
                </motion.div>
              </div>
            );
          })}

          {/* Mobile Contact Card */}
          <div className="gsap-faq-item lg:hidden mt-6 p-4 rounded-2xl bg-[var(--surface)] border border-white/10 text-center">
            <p className="text-xs text-white/50 font-mono mb-1">Have a different question?</p>
            <a
              href="mailto:awssbg@tulas.edu.in"
              className="inline-flex min-h-11 items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--accent)] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>awssbg@tulas.edu.in →</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
