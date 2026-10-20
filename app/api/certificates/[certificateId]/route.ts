// ============================================================
// GET /api/certificates/[certificateId] — Certificate PDF Download / View
// ============================================================
//
// Fetches certificate details from the database and generates/serves
// the official PDF with proper Content-Type and Content-Disposition.
//
// Supports:
//   - ?inline=true -> Content-Disposition: inline (for browser viewing)
//   - default      -> Content-Disposition: attachment (for download)
//
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCertificatePdf } from "@/lib/certificates/pdf-generator";
import { isValidCertificateIdFormat } from "@/lib/certificates/id-generator";
import type { ApiResponse } from "@/types/certificate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const { certificateId } = await params;
    const cleanId = certificateId?.trim();

    if (!cleanId || !isValidCertificateIdFormat(cleanId)) {
      return NextResponse.json(
        { success: false, error: "Invalid certificate ID format." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database client unavailable." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    // 1. Fetch certificate record from DB
    const { data: cert, error: certError } = await supabase
      .from("certificates")
      .select("id, certificate_id, recipient_name_snapshot, event_name_snapshot, event_date_snapshot, award_title")
      .eq("certificate_id", cleanId)
      .maybeSingle();

    if (certError || !cert) {
      return NextResponse.json(
        { success: false, error: "Certificate not found." } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // 2. Generate PDF using immutable snapshot fields
    const pdfResult = await generateCertificatePdf({
      certificateId: cert.certificate_id,
      participantName: cert.recipient_name_snapshot,
      eventTitle: cert.event_name_snapshot,
      eventDate: cert.event_date_snapshot,
      awardTitle: cert.award_title || undefined,
    });

    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      console.error("[API/certificates] Failed to render PDF:", pdfResult.error);
      return NextResponse.json(
        { success: false, error: "Failed to generate certificate PDF." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    // 3. Determine inline vs attachment disposition
    const isInline = request.nextUrl.searchParams.get("inline") === "true";
    const filename = `${cert.certificate_id}.pdf`;
    const dispositionType = isInline ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(pdfResult.pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${filename}"`,
        "Content-Length": pdfResult.pdfBuffer.length.toString(),
        "Cache-Control": "no-store, max-age=0",
        "X-Certificate-Id": cert.certificate_id,
      },
    });
  } catch (error: any) {
    console.error("[API/certificates] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
