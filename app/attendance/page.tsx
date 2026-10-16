"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Award,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Calendar,
  Clock,
  User,
  Mail,
  GraduationCap,
  Hash,
  Download,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type {
  PortalConfigResponse,
  AttendanceSubmitResponse,
  ApiResponse,
} from "@/types/certificate";
import { formatFullName, cleanFullName } from "@/lib/utils";
import "@/app/certificate/attendance.css";

interface FormData {
  name: string;
  email: string;
  rollNo: string;
  course: string;
  customCourse: string;
}

const DEFAULT_FORM: FormData = {
  name: "",
  email: "",
  rollNo: "",
  course: "",
  customCourse: "",
};

const COURSE_OPTIONS = [
  "B.Tech",
  "BCA",
  "MCA",
  "BBA",
  "MBA",
  "Other",
];

export default function AttendancePortalPage() {
  // ── Portal Configuration State ─────────────────────────────
  const [portalConfig, setPortalConfig] = useState<PortalConfigResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");

  // ── Form State ─────────────────────────────────────────────
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<AttendanceSubmitResponse | null>(null);
  const [duplicateCertId, setDuplicateCertId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Fetch Active Event from portal_config ──────────────────
  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError("");
    try {
      const res = await fetch("/api/attendance/config", {
        cache: "no-store",
      });
      const json: ApiResponse<PortalConfigResponse> = await res.json();
      if (json.success && json.data) {
        setPortalConfig(json.data);
      } else {
        setConfigError(json.error || "Unable to load event information.");
      }
    } catch {
      setConfigError("Failed to connect to server. Please check your connection.");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ── Form Helpers ───────────────────────────────────────────
  /** Formats name to proper Title Case preserving spacing while typing. */
  const toTitleCase = (value: string): string => formatFullName(value);

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrorMsg("");
    setDuplicateCertId(null);
  };

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setErrorMsg("");
    setDuplicateCertId(null);
    setSubmittedData(null);
  };

  const validate = (): string | null => {
    const name = form.name.trim();
    if (!name) return "Full name is required.";
    if (name.length < 2) return "Full name must be at least 2 characters.";
    if (name.length > 100) return "Full name cannot exceed 100 characters.";

    const email = form.email.trim();
    if (!email) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Please enter a valid email address.";

    const rollNo = form.rollNo.trim();
    if (!rollNo) return "College ID is required.";
    if (!/^\d+$/.test(rollNo)) return "College ID must contain only numbers.";

    const selectedCourse =
      form.course === "Other" ? form.customCourse.trim() : form.course;
    if (!selectedCourse) {
      return form.course === "Other"
        ? "Please specify your course name."
        : "Please select your course.";
    }

    return null;
  };

  // ── Clipboard Copy ─────────────────────────────────────────
  const copyToClipboard = (text: string, type: "id" | "link") => {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      toast.success("Certificate ID copied to clipboard");
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Verification link copied to clipboard");
    }
  };

  // ── Submit Attendance ──────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validate();
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setDuplicateCertId(null);

    const effectiveCourse =
      form.course === "Other" ? form.customCourse.trim() : form.course;

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cleanFullName(form.name),
          email: form.email.trim().toLowerCase(),
          course: effectiveCourse,
          rollNo: form.rollNo.trim(),
        }),
      });

      const json = await response.json();

      if (response.status === 409) {
        // Duplicate attendance already recorded for this event + email
        const existingId =
          json.data?.certificateId || json.data?.certificate_id || null;
        setDuplicateCertId(existingId);
        setErrorMsg(
          json.error ||
            "You have already submitted attendance for this event. Your certificate is already available."
        );
        return;
      }

      if (!response.ok || !json.success) {
        throw new Error(
          json.error || `Attendance submission failed (${response.status})`
        );
      }

      // Successful attendance submission & certificate generated!
      if (json.data) {
        setSubmittedData(json.data);
        toast.success("Attendance marked! Certificate generated successfully.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 1. LOADING STATE ───────────────────────────────────────
  if (configLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-[#F4F4F6]"
        style={{
          background: `
            radial-gradient(650px 320px at 50% 10%, rgba(108,99,255,0.18), transparent 70%),
            #08080B
          `,
        }}
      >
        <div className="text-center p-8">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-[#6C63FF]/30 border-t-[#6C63FF] animate-spin" />
          <p className="text-sm font-medium text-[#F4F4F6] mb-1">
            Loading Attendance Portal
          </p>
          <p className="text-xs text-[#8B8B96] font-mono">
            Connecting to active session…
          </p>
        </div>
      </div>
    );
  }

  // ── 2. CLOSED / NO EVENT STATE ─────────────────────────────
  if (configError || !portalConfig?.event || !portalConfig.attendanceEnabled) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-[#F4F4F6] px-4 pt-32 sm:pt-36 pb-24"
        style={{
          background: `
            radial-gradient(650px 320px at 50% 10%, rgba(108,99,255,0.15), transparent 70%),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px) 0 0/48px 48px,
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px) 0 0/48px 48px,
            #08080B
          `,
        }}
      >
        <div className="att-page-wrap text-center max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[rgba(108,99,255,0.1)] border border-[rgba(108,99,255,0.25)] text-xs text-[#A78BFA] font-medium mb-6">
            <Award className="w-3.5 h-3.5 text-[#6C63FF]" />
            <span>AWS Student Builder Group • Tulas University</span>
          </div>

          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-[#17171C] border border-[#26262D] text-[#8B8B96]">
            <Clock className="w-8 h-8 text-[#8B8B96]" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
            Attendance Portal Closed
          </h1>

          <p className="text-[#8B8B96] text-sm leading-relaxed mb-8">
            {configError
              ? configError
              : !portalConfig?.event
              ? "No session is currently configured for attendance collection. Please check back when your session convenor opens the portal."
              : `Attendance submissions for "${portalConfig.event.name}" are currently closed. If you attended this session, reach out to your session organizer.`}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={fetchConfig}
              className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold bg-[#17171C] hover:bg-[#1f1f26] text-[#F4F4F6] border border-[#26262D] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Check Again
            </button>

            <Link
              href="/verify"
              className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold bg-[#6C63FF] hover:brightness-110 text-white flex items-center justify-center gap-2 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              Verify a Certificate
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-[#26262D]/60 text-xs text-[#8B8B96]">
            <Link href="/" className="hover:text-white transition-colors">
              ← Return to AWS SBG Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const event = portalConfig.event;

  // Format event date
  const formattedDate = (() => {
    if (!event.eventDate || !event.eventDate.trim() || event.eventDate.toLowerCase() === "tba") {
      return "To be announced";
    }
    try {
      const d = new Date(event.eventDate + "T00:00:00");
      if (isNaN(d.getTime())) return "To be announced";
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return event.eventDate;
    }
  })();

  // ── 3. SUCCESS / CONFIRMATION STATE (PHASE 6) ──────────────
  if (submittedData) {
    return (
      <div
        className="min-h-screen flex justify-center text-[#F4F4F6] px-4 pt-32 sm:pt-36 pb-24"
        style={{
          background: `
            radial-gradient(750px 380px at 50% 12%, rgba(108,99,255,0.18), transparent 70%),
            radial-gradient(400px 300px at 85% 25%, rgba(52,211,153,0.06), transparent 70%),
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
            #08080B
          `,
        }}
      >
        <div className="att-page-wrap max-w-xl w-full">
          {/* Header */}
          <header className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.3)] text-xs text-[#34D399] font-medium mb-4 shadow-sm">
              <Check className="w-3.5 h-3.5 text-[#34D399]" />
              <span>Attendance Verified &amp; Confirmed</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2.5">
              Attendance Confirmed
            </h1>
            <p className="text-xs sm:text-sm text-[#8B8B96] max-w-md mx-auto leading-relaxed">
              Thank you, <strong className="text-white">{submittedData.participantName}</strong>! Your participation in{" "}
              <strong className="text-white">{submittedData.eventName}</strong> has been recorded and your official certificate has been generated.
            </p>
          </header>

          {/* Success Card with Double-Bezel */}
          <div className="p-1 sm:p-1.5 rounded-[2.25rem] bg-white/[0.04] border border-white/10 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.8)]">
            <div className="p-7 sm:p-9 rounded-[calc(2.25rem-6px)] bg-[#0C0C11] border border-white/[0.04] text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.35)] text-[#34D399] shadow-lg shadow-emerald-500/10">
                <Award className="w-8 h-8" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Official Credential Issued
              </h2>
              <p className="text-[#8B8B96] text-xs sm:text-sm leading-relaxed mb-6 max-w-md mx-auto">
                Your credential has been permanently signed and registered with AWS Student Builder Group at Tulas University.
              </p>

              {/* Certificate ID Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#14141A] border border-white/[0.08] max-w-md mx-auto mb-6 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#8B8B96] font-mono">
                    Official Certificate ID
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Verified
                  </span>
                </div>
                <div className="font-mono text-lg sm:text-xl font-bold text-[#A78BFA] tracking-wide break-all">
                  {submittedData.certificateId}
                </div>
              </div>

              {/* Action Buttons: Download Certificate & Verify Online */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                {/* Download Certificate */}
                <a
                  href={submittedData.pdfDownloadUrl || `/api/certificates/${submittedData.certificateId}`}
                  download={`${submittedData.certificateId}.pdf`}
                  className="h-12 px-5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:brightness-110 text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6C63FF]/25 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Certificate</span>
                </a>

                {/* Verify Online */}
                <Link
                  href={`/verify/${submittedData.certificateId}`}
                  target="_blank"
                  className="h-12 px-5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.1] hover:border-white/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <ExternalLink className="w-4 h-4 text-[#A78BFA]" />
                  <span>Verify Online</span>
                </Link>
              </div>

              {/* Secondary Utility Actions (Copy ID & Copy Link) */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4 pt-4 border-t border-white/[0.06] max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => copyToClipboard(submittedData.certificateId, "id")}
                  className="h-8 px-3 rounded-lg text-xs font-medium bg-white/[0.03] hover:bg-white/[0.07] text-[#A1A1AA] hover:text-white border border-white/[0.06] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? "ID Copied" : "Copy ID"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/verify/${submittedData.certificateId}`;
                    copyToClipboard(url, "link");
                  }}
                  className="h-8 px-3 rounded-lg text-xs font-medium bg-white/[0.03] hover:bg-white/[0.07] text-[#A1A1AA] hover:text-white border border-white/[0.06] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Link Copied" : "Copy Verification Link"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 4. ATTENDANCE ENTRY FORM SCREEN ─────────────────────────
  return (
    <div
      className="min-h-screen flex justify-center text-[#F4F4F6] px-4 pt-32 sm:pt-36 pb-24"
      style={{
        background: `
          radial-gradient(750px 350px at 50% 5%, rgba(108,99,255,0.18), transparent 70%),
          radial-gradient(400px 300px at 85% 20%, rgba(255,153,0,0.06), transparent 70%),
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
          #08080B
        `,
      }}
    >
      <div className="att-page-wrap max-w-xl w-full">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2.5">
            Mark Your Attendance
          </h1>
          <p className="text-[#8B8B96] text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            Fill in your details below. Your attendance will be recorded and you can receive your official certificate.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          {/* ── CARD 1: Event Details (Dynamic from DB) ───────── */}
          <div className="p-1 rounded-[1.75rem] bg-white/[0.04] border border-white/10 shadow-[0_15px_45px_-10px_rgba(0,0,0,0.6)] mb-6">
            <div className="p-5 sm:p-6 rounded-[calc(1.75rem-4px)] bg-[#0F0F13]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                    Current Active Session
                  </h2>
                </div>
              </div>

              {/* Event Name */}
              <div className="p-4 rounded-xl bg-[#17171C] border border-[#26262D] mb-3">
                <div className="text-[10px] uppercase tracking-wider text-[#8B8B96] mb-1 font-mono">
                  Event Title
                </div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {event.name}
                </div>
                {event.description && (
                  <p className="text-xs text-[#8B8B96] mt-1.5 leading-relaxed">
                    {event.description}
                  </p>
                )}
              </div>

              {/* Date & Timing Grid */}
              <div className={event.eventTiming ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "grid grid-cols-1 gap-2.5"}>
                <div className="p-3.5 rounded-xl bg-[#17171C] border border-[#26262D] flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[#8B8B96] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono">
                      Date
                    </div>
                    <div className="text-xs font-medium text-white truncate">
                      {formattedDate}
                    </div>
                  </div>
                </div>

                {event.eventTiming && (
                  <div className="p-3.5 rounded-xl bg-[#17171C] border border-[#26262D] flex items-center gap-3">
                    <Clock className="w-4 h-4 text-[#8B8B96] flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono">
                        Timing
                      </div>
                      <div className="text-xs font-medium text-white truncate">
                        {event.eventTiming}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Speaker if available */}
              {event.speakerName && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-[#17171C] border border-[#26262D] flex items-center gap-3">
                  <User className="w-4 h-4 text-[#8B8B96] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono">
                      Keynote Speaker / Lead
                    </div>
                    <div className="text-xs font-medium text-white truncate">
                      {event.speakerName}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── CARD 2: Student Details ───────────────────────── */}
          <div className="p-1 rounded-[1.75rem] bg-white/[0.04] border border-white/10 shadow-[0_15px_45px_-10px_rgba(0,0,0,0.6)] mb-6">
            <div className="p-5 sm:p-6 rounded-[calc(1.75rem-4px)] bg-[#0F0F13]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399]">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                    Participant Details
                  </h2>
                  <p className="text-[11px] text-[#8B8B96]">
                    Your official identity on the certificate
                  </p>
                </div>
              </div>

              {/* Field 1: Full Name */}
              <div className="mb-5">
                <label className="att-lbl" htmlFor="name">
                  Full Name <span className="req">*</span>
                </label>
                <div className="att-input-wrap">
                  <User className="w-4 h-4" />
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    autoCapitalize="words"
                    value={form.name}
                    onChange={(e) => updateField("name", toTitleCase(e.target.value))}
                    placeholder="e.g. Piyush Rawat"
                    className="att-input"
                  />
                </div>
                {/* Mandatory helper text from Requirment.md line 473 */}
                <p className="text-[11.5px] text-[#A78BFA] mt-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 flex-shrink-0" />
                  Enter your name exactly as you want it to appear on your certificate.
                </p>
              </div>

              {/* Field 2: Email */}
              <div className="mb-5">
                <label className="att-lbl" htmlFor="email">
                  Email <span className="req">*</span>
                </label>
                <div className="att-input-wrap">
                  <Mail className="w-4 h-4" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="e.g. piyush@tulas.edu.in"
                    className="att-input"
                  />
                </div>
              </div>

              {/* Field 3: College ID */}
              <div className="mb-1">
                <label className="att-lbl" htmlFor="rollNo">
                  College ID <span className="req">*</span>
                </label>
                <div className="att-input-wrap">
                  <Hash className="w-4 h-4" />
                  <input
                    id="rollNo"
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.rollNo}
                    onChange={(e) => updateField("rollNo", e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 202609018"
                    className="att-input font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── CARD 3: Academic Program / Course ─────────────── */}
          <div className="p-1 rounded-[1.75rem] bg-white/[0.04] border border-white/10 shadow-[0_15px_45px_-10px_rgba(0,0,0,0.6)] mb-6">
            <div className="p-5 sm:p-6 rounded-[calc(1.75rem-4px)] bg-[#0F0F13]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[#22D3EE]">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                    Course
                  </h2>
                </div>
              </div>

              {/* Course Selection Pills */}
              <div className="att-pills mb-3" role="radiogroup" aria-label="Course">
                {COURSE_OPTIONS.map((c) => (
                  <label key={c} className="att-pill">
                    <input
                      type="radio"
                      name="course"
                      value={c}
                      checked={form.course === c}
                      onChange={() => updateField("course", c)}
                      required
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>

              {/* Custom Course Input if 'Other' */}
              {form.course === "Other" && (
                <div className="mt-3 pt-3 border-t border-[#26262D]">
                  <label className="att-lbl" htmlFor="customCourse">
                    Specify Your Course <span className="req">*</span>
                  </label>
                  <input
                    id="customCourse"
                    type="text"
                    required
                    value={form.customCourse}
                    onChange={(e) => updateField("customCourse", e.target.value)}
                    placeholder="e.g. Diploma in Mechanical Engineering"
                    className="att-input-no-icon"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Error Banner ─────────────────────────────────── */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#F87171] flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-[#F87171]">
                  <p className="font-semibold mb-1">{errorMsg}</p>
                  {duplicateCertId && (
                    <div className="mt-2.5 pt-2 border-t border-[#EF4444]/20 flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-white">
                        ID: {duplicateCertId}
                      </span>
                      <Link
                        href={`/verify/${duplicateCertId}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white underline hover:no-underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View your existing certificate →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Submit Button ────────────────────────────────── */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="att-submit-btn cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Validating &amp; Generating Certificate…</span>
              </>
            ) : (
              <span>Submit Attendance &amp; Get Certificate</span>
            )}
          </button>
        </form>

        {/* Verification Link in Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 text-xs text-[#8B8B96] hover:text-[#F4F4F6] transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
            Already have a certificate? Verify authenticity here →
          </Link>
        </div>
      </div>
    </div>
  );
}
