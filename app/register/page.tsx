"use client";

import React, { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { MultiStepLoader as Loader } from "@/components/ui/multi-step-loader";
import { useRecruitment } from "@/hooks/useRecruitment";
import { ClosedRegistrations } from "@/components/recruitment/ClosedRegistrations";
import CursorGrid from "@/components/ui/cursor-grid";
import { ThemeStyles } from "@/components/features/register/ThemeStyles";
import { SuccessScreen } from "@/components/features/register/SuccessScreen";
import { FileUploadCard, UploadedFile } from "@/components/ui/file-upload-card";
import {
  ArrowRight,
  User,
  Mail,
  Phone,
  Hash,
  GraduationCap,
  CheckCircle2,
  Layers,
  ShieldCheck,
  FileText,
  X,
  UploadCloud,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";

// WebGL background (ogl) is decorative: load it after hydration instead of in the first-load bundle.
const LightRays = dynamic(() => import("@/components/ui/light-rays"), { ssr: false });

/* ─── Config ─────────────────────────────────────────────── */
const LOADING_STATES = [
  { text: "Validating your builder details..." },
  { text: "Deploying profile to AWS SBG database..." },
  { text: "Application deployed successfully!" },
];

const WINGS = [
  {
    id: "technology",
    label: "Technology",
    emoji: "💻",
    tag: "Dev & Code",
    desc: "Full-Stack, DevOps & AI Systems",
    activeClass: "border-purple-500/60 bg-purple-500/15 text-purple-100 shadow-[0_0_20px_-4px_rgba(168,85,247,0.4)]",
  },
  {
    id: "cloud",
    label: "Cloud",
    emoji: "☁️",
    tag: "Architecture",
    desc: "AWS Architecture & Cloud Labs",
    activeClass: "border-cyan-500/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_-4px_rgba(6,182,212,0.4)]",
  },
  {
    id: "design",
    label: "Design",
    emoji: "🎨",
    tag: "Creative",
    desc: "UI/UX, 3D & Brand Visuals",
    activeClass: "border-rose-500/60 bg-rose-500/15 text-rose-100 shadow-[0_0_20px_-4px_rgba(244,63,94,0.4)]",
  },
  {
    id: "events",
    label: "Events & Ops",
    emoji: "📅",
    tag: "Operations",
    desc: "Hackathons, Meetups & Logistics",
    activeClass: "border-amber-500/60 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_-4px_rgba(245,158,11,0.4)]",
  },
  {
    id: "media",
    label: "Media",
    emoji: "🎬",
    tag: "Production",
    desc: "Video, Photography & Reels",
    activeClass: "border-red-500/60 bg-red-500/15 text-red-100 shadow-[0_0_20px_-4px_rgba(239,68,68,0.4)]",
  },
  {
    id: "outreach",
    label: "Outreach",
    emoji: "📣",
    tag: "PR & Growth",
    desc: "PR, Sponsorships & Community",
    activeClass: "border-emerald-500/60 bg-emerald-500/15 text-emerald-100 shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]",
  },
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const COURSES = ["B.Tech", "BCA", "MCA", "B.Sc", "BBA", "MBA", "Other"];
const BRANCHES = ["CSE", "AI/ML", "Data Science", "Cyber Security", "ECE", "ME", "Other"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+91 \d{10}$/;

interface Form {
  fullName: string;
  universityEmail: string;
  phoneNumber: string;
  rollNumber: string;
  year: string;
  course: string;
  branch: string;
  customCourse: string;
  wings: string[]; // up to 2
}

const INIT: Form = {
  fullName: "",
  universityEmail: "",
  phoneNumber: "",
  rollNumber: "",
  year: "",
  course: "",
  branch: "",
  customCourse: "",
  wings: [],
};

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const { mounted, isOpen } = useRecruitment();

  // Pre-select wing from URL param (e.g. ?wing=Design)
  const preWing = searchParams.get("wing") ?? "";
  const matchedWing = WINGS.find(w =>
    preWing.toLowerCase().includes(w.label.toLowerCase())
  );

  const [form, setForm] = useState<Form>({
    ...INIT,
    wings: matchedWing ? [matchedWing.label] : [],
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleFileSelect = (file: File | undefined | null) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrors(e => ({ ...e, resume: "Only PDF files are accepted (.pdf)" }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors(e => ({ ...e, resume: "PDF file size must be under 10MB" }));
      return;
    }
    setResumeFile(file);
    setErrors(e => {
      const n = { ...e };
      delete n.resume;
      return n;
    });
  };

  const update = (key: keyof Form, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  };

  const toggleWing = (label: string) => {
    setForm(f => {
      if (f.wings.includes(label)) {
        return { ...f, wings: f.wings.filter(w => w !== label) };
      }
      if (f.wings.length >= 2) return f; // max 2
      return { ...f, wings: [...f.wings, label] };
    });
    setErrors(e => {
      const n = { ...e };
      delete n.wings;
      return n;
    });
  };

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!EMAIL_RE.test(form.universityEmail)) e.universityEmail = "Enter a valid email";
    if (!PHONE_RE.test(form.phoneNumber)) e.phoneNumber = "Format: +91 XXXXXXXXXX";
    if (!form.rollNumber.trim()) e.rollNumber = "Roll number is required";
    if (!form.year) e.year = "Select your academic year";
    if (!form.course) e.course = "Select your course";
    if (form.course === "Other" && !form.customCourse.trim()) e.customCourse = "Specify your course";
    if (form.course === "B.Tech" && !form.branch) e.branch = "Select your branch";
    if (form.wings.length === 0) e.wings = "Select at least 1 wing";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const el = document.getElementById(`field-${firstErrorKey}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const finalCourse = form.course === "Other" ? (form.customCourse.trim() || "Other") : form.course;
      const fd = new FormData();
      fd.append("fullName", form.fullName.trim());
      fd.append("universityEmail", form.universityEmail.trim());
      fd.append("phoneNumber", form.phoneNumber.trim());
      fd.append("rollNumber", form.rollNumber.trim());
      if (resumeFile) {
        fd.append("resume", resumeFile);
        fd.append("resumeName", resumeFile.name);
      }
      fd.append("course", finalCourse);
      fd.append("branch", form.course === "B.Tech" ? (form.branch || "N/A") : (form.branch || "N/A"));
      fd.append("year", form.year);
      fd.append("wing", form.wings.join(" + "));
      fd.append("interestAreas", JSON.stringify(form.wings));

      const [res] = await Promise.all([
        fetch("/api/register", { method: "POST", body: fd }),
        new Promise(r => setTimeout(r, 3600)),
      ]);
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.error || data.message || "Submission failed. Please try again.";
        if (data.fieldErrors && typeof data.fieldErrors === "object") {
          const details = Object.entries(data.fieldErrors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(", ");
          errMsg = `${data.error || data.message || "Validation failed"}: ${details}`;
        }
        throw new Error(errMsg);
      }
      setResult(data);
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mounted && !isOpen) return <ClosedRegistrations />;
  if (result) return <SuccessScreen result={result} formData={{ ...form, resumeName: resumeFile?.name }} />;

  return (
    <div className="register-page-theme relative min-h-screen bg-bg w-full overflow-x-hidden text-text-primary font-sans">
      <Loader loadingStates={LOADING_STATES} loading={submitting} duration={1200} />
      <ThemeStyles />

      {/* Background radial atmosphere */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/12 blur-[140px] opacity-70" />
      <div className="pointer-events-none absolute -left-[15%] top-[35%] h-[450px] w-[450px] rounded-full bg-accent/10 blur-[120px] opacity-40" />
      <div className="pointer-events-none absolute -right-[15%] bottom-[15%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[130px] opacity-45" />

      {/* Dynamic Cursor Grid & Ambient Light Rays */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <CursorGrid
          cellSize={64}
          color="#A855F7"
          radius={150}
          falloff="smooth"
          holdTime={350}
          fadeDuration={700}
          lineWidth={1}
          maxOpacity={0.35}
          fillOpacity={0.06}
          gridOpacity={0.06}
          cellRadius={4}
          clickPulse={true}
          pulseSpeed={500}
        />
      </div>
      <div className="absolute inset-0 z-0 overflow-hidden opacity-25 pointer-events-none">
        <LightRays
          raysOrigin="top-center"
          raysColor="#A855F7"
          raysSpeed={0.6}
          lightSpread={0.7}
          rayLength={1.1}
          followMouse={false}
          mouseInfluence={0}
          noiseAmount={0.1}
          distortion={0.04}
          saturation={1.3}
        />
      </div>

      <main className="relative z-10 w-full max-w-[680px] mx-auto px-4 sm:px-6 md:px-8 pt-28 md:pt-36 pb-24">

        {/* ── Page Title Header ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-[11px] font-mono text-primary-light tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            COHORT 2026 · APPLICATIONS OPEN
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight leading-[1.08] mb-3">
            Join the{" "}
            <span className="bg-gradient-to-r from-primary-light via-accent to-purple-300 bg-clip-text text-transparent">
              Builder Team.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-text-secondary max-w-md mx-auto leading-relaxed">
            Fast 1-minute application · Fill your details & select your wings to claim your spot.
          </p>
        </motion.div>

        {/* ── Main Form ────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Section 1: Personal & Contact Information (First) ─────── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md p-5 sm:p-7 relative overflow-hidden space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  1. Contact & Identification
                </h2>
                <p className="text-[11px] font-mono text-muted">
                  How we can reach you for updates and orientation
                </p>
              </div>
            </div>

            {/* Full Name */}
            <div id="field-fullName" className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                  Full Name <span className="text-primary-light">*</span>
                </label>
                {form.fullName.trim() && (
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    ✓
                  </span>
                )}
              </div>
              <div className="relative">
                <User className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => update("fullName", e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] focus:border-primary/50 focus:bg-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-white/25 outline-none transition-all"
                />
              </div>
              {errors.fullName && <p className="text-[11px] font-mono text-red-400">✕ {errors.fullName}</p>}
            </div>

            {/* 2-col Contact row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* University Email */}
              <div id="field-universityEmail" className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                    Email Address <span className="text-primary-light">*</span>
                  </label>
                  {EMAIL_RE.test(form.universityEmail) && (
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={form.universityEmail}
                    onChange={e => update("universityEmail", e.target.value)}
                    placeholder="you@tulas.edu.in"
                    className="w-full bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] focus:border-primary/50 focus:bg-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-white/25 outline-none transition-all"
                  />
                </div>
                {errors.universityEmail && <p className="text-[11px] font-mono text-red-400">✕ {errors.universityEmail}</p>}
              </div>

              {/* Phone Number */}
              <div id="field-phoneNumber" className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                    Phone Number <span className="text-primary-light">*</span>
                  </label>
                  {PHONE_RE.test(form.phoneNumber) && (
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={e => {
                      let raw = e.target.value;
                      if (raw.startsWith("+91 ")) raw = raw.substring(4);
                      else if (raw.startsWith("+91")) raw = raw.substring(3);
                      const digits = raw.replace(/\D/g, "").substring(0, 10);
                      update("phoneNumber", digits.length > 0 ? "+91 " + digits : "");
                    }}
                    placeholder="+91 XXXXXXXXXX"
                    className="w-full bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] focus:border-primary/50 focus:bg-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-white/25 outline-none transition-all font-mono"
                  />
                </div>
                {errors.phoneNumber && <p className="text-[11px] font-mono text-red-400">✕ {errors.phoneNumber}</p>}
              </div>
            </div>

            {/* Roll Number */}
            <div id="field-rollNumber" className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                  Roll no. <span className="text-primary-light">*</span>
                </label>
                {form.rollNumber.trim() && (
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    ✓
                  </span>
                )}
              </div>
              <div className="relative">
                <Hash className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={form.rollNumber}
                  onChange={e => update("rollNumber", e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 2201234567"
                  className="w-full bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] focus:border-primary/50 focus:bg-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-white/25 outline-none transition-all font-mono"
                />
              </div>
              {errors.rollNumber && <p className="text-[11px] font-mono text-red-400">✕ {errors.rollNumber}</p>}
            </div>
          </motion.div>

          {/* ── Section 2: Academic Profile (Second) ───────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md p-5 sm:p-7 relative overflow-hidden space-y-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <GraduationCap className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  2. Academic Details
                </h2>
                <p className="text-[11px] font-mono text-muted">
                  Your year and course at Tulas University
                </p>
              </div>
            </div>

            {/* Year Segmented Selector */}
            <div id="field-year" className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                  Year of Study <span className="text-primary-light">*</span>
                </label>
                {errors.year && <span className="text-[11px] font-mono text-red-400">✕ {errors.year}</span>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {YEARS.map(yr => {
                  const isSelected = form.year === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => update("year", yr)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-mono font-medium transition-all text-center ${isSelected
                          ? "bg-primary/25 border-primary/60 text-primary-light shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]"
                          : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/[0.2] hover:text-white"
                        }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Course Selector */}
            <div id="field-course" className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                  Course <span className="text-primary-light">*</span>
                </label>
                {errors.course && <span className="text-[11px] font-mono text-red-400">✕ {errors.course}</span>}
              </div>

              <div className="flex flex-wrap gap-2">
                {COURSES.map(c => {
                  const isSelected = form.course === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        update("course", c);
                        if (c !== "B.Tech") update("branch", "");
                      }}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-medium transition-all ${isSelected
                          ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-200 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]"
                          : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/[0.2] hover:text-white"
                        }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              {/* Custom Course Input if 'Other' */}
              {form.course === "Other" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pt-2"
                >
                  <input
                    type="text"
                    value={form.customCourse}
                    onChange={e => update("customCourse", e.target.value)}
                    placeholder="Enter your course name (e.g. Diploma in CS, M.Sc...)"
                    className="w-full bg-white/[0.04] border border-white/[0.12] focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder:text-white/30 outline-none"
                  />
                  {errors.customCourse && (
                    <p className="text-[11px] font-mono text-red-400 mt-1">✕ {errors.customCourse}</p>
                  )}
                </motion.div>
              )}
            </div>

            {/* Branch Selector (Conditional when B.Tech) */}
            <AnimatePresence>
              {form.course === "B.Tech" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-1 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                      B.Tech Specialization / Branch <span className="text-primary-light">*</span>
                    </label>
                    {errors.branch && <span className="text-[11px] font-mono text-red-400">✕ {errors.branch}</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {BRANCHES.map(br => {
                      const isSelected = form.branch === br;
                      return (
                        <button
                          key={br}
                          type="button"
                          onClick={() => update("branch", br)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${isSelected
                              ? "bg-purple-500/20 border-purple-500/60 text-purple-200"
                              : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/[0.2] hover:text-white/80"
                            }`}
                        >
                          {br}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Section 3: Wing Selection (Last) ───────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md p-5 sm:p-7 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-primary-light" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    3. Choose Your Wing(s)
                  </h2>
                  <p className="text-[11px] font-mono text-muted">
                    Select 1 or 2 areas where you want to contribute
                  </p>
                </div>
              </div>
              <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${form.wings.length > 0 ? "border-primary/40 bg-primary/10 text-primary-light" : "border-white/10 text-white/40"}`}>
                {form.wings.length}/2 selected
              </span>
            </div>

            {errors.wings && (
              <p className="text-xs font-mono text-red-400 mb-3 flex items-center gap-1">
                ✕ {errors.wings}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WINGS.map(wing => {
                const isSelected = form.wings.includes(wing.label);
                const isMaxed = !isSelected && form.wings.length >= 2;

                return (
                  <button
                    key={wing.id}
                    type="button"
                    onClick={() => toggleWing(wing.label)}
                    disabled={isMaxed}
                    className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 group flex items-start justify-between gap-3 ${isSelected
                        ? wing.activeClass
                        : isMaxed
                          ? "bg-white/[0.01] border-white/[0.04] text-white/20 cursor-not-allowed opacity-40"
                          : "bg-white/[0.03] border-white/[0.08] text-white/70 hover:border-white/[0.2] hover:bg-white/[0.05] hover:text-white"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-lg">
                        {wing.emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-text-primary">
                            {wing.label}
                          </span>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">
                            {wing.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                          {wing.desc}
                        </p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center mt-0.5 transition-colors ${isSelected
                        ? "border-primary-light bg-primary text-white"
                        : "border-white/20 bg-white/[0.02]"
                      }`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Section 4: Resume Upload (Fourth & Final) ──────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md p-5 sm:p-7 relative overflow-hidden space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-purple-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-text-primary">
                      4. Resume
                    </h2>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/[0.06] text-white/50 border border-white/[0.10]">
                      Optional
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-muted">
                    Attach your resume document in PDF format
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/15 text-primary-light border border-primary/25 font-semibold hidden sm:inline-block">
                PDF ONLY
              </span>
            </div>

            {/* Dynamic Wing Selection Tip */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/5 to-cyan-500/10 border border-primary/20 text-xs">
              <Sparkles className="w-4 h-4 shrink-0 text-primary-light mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-semibold text-text-primary text-[12px] flex items-center gap-1.5 flex-wrap">
                  <span>Boost Your Selection Chances</span>
                  {form.wings.length > 0 && (
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-primary/20 text-primary-light border border-primary/30">
                      {form.wings.join(" & ")}
                    </span>
                  )}
                </p>
                <p className="text-white/70 text-[11px] leading-relaxed">
                  {form.wings.length === 0 && (
                    "Attaching your resume/CV is optional, but strongly recommended to increase your shortlist chances across all wings."
                  )}
                  {form.wings.length === 1 && form.wings[0] === "Technology" && (
                    "Highlighting your GitHub repos, coding projects, or tech stack gives the Tech Leads direct proof of your engineering skills!"
                  )}
                  {form.wings.length === 1 && form.wings[0] === "Cloud" && (
                    "Showcasing AWS certifications, cloud architecture labs, or DevOps experience gives you a major advantage for cloud roles!"
                  )}
                  {form.wings.length === 1 && form.wings[0] === "Design" && (
                    "Including links to your portfolio, Figma files, or UI/UX case studies directly elevates your creative assessment!"
                  )}
                  {form.wings.length === 1 && form.wings[0] === "Events & Ops" && (
                    "Highlighting past event management, college fests, or team coordination experience strengthens your operational profile!"
                  )}
                  {form.wings.length === 1 && form.wings[0] === "Media" && (
                    "Sharing past videography, photo reels, or post-production editing samples accelerates your selection!"
                  )}
                  {form.wings.length === 1 && form.wings[0] === "Outreach" && (
                    "Showcasing public speaking, community building, or PR communication skills gives you a distinct edge!"
                  )}
                  {form.wings.length > 1 && (
                    `Attaching your resume helps our wing leads review your hands-on experience and fast-tracks your shortlisting for both ${form.wings.join(" and ")} roles!`
                  )}
                </p>
              </div>
            </div>

            <div id="field-resume" className="space-y-1.5 pt-1">
              <FileUploadCard
                files={
                  resumeFile
                    ? [
                        {
                          id: "resume-file",
                          file: resumeFile,
                          progress: 100,
                          status: "completed",
                        },
                      ]
                    : []
                }
                onFilesChange={(selectedFiles) => {
                  if (selectedFiles && selectedFiles.length > 0) {
                    handleFileSelect(selectedFiles[0]);
                  }
                }}
                onFileRemove={() => {
                  setResumeFile(null);
                  setErrors((e) => {
                    const n = { ...e };
                    delete n.resume;
                    return n;
                  });
                }}
                accept="application/pdf,.pdf"
                maxSizeMB={10}
                showHeader={false}
                className="bg-transparent border-none shadow-none p-0 overflow-visible"
              />
              {errors.resume && <p className="text-[11px] font-mono text-red-400 mt-1">✕ {errors.resume}</p>}
            </div>
          </motion.div>

          {/* ── Error Banner if any ────────────────────────────────────── */}
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs font-mono text-red-400 flex items-center gap-2"
            >
              <span>✕</span>
              <span>{submitError}</span>
            </motion.div>
          )}

          {/* ── Submit Action CTA ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="pt-2 flex flex-col items-center gap-3"
          >
            <button
              type="submit"
              disabled={submitting}
              className="w-full group relative py-4 px-8 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold text-base shadow-[0_0_24px_-4px_rgba(124,58,237,0.5)] hover:shadow-[0_0_32px_-4px_rgba(124,58,237,0.75)] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-2 font-display tracking-wide">
                {submitting ? (
                  "Deploying Application..."
                ) : (
                  <>
                    <span>Submit Builder Application</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>

            <div className="flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto pt-2">
              <div className="inline-flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-muted leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Official AWS SBG Tulas Portal</span>
              </div>
              <p className="text-[10px] text-muted/70 font-mono mt-0.5">
                Shortlisted applicants notified via email
              </p>
            </div>
          </motion.div>

        </form>

      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
