// ============================================================
// GET /api/verify/[certificateId] — Public Certificate Verification
// ============================================================
//
// Fetches official certificate record from database (V2 schema).
// Does not trust client input.
// Strictly exposes only public-safe fields (NO internal IDs, NO email).
//
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { isValidCertificateIdFormat } from "@/lib/certificates/id-generator";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  CertificateVerificationResponse,
  ApiResponse,
} from "@/types/certificate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const { certificateId } = await params;
    const cleanId = (certificateId || "").trim().toUpperCase();

    // 1. Validate ID format
    if (!cleanId || !isValidCertificateIdFormat(cleanId)) {
      return NextResponse.json(
        {
          valid: false,
          status: "NOT_FOUND",
          certificateId: cleanId,
          error: "Invalid certificate ID format. Expected format: AWS-SBG-YYYY-XXXXXX",
          verifiedAt: new Date().toISOString(),
        } satisfies CertificateVerificationResponse,
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json(
        {
          valid: false,
          status: "NOT_FOUND",
          certificateId: cleanId,
          error: "Database configuration error. Please contact administrator.",
          verifiedAt: new Date().toISOString(),
        } satisfies CertificateVerificationResponse,
        { status: 500 }
      );
    }

    // 2. Query certificates table with participant join
    const { data: cert, error: dbError } = await supabase
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
        participant:participants (
          course,
          roll_no
        )
      `)
      .eq("certificate_id", cleanId)
      .maybeSingle();

    if (dbError) {
      console.error("[API/verify] DB query error:", dbError);
      return NextResponse.json(
        {
          valid: false,
          status: "NOT_FOUND",
          certificateId: cleanId,
          error: "Failed to query certificate records.",
          verifiedAt: new Date().toISOString(),
        } satisfies CertificateVerificationResponse,
        { status: 500 }
      );
    }

    // 3. Not found
    if (!cert) {
      return NextResponse.json(
        {
          valid: false,
          status: "NOT_FOUND",
          certificateId: cleanId,
          error: `No authentic certificate record was found for Certificate ID: ${cleanId}`,
          verifiedAt: new Date().toISOString(),
        } satisfies CertificateVerificationResponse,
        { status: 404 }
      );
    }

    // 4. Valid certificate
    const part = Array.isArray(cert.participant)
      ? cert.participant[0]
      : cert.participant;
    let course = part?.course || "N/A";
    let rollNo = part?.roll_no || "N/A";

    if (cert.award_title) {
      const { data: topPerformer, error: topPerformerError } = await supabase
        .from("top_performers")
        .select("course, roll_no")
        .eq("event_id", cert.event_id)
        .eq("participant_id", cert.participant_id)
        .maybeSingle();

      if (topPerformerError) {
        console.error("[API/verify] Top performer lookup error:", topPerformerError);
        return NextResponse.json(
          {
            valid: false,
            status: "NOT_FOUND",
            certificateId: cleanId,
            error: "Failed to query top performer details.",
            verifiedAt: new Date().toISOString(),
          } satisfies CertificateVerificationResponse,
          { status: 500 }
        );
      }

      course = topPerformer?.course || "N/A";
      rollNo = topPerformer?.roll_no || "N/A";
    }

    return NextResponse.json(
      {
        valid: true,
        status: "VALID",
        certificateId: cert.certificate_id,
        certificate: {
          certificateId: cert.certificate_id,
          recipientName: cert.recipient_name_snapshot,
          course,
          rollNo,
          eventName: cert.event_name_snapshot,
          eventDate: cert.event_date_snapshot,
          issueDate: cert.issue_date,
          issuedBy: "AWS Student Builder Group • Tulas University",
          ...(cert.award_title ? { awardTitle: cert.award_title } : {}),
        },
        verifiedAt: new Date().toISOString(),
      } satisfies CertificateVerificationResponse,
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: any) {
    console.error("[API/verify] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
