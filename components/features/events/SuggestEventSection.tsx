"use client";

import React, { useState } from "react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { SparklesText } from "@/components/ui/sparkles-text";
import { submitEventSuggestion } from "@/actions/suggest-event";
import { Send } from "@/components/ui/animate-ui/icons/send";
import { LoaderCircle } from "@/components/ui/animate-ui/icons/loader-circle";
import { Lightbulb } from "@/components/ui/animate-ui/icons/lightbulb";
import { Check } from "@/components/ui/animate-ui/icons/check";
import { Globe, Users } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "workshop", label: "Hands-on Workshop" },
  { id: "hackathon", label: "Hackathon / Build Day" },
  { id: "study-jam", label: "AWS Study Jam / Certification" },
  { id: "guest-talk", label: "Guest Tech Talk" },
  { id: "community", label: "Community Networking / Social" },
];

export function SuggestEventSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    title: "",
    category: "workshop",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await submitEventSuggestion(formData);

      if (res.success) {
        setSubmitted(true);
        toast.success("Event suggestion submitted!", {
          description: "Our core team will review your idea soon.",
        });
        setFormData({
          name: "",
          email: "",
          title: "",
          category: "workshop",
          description: "",
        });
      } else {
        toast.error("Submission failed", {
          description: res.error,
        });
      }
    } catch {
      toast.error("An error occurred", {
        description: "Please check your network connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="suggest-event-container mt-16 sm:mt-20 w-full max-w-2xl mx-auto">
      <SpotlightCard
        className="border-primary/20 bg-bg-card/70 backdrop-blur-xl shadow-2xl"
        spotlightColor="rgba(167, 139, 250, 0.02)"
        borderColor="rgba(192, 132, 252, 0.05)"
      >
        <div className="p-5 sm:p-8 lg:p-10">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary-light ring-1 ring-inset ring-primary/20">
                <Lightbulb size={13} className="text-primary-light" animateOnHover />
                <span>Community Driven</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-300 ring-1 ring-inset ring-cyan-500/20">
                <Globe size={13} className="text-cyan-400" />
                <span>Open to Everyone</span>
              </div>
            </div>

            <h3 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-tight text-text-primary">
              Have an event idea?{" "}
              <SparklesText
                text="Suggest it to the team."
                sparkleCount={5}
                colors={{ first: "#C084FC", second: "#38BDF8" }}
                className="text-primary-light font-semibold"
              />
            </h3>

            {/* Prompt for Outsiders & Everyone */}
            <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm text-text-secondary">
              <Users size={18} className="shrink-0 text-primary-light mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-text-primary font-medium">Open to Everyone:</strong> You don&apos;t have to be a Tulas student! External students, developers, industry professionals, and tech enthusiasts from anywhere can suggest or request an event.
              </p>
            </div>
          </div>

          {/* Form / Success State */}
          {submitted ? (
            <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-6 text-center flex flex-col items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success mb-3">
                <Check size={24} />
              </div>
              <h4 className="text-lg font-semibold text-white">Suggestion Received!</h4>
              <p className="mt-1 text-sm text-text-secondary max-w-md">
                Thanks for helping shape the AWS Student Builder Group roadmap. We review suggestions weekly.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-5 text-xs font-semibold text-primary-light hover:underline cursor-pointer"
              >
                Submit another suggestion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="suggest-name" className="text-[11px] font-semibold uppercase tracking-wider text-purple-300/90">
                  Your Name <span className="text-primary-light font-bold">*</span>
                </label>
                <input
                  id="suggest-name"
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-zinc-500 placeholder:font-normal focus:border-primary-light focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary-light transition-all"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="suggest-email" className="text-[11px] font-semibold uppercase tracking-wider text-purple-300/90">
                  Your Email <span className="text-primary-light font-bold">*</span>
                </label>
                <input
                  id="suggest-email"
                  type="email"
                  required
                  placeholder="alex@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-zinc-500 placeholder:font-normal focus:border-primary-light focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary-light transition-all"
                />
              </div>

              {/* Event Title / Topic */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label htmlFor="suggest-title" className="text-[11px] font-semibold uppercase tracking-wider text-purple-300/90">
                  Event Topic / Title <span className="text-primary-light font-bold">*</span>
                </label>
                <input
                  id="suggest-title"
                  type="text"
                  required
                  placeholder="e.g. Serverless Microservices with AWS Lambda & DynamoDB"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-zinc-500 placeholder:font-normal focus:border-primary-light focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary-light transition-all"
                />
              </div>

              {/* Category */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label htmlFor="suggest-category" className="text-[11px] font-semibold uppercase tracking-wider text-purple-300/90">
                  Event Type
                </label>
                <div className="relative w-full">
                  <select
                    id="suggest-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full appearance-none rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 pr-10 text-sm font-medium text-white focus:border-primary-light focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary-light hover:border-white/30 transition-all cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-zinc-900 text-white py-2">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-primary-light">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label htmlFor="suggest-description" className="text-[11px] font-semibold uppercase tracking-wider text-purple-300/90">
                  Why should we host this? / Details <span className="text-primary-light font-bold">*</span>
                </label>
                <textarea
                  id="suggest-description"
                  required
                  rows={3}
                  placeholder="Briefly describe what attendees will learn, target prerequisites, or speaker suggestions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-zinc-500 placeholder:font-normal focus:border-primary-light focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary-light transition-all resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="sm:col-span-2 mt-2 flex justify-start">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all duration-300 hover:bg-primary-hover hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Suggestion</span>
                      <Send size={15} animateOnHover />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </SpotlightCard>
    </section>
  );
}

