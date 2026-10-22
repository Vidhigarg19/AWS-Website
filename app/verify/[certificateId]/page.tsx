import { Metadata } from "next";
import Link from "next/link";
import { isValidCertificateIdFormat } from "@/lib/certificates/id-generator";
import { getAwardTitle } from "@/lib/certificates/award-title";
import { getAdminClient } from "@/lib/supabase/admin";
import { CertificatePreview } from "@/components/certificates/CertificatePreview";
import {
  ShieldCheck,
  Award,
  Calendar,
  Download,
  Search,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";

interface PageProps {
  params: Promise<{ certificateId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { certificateId } = await params;
  const cleanId = (certificateId || "").trim().toUpperCase();

  return {
    title: `Verify ${cleanId} — AWS Student Builder Group`,
    description: `Official verification record for certificate ${cleanId} issued by AWS Student Builder Group at Tulas University.`,
    robots: { index: false, follow: true },
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function VerifyCertificatePage({ params }: PageProps) {
  const { certificateId } = await params;
  const cleanId = (certificateId || "").trim().toUpperCase();

  const isFormatValid = isValidCertificateIdFormat(cleanId);

  let cert: any = null;

  if (isFormatValid) {
    const supabase = getAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from("certificates")
        .select(`
          certificate_id,
          recipient_name_snapshot,
          event_name_snapshot,
          event_date_snapshot,
          issue_date,
          event_id,
          participant_id,
          award_title,
          verification_url,
          pdf_url,
          participant:participants (
            course,
            roll_no
          )
        `)
        .eq("certificate_id", cleanId)
        .maybeSingle();

      if (data) {
        const part = Array.isArray(data.participant)
          ? data.participant[0]
          : data.participant;
        let course = part?.course || "Student";
        let rollNo = part?.roll_no || "N/A";

        if (data.award_title) {
          const { data: topPerformer, error: topPerformerError } = await supabase
            .from("top_performers")
            .select("course, roll_no")
            .eq("event_id", data.event_id)
            .eq("participant_id", data.participant_id)
            .maybeSingle();

          if (topPerformerError) {
            console.error("[VerifyPage] Top performer lookup failed:", topPerformerError);
          }
          course = topPerformer?.course || "N/A";
          rollNo = topPerformer?.roll_no || "N/A";
        }

        cert = {
          certificateId: data.certificate_id,
          recipientName: data.recipient_name_snapshot,
          course,
          rollNo,
          eventName: data.event_name_snapshot,
          eventDate: data.event_date_snapshot,
          awardTitle: getAwardTitle(data.award_title) || null,
          issueDate: data.issue_date,
          issuedBy: "AWS Student Builder Group • Tulas University",
          pdfUrl: data.pdf_url || `/api/certificates/${data.certificate_id}`,
          verificationUrl: data.verification_url,
        };
      }
    }
  }

  return (
    <div
      className="min-h-screen text-[#F4F4F6] selection:bg-[#6C63FF]/30 pt-32 sm:pt-36 pb-24 px-4 sm:px-6"
      style={{
        background: `
          radial-gradient(850px 420px at 50% 10%, rgba(108,99,255,0.16), transparent 70%),
          radial-gradient(500px 300px at 85% 20%, rgba(255,153,0,0.05), transparent 70%),
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px) 0 0/48px 48px,
          #08080B
        `,
      }}
    >
      <main className="max-w-4xl mx-auto w-full">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* CASE 1: VALID CERTIFICATE                                     */}
        {/* ───────────────────────────────────────────────────────────── */}
        {cert ? (
          <div className="space-y-8">
            {/* Certificate Details Breakdown */}
            <div className="p-1 rounded-[2rem] bg-white/[0.04] border border-white/10 shadow-2xl">
              <div className="p-6 sm:p-8 rounded-[calc(2rem-4px)] bg-[#0F0F13] space-y-6">
                {/* Recipient Header with Verified Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#F59E0B] font-mono font-medium">
                      Recipient
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">
                      {cert.recipientName}
                    </h1>
                  </div>
                  {cert.awardTitle && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold self-start">
                      <Award className="w-3.5 h-3.5" />
                      Certificate of Excellence - {cert.awardTitle}
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-semibold self-start sm:self-center">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>VERIFIED CREDENTIAL</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-[#26262D]">
                  {cert.awardTitle && (
                    <div className="col-span-1 sm:col-span-2 p-4 rounded-xl bg-[#17171C] border border-[#26262D] flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-[#818CF8] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono">
                          Course
                        </div>
                        <div className="text-sm font-semibold text-white truncate">
                          {cert.course}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Event Name */}
                  <div className="p-4 rounded-xl bg-[#17171C] border border-[#26262D] flex items-center gap-3">
                    <Award className="w-5 h-5 text-[#F59E0B] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono">
                        Event / Workshop
                      </div>
                      <div className="text-sm font-semibold text-white truncate">
                        {cert.eventName}
                      </div>
                    </div>
                  </div>

                  {/* Event Date */}
                  <div className="p-4 rounded-xl bg-[#17171C] border border-[#26262D] flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-[#34D399] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono">
                        Event Date
                      </div>
                      <div className="text-sm font-semibold text-white truncate">
                        {formatDate(cert.eventDate)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Registry Metadata Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#26262D] text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono block mb-1">
                      Certificate ID
                    </span>
                    <span className="font-mono font-bold text-[#6C63FF]">
                      {cert.certificateId}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono block mb-1">
                      Issue Date
                    </span>
                    <span className="text-[#D4D4D8] font-mono">
                      {formatDate(cert.issueDate)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#8B8B96] font-mono block mb-1">
                      Issued By
                    </span>
                    <span className="text-white font-medium">
                      {cert.issuedBy}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Certificate Preview Card */}
            <div className="p-1 rounded-[2rem] bg-white/[0.04] border border-white/10 shadow-2xl overflow-hidden">
              <div className="p-6 sm:p-8 rounded-[calc(2rem-4px)] bg-[#0F0F13]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                    Official Certificate Preview
                  </h2>
                  <a
                    href={`/api/certificates/${cert.certificateId}`}
                    download={`${cert.certificateId}.pdf`}
                    className="h-9 px-4 rounded-xl text-xs font-semibold whitespace-nowrap bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:brightness-110 text-white flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#6C63FF]/20 active:scale-[0.98]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Certificate</span>
                  </a>
                </div>

                <div className="rounded-xl overflow-hidden border border-[#26262D] bg-[#17171C]">
                  <CertificatePreview
                    participantName={cert.recipientName}
                    eventTitle={cert.eventName}
                    eventDate={formatDate(cert.eventDate)}
                    certificateId={cert.certificateId}
                    verificationUrl={cert.verificationUrl || undefined}
                    awardTitle={cert.awardTitle || undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ───────────────────────────────────────────────────────────── */
          /* CASE 2: NOT FOUND / INVALID CERTIFICATE                       */
          /* ───────────────────────────────────────────────────────────── */
          <div className="p-1 rounded-[2rem] bg-white/[0.04] border border-white/10 shadow-2xl">
            <div className="p-8 sm:p-12 rounded-[calc(2rem-4px)] bg-[#0F0F13] text-center max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-mono font-medium mb-3">
                NOT FOUND
              </div>

              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                Certificate Record Not Found
              </h2>

              <p className="text-sm text-[#8B8B96] leading-relaxed mb-6">
                No authentic certificate was found matching the ID:{" "}
                <span className="font-mono text-white font-semibold">{cleanId}</span>.
                Please ensure the Certificate ID was entered correctly without typos.
              </p>

              <div className="p-4 rounded-xl bg-[#17171C] border border-[#26262D] text-left text-xs space-y-2 mb-6">
                <p className="font-semibold text-white">Possible Reasons:</p>
                <ul className="list-disc list-inside text-[#8B8B96] space-y-1">
                  <li>The Certificate ID was mistyped or incomplete.</li>
                  <li>The session certificate has not yet been approved or issued.</li>
                  <li>The credential was issued by an unofficial or unauthorized source.</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/verify"
                  className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold bg-[#6C63FF] hover:brightness-110 text-white flex items-center justify-center gap-2 transition-all"
                >
                  <Search className="w-4 h-4" />
                  Search Again
                </Link>
                <Link
                  href="/attendance"
                  className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold bg-[#17171C] hover:bg-[#1f1f26] text-[#F4F4F6] border border-[#26262D] flex items-center justify-center gap-2 transition-all"
                >
                  Go to Attendance Portal
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
