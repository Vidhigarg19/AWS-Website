"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, HelpCircle, Mail } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const FAQS = [
  {
    q: "Who can apply to a Builder Wing?",
    a: "Any student at Tulas University — any branch, any year (1st to 4th). We value curiosity and enthusiasm over prior experience. If you're excited about AWS and cloud, you belong here.",
  },
  {
    q: "Do I need AWS knowledge or certifications?",
    a: "No prior certification is required. We provide AWS lab credits, learning resources, and peer mentorship once you join. We build you up from scratch.",
  },
  {
    q: "Can I apply for multiple wings?",
    a: "Yes — list up to 2 wings in your application. We'll evaluate your best fit and discuss it during the orientation session.",
  },
  {
    q: "How much time does it require per week?",
    a: "Roughly 3–5 hours per week, mostly on weekends or around event sprints. We respect your academics — this is built to be flexible and manageable.",
  },
  {
    q: "What do I get as a Core Team Member?",
    a: "An official AWS SBG member badge, community merchandise, AWS lab credits, a leadership certificate, mentorship from AWS experts, and priority access to regional cloud conferences.",
  },
  {
    q: "When will the Core Team be revealed?",
    a: "The official 2026 Core Team Reveal will happen once selections are complete. Submit your application early to secure your wing.",
  },
];

export function TeamFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const faqListRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // 1. Header reveal
    if (headerRef.current) {
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
    <section ref={sectionRef} className="py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 max-w-content mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 lg:gap-20 items-start">

        {/* Left sticky header (Desktop) / Top header (Mobile) */}
        <div ref={headerRef} className="lg:sticky lg:top-28">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase tracking-[0.2em] text-primary-light font-mono mb-3">
            <HelpCircle className="w-3 h-3 text-primary-light" />
            <span>Got Questions?</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold font-display text-text-primary tracking-tight leading-tight mb-3">
            Frequently <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
              Asked Questions.
            </span>
          </h2>
          
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Everything you need to know about joining the AWS Student Builder Group.
          </p>

          {/* Desktop Contact Card */}
          <div className="hidden lg:block mt-8 p-5 rounded-2xl bg-bg-card border border-border">
            <p className="text-xs text-muted font-mono mb-1.5">Have a different question?</p>
            <a
              href="mailto:awssbg@tulas.edu.in"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-light hover:text-accent transition-colors"
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
                    ? "border-primary/40 bg-gradient-to-br from-primary/10 via-bg-card to-bg-card shadow-lg"
                    : "border-border bg-bg-card/80 hover:border-border/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left focus:outline-none select-none active:bg-white/[0.02]"
                >
                  <span className={`text-xs sm:text-sm font-semibold font-display transition-colors leading-snug ${isOpen ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}>
                    {faq.q}
                  </span>
                  <div className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-300 ${isOpen ? "border-primary/40 bg-primary/15 text-primary-light" : "border-border text-muted"}`}>
                    {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-text-secondary leading-relaxed border-t border-primary/15 pt-3">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Mobile Contact Card */}
          <div className="gsap-faq-item lg:hidden mt-6 p-4 rounded-2xl bg-bg-card border border-border text-center">
            <p className="text-xs text-muted font-mono mb-1">Have a different question?</p>
            <a
              href="mailto:awssbg@tulas.edu.in"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary-light hover:text-accent transition-colors"
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
