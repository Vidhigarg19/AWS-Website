"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Search, Award, CheckCircle, ArrowRight } from "lucide-react";
import { isValidCertificateIdFormat } from "@/lib/certificates/id-format";

export default function CertificateSearchPage() {
  const router = useRouter();
  const [certId, setCertId] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = certId.trim().toUpperCase();

    if (!clean) {
      setError("Please enter a Certificate ID.");
      return;
    }

    if (!isValidCertificateIdFormat(clean)) {
      setError("Expected format: AWS-SBG-YYYY-XXXXXX (e.g. AWS-SBG-2026-GKTZ4W)");
      return;
    }

    setIsSearching(true);
    router.push(`/verify/${clean}`);
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center text-[#F4F4F6] px-4 py-20 sm:py-28"
      style={{
        background: `
          radial-gradient(750px 380px at 50% 15%, rgba(108,99,255,0.18), transparent 70%),
          radial-gradient(400px 300px at 85% 25%, rgba(255,153,0,0.06), transparent 70%),
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
          #08080B
        `,
      }}
    >
      <div className="max-w-xl mx-auto w-full">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[rgba(108,99,255,0.1)] border border-[rgba(108,99,255,0.25)] text-xs text-[#A78BFA] font-medium mb-4">
            <Award className="w-3.5 h-3.5 text-[#6C63FF]" />
            <span>AWS Student Builder Group • Official Registry</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2.5">
            Verify Certificate Authenticity
          </h1>
          <p className="text-[#8B8B96] text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            Enter the unique Certificate ID printed on any official AWS Student Builder Group credential to verify its authenticity and inspect official session records.
          </p>
        </header>

        {/* Search Card with Double-Bezel */}
        <div className="p-1 rounded-[2rem] bg-white/[0.04] border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] mb-8">
          <div className="p-7 sm:p-9 rounded-[calc(2rem-4px)] bg-[#0F0F13]">
            <form onSubmit={handleSearch} noValidate>
              <div className="mb-4">
                <label
                  htmlFor="certId"
                  className="block font-mono text-[11px] uppercase tracking-wider text-[#8B8B96] mb-2 font-medium"
                >
                  Certificate ID <span className="text-[#6C63FF]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B8B96] pointer-events-none">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    id="certId"
                    type="text"
                    required
                    autoFocus
                    autoCapitalize="characters"
                    value={certId}
                    onChange={(e) => {
                      setCertId(e.target.value.toUpperCase());
                      setError("");
                    }}
                    placeholder="e.g. AWS-SBG-2026-GKTZ4W"
                    className="w-full h-12 pl-11 pr-4 rounded-xl text-sm font-mono tracking-wider bg-[#17171C] border border-[#26262D] text-white placeholder-[#52525B] focus:outline-none focus:border-[#6C63FF] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-[#71717A] font-mono mt-1.5">
                  Format: AWS-SBG-YYYY-XXXXXX
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSearching}
                className="w-full h-12 rounded-xl text-xs font-semibold bg-[#6C63FF] hover:brightness-110 text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6C63FF]/20"
              >
                {isSearching ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Verifying with Database…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Certificate</span>
                    <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Helper */}
            <div className="mt-6 pt-6 border-t border-[#26262D] grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[#8B8B96]">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#34D399] flex-shrink-0" />
                <span>Instant official verification</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#34D399] flex-shrink-0" />
                <span>Verified event attendance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center text-xs text-[#8B8B96] space-y-2">
          <p>
            <Link href="/" className="hover:text-white transition-colors">
              ← Return to AWS SBG Homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
