// ============================================================
// POST /api/admin/certificates/excellence — Issue an Excellence Certificate
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCertificateId } from "@/lib/certificates/id-generator";
import { generateCertificatePdf } from "@/lib/certificates/pdf-generator";
import { getVerificationUrl } from "@/lib/certificates/qr-generator";
import type { ApiResponse } from "@/types/certificate";
import { cleanFullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ALLOWED_AWARDS = [
  "1st Position",
  "2nd Position",
  "3rd Position",
] as const;

type AwardTitle = (typeof ALLOWED_AWARDS)[number];

interface IssueExcellenceCertificateBody {
  attendanceId?: unknown;
  awardTitle?: unknown;
}

function isAwardTitle(value: unknown): value is AwardTitle {
  return typeof value === "string" && ALLOWED_AWARDS.some((title) => title === value);
}

export async function POST(request: NextRequest) {
  try {
    const authClient = createClient(await cookies());
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." } satisfies ApiResponse,
        { status: 401 }
      );
    }

    let body: IssueExcellenceCertificateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (typeof body.attendanceId !== "string" || !body.attendanceId.trim()) {
      return NextResponse.json(
        { success: false, error: "Attendance ID is required." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (!isAwardTitle(body.awardTitle)) {
      return NextResponse.json(
        {
          success: false,
          error: "Award title must be 1st Position, 2nd Position, or 3rd Position.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const attendanceId = body.attendanceId.trim();
    const awardTitle = body.awardTitle;
    const supabase = getAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database client unavailable." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("id, event_id, participant_id")
      .eq("id", attendanceId)
      .maybeSingle();

    if (attendanceError) {
      console.error("[API/admin/certificates/excellence] Attendance lookup failed:", attendanceError);
      return NextResponse.json(
        { success: false, error: "Failed to verify event attendance." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    if (!attendance) {
      return NextResponse.json(
        { success: false, error: "Attendance record not found." } satisfies ApiResponse,
        { status: 404 }
      );
    }

    const [{ data: participant, error: participantError }, { data: event, error: eventError }] =
      await Promise.all([
        supabase
          .from("participants")
          .select("id, full_name")
          .eq("id", attendance.participant_id)
          .maybeSingle(),
        supabase
          .from("events")
          .select("id, name, event_date")
          .eq("id", attendance.event_id)
          .maybeSingle(),
      ]);

    if (participantError || eventError) {
      console.error("[API/admin/certificates/excellence] Registration lookup failed:", {
        participantError,
        eventError,
      });
      return NextResponse.json(
        { success: false, error: "Failed to verify event registration." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    if (!participant || !event) {
      return NextResponse.json(
        { success: false, error: "The event registration is incomplete." } satisfies ApiResponse,
        { status: 404 }
      );
    }

    const { data: existingAward, error: existingAwardError } = await supabase
      .from("certificates")
      .select("id")
      .eq("event_id", event.id)
      .eq("participant_id", participant.id)
      .not("award_title", "is", null)
      .limit(1)
      .maybeSingle();

    if (existingAwardError) {
      console.error("[API/admin/certificates/excellence] Existing award lookup failed:", existingAwardError);
      return NextResponse.json(
        { success: false, error: "Failed to verify excellence certificate eligibility." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    if (existingAward) {
      return NextResponse.json(
        {
          success: false,
          error: "An excellence certificate has already been issued for this participant and event.",
        } satisfies ApiResponse,
        { status: 409 }
      );
    }

    const certificateId = await generateCertificateId(async (id) => {
      const { data, error } = await supabase
        .from("certificates")
        .select("id")
        .eq("certificate_id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to check certificate ID uniqueness: ${error.message}`);
      }
      return !!data;
    });

    const verificationUrl = getVerificationUrl(certificateId);
    const participantName = cleanFullName(participant.full_name);
    const pdfResult = await generateCertificatePdf({
      participantName,
      eventTitle: event.name,
      eventDate: event.event_date,
      certificateId,
      awardTitle,
    });

    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      console.error("[API/admin/certificates/excellence] PDF generation failed:", pdfResult.error);
      return NextResponse.json(
        { success: false, error: "Failed to generate the excellence certificate PDF." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const pdfUrl = `/api/certificates/${certificateId}`;
    const pdfHash = createHash("sha256").update(pdfResult.pdfBuffer).digest("hex");
    const { error: insertError } = await supabase
      .from("certificates")
      .insert({
        certificate_id: certificateId,
        event_id: event.id,
        participant_id: participant.id,
        attendance_id: attendance.id,
        recipient_name_snapshot: participantName,
        event_name_snapshot: event.name,
        event_date_snapshot: event.event_date,
        pdf_url: pdfUrl,
        verification_url: verificationUrl,
        pdf_hash: pdfHash,
        issue_date: new Date().toISOString().split("T")[0],
        award_title: awardTitle,
      });

    if (insertError) {
      console.error("[API/admin/certificates/excellence] Certificate insert failed:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to store the excellence certificate record." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Excellence certificate issued successfully.",
        data: {
          certificateId,
          participantName,
          eventName: event.name,
          eventDate: event.event_date,
          awardTitle,
          verificationUrl,
          pdfDownloadUrl: pdfUrl,
        },
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[API/admin/certificates/excellence] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
