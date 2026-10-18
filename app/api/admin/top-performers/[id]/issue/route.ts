import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCertificateId } from "@/lib/certificates/id-generator";
import { generateCertificatePdf } from "@/lib/certificates/pdf-generator";
import { getVerificationUrl } from "@/lib/certificates/qr-generator";
import type { ApiResponse } from "@/types/certificate";

export const dynamic = "force-dynamic";

function ordinal(rank: number): string {
  const lastTwoDigits = rank % 100;
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 13
      ? "th"
      : rank % 10 === 1
        ? "st"
        : rank % 10 === 2
          ? "nd"
          : rank % 10 === 3
            ? "rd"
            : "th";
  return `${rank}${suffix} Position`;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { success: false, error } satisfies ApiResponse,
    { status }
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionClient = createClient(await cookies());
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) {
      return errorResponse("Please sign in to issue a certificate.", 401);
    }

    const { id } = await params;
    if (!id?.trim()) {
      return errorResponse("Top performer ID is required.", 400);
    }

    const { data: topPerformer, error: topPerformerError } = await sessionClient
      .from("top_performers")
      .select("id, event_id, participant_id, rank, full_name")
      .eq("id", id.trim())
      .maybeSingle();

    if (topPerformerError) {
      console.error("[API/admin/top-performers/issue] Top performer lookup failed:", topPerformerError);
      return errorResponse("You do not have permission to issue this certificate, or the record could not be loaded.", 403);
    }
    if (!topPerformer) {
      return errorResponse("Top performer not found.", 404);
    }

    const admin = getAdminClient();
    if (!admin) return errorResponse("Database client unavailable.", 500);

    const { data: existingCertificate, error: existingCertificateError } = await admin
      .from("certificates")
      .select("certificate_id")
      .eq("event_id", topPerformer.event_id)
      .eq("participant_id", topPerformer.participant_id)
      .not("award_title", "is", null)
      .limit(1)
      .maybeSingle();

    if (existingCertificateError) {
      console.error("[API/admin/top-performers/issue] Existing certificate lookup failed:", existingCertificateError);
      return errorResponse("Could not check whether a certificate has already been issued.", 500);
    }
    if (existingCertificate) {
      return NextResponse.json(
        {
          success: false,
          error: "A Certificate of Excellence has already been issued for this top performer.",
          data: { certificateId: existingCertificate.certificate_id },
        } satisfies ApiResponse,
        { status: 409 }
      );
    }

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, name, event_date")
      .eq("id", topPerformer.event_id)
      .maybeSingle();

    if (eventError) {
      console.error("[API/admin/top-performers/issue] Event lookup failed:", eventError);
      return errorResponse("Could not load the top performer's event details.", 500);
    }
    if (!event) return errorResponse("The event for this top performer no longer exists.", 404);
    if (
      typeof event.event_date !== "string" ||
      !event.event_date.trim() ||
      event.event_date.trim().toLowerCase() === "tba"
    ) {
      return errorResponse("Set an event date before issuing this certificate.", 400);
    }

    const { data: participant, error: participantError } = await admin
      .from("participants")
      .select("id")
      .eq("id", topPerformer.participant_id)
      .maybeSingle();

    if (participantError) {
      console.error("[API/admin/top-performers/issue] Participant lookup failed:", participantError);
      return errorResponse("Could not load the top performer's participant record.", 500);
    }
    if (!participant) return errorResponse("The participant record for this top performer no longer exists.", 404);

    const awardTitle = ordinal(topPerformer.rank);
    const certificateId = await generateCertificateId(async (candidateId) => {
      const { data, error } = await admin
        .from("certificates")
        .select("id")
        .eq("certificate_id", candidateId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to check certificate ID uniqueness: ${error.message}`);
      }
      return !!data;
    });
    const verificationUrl = getVerificationUrl(certificateId);

    const pdfResult = await generateCertificatePdf({
      certificateId,
      participantName: topPerformer.full_name,
      eventTitle: event.name,
      eventDate: event.event_date,
      awardTitle,
    });

    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      console.error("[API/admin/top-performers/issue] PDF generation failed:", pdfResult.error);
      return errorResponse(
        pdfResult.error
          ? `Certificate PDF generation failed: ${pdfResult.error}`
          : "Certificate PDF generation failed. No certificate was saved.",
        500
      );
    }

    const pdfHash = createHash("sha256").update(pdfResult.pdfBuffer).digest("hex");
    const { error: insertError } = await admin
      .from("certificates")
      .insert({
        certificate_id: certificateId,
        event_id: event.id,
        participant_id: participant.id,
        attendance_id: null,
        recipient_name_snapshot: topPerformer.full_name,
        event_name_snapshot: event.name,
        event_date_snapshot: event.event_date,
        pdf_url: `/api/certificates/${certificateId}`,
        verification_url: verificationUrl,
        pdf_hash: pdfHash,
        issue_date: new Date().toISOString().split("T")[0],
        award_title: awardTitle,
      });

    if (insertError) {
      console.error("[API/admin/top-performers/issue] Certificate insert failed:", insertError);
      if (insertError.code === "23505") {
        return errorResponse(
          "A Certificate of Excellence was issued for this top performer at the same time. Refresh the list to see it.",
          409
        );
      }
      return errorResponse("The certificate could not be saved. No certificate was issued.", 500);
    }

    return NextResponse.json({
      success: true,
      message: "Certificate of Excellence issued successfully.",
      data: {
        certificateId,
        awardTitle,
        verificationUrl,
        pdfDownloadUrl: `/api/certificates/${certificateId}`,
      },
    } satisfies ApiResponse);
  } catch (error: unknown) {
    console.error("[API/admin/top-performers/issue] Unexpected error:", error);
    return errorResponse("An unexpected error occurred while issuing the certificate.", 500);
  }
}
