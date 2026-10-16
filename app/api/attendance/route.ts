// ============================================================
// POST /api/attendance — Student attendance submission
// ============================================================
//
// Flow:
//   1. Validate request body
//   2. Check portal_config for active event + attendance_enabled
//   3. Lookup or create participant (by email — reuse existing)
//   4. Create attendance record (unique constraint prevents duplicates)
//   5. Generate certificate (ID → PDF → DB record)
//   6. Return certificate info
//
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCertificateId } from "@/lib/certificates/id-generator";
import { generateCertificatePdf } from "@/lib/certificates/pdf-generator";
import { getVerificationUrl } from "@/lib/certificates/qr-generator";
import type {
  ApiResponse,
  AttendanceSubmitRequest,
  AttendanceSubmitResponse,
} from "@/types/certificate";
import { cleanFullName } from "@/lib/utils";

/**
 * Validates attendance submission body.
 */
function validateBody(
  body: Partial<AttendanceSubmitRequest>
): { valid: false; errors: Record<string, string> } | { valid: true } {
  const errors: Record<string, string> = {};

  if (!body.fullName?.trim()) {
    errors.fullName = "Full name is required.";
  } else if (body.fullName.trim().length < 2) {
    errors.fullName = "Name must be at least 2 characters.";
  } else if (body.fullName.trim().length > 100) {
    errors.fullName = "Name must be at most 100 characters.";
  }

  const email = body.email?.trim();
  if (!email) {
    errors.email = "Email is required.";
  } else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "A valid email is required.";
  }

  if (!body.course?.trim()) {
    errors.course = "Course is required.";
  }

  if (!body.rollNo?.trim()) {
    errors.rollNo = "Roll number is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    // ── Parse body ──────────────────────────────────────────
    let body: Partial<AttendanceSubmitRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // ── Validate ────────────────────────────────────────────
    const validation = validateBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: "Validation failed.", data: validation.errors } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const fullName = cleanFullName(body.fullName!);
    const email = body.email!.trim().toLowerCase();
    const course = body.course!.trim();
    const rollNo = body.rollNo!.trim();

    // ── Database client ─────────────────────────────────────
    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not configured." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    // ── 1. Check portal_config for active event ─────────────
    const { data: config, error: configError } = await supabase
      .from("portal_config")
      .select("active_event_id, attendance_enabled")
      .limit(1)
      .single();

    if (configError || !config?.active_event_id) {
      return NextResponse.json(
        { success: false, error: "No active event configured." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (!config.attendance_enabled) {
      return NextResponse.json(
        { success: false, error: "Attendance submissions are currently closed." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const eventId = config.active_event_id;

    // ── 2. Fetch event details ──────────────────────────────
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, event_date, event_timing, attendance_open")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Active event not found." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    if (!event.attendance_open) {
      return NextResponse.json(
        { success: false, error: "Attendance is not open for this event." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // ── 3. Lookup or create participant (by email) ──────────
    let participantId: string;

    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingParticipant) {
      // Reuse existing participant — update name/course/rollNo if changed
      participantId = existingParticipant.id;
      await supabase
        .from("participants")
        .update({ full_name: fullName, course, roll_no: rollNo })
        .eq("id", participantId);
    } else {
      // Create new participant
      const { data: newParticipant, error: createError } = await supabase
        .from("participants")
        .insert({ full_name: fullName, email, course, roll_no: rollNo })
        .select("id")
        .single();

      if (createError || !newParticipant) {
        // Handle race condition — another request may have created this participant
        if (createError?.code === "23505") {
          const { data: raceParticipant } = await supabase
            .from("participants")
            .select("id")
            .eq("email", email)
            .single();
          if (raceParticipant) {
            participantId = raceParticipant.id;
          } else {
            return NextResponse.json(
              { success: false, error: "Failed to create participant." } satisfies ApiResponse,
              { status: 500 }
            );
          }
        } else {
          console.error("[API/attendance] Participant create error:", createError);
          return NextResponse.json(
            { success: false, error: "Failed to create participant." } satisfies ApiResponse,
            { status: 500 }
          );
        }
      } else {
        participantId = newParticipant.id;
      }
    }

    // ── 4. Create attendance record ─────────────────────────
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .insert({ event_id: eventId, participant_id: participantId })
      .select("id")
      .single();

    if (attendanceError) {
      // Unique constraint violation = duplicate attendance
      if (attendanceError.code === "23505") {
        // Lookup existing certificate for this attendance
        const { data: existingCert } = await supabase
          .from("certificates")
          .select("certificate_id")
          .eq("event_id", eventId)
          .eq("participant_id", participantId)
          .maybeSingle();

        return NextResponse.json(
          {
            success: false,
            error: "You have already submitted attendance for this event.",
            data: existingCert ? { certificateId: existingCert.certificate_id } : undefined,
          } satisfies ApiResponse,
          { status: 409 }
        );
      }

      console.error("[API/attendance] Attendance insert error:", attendanceError);
      return NextResponse.json(
        { success: false, error: "Failed to record attendance." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    // ── 5. Generate certificate ─────────────────────────────
    const certificateId = await generateCertificateId(async (id) => {
      const { data } = await supabase
        .from("certificates")
        .select("id")
        .eq("certificate_id", id)
        .maybeSingle();
      return !!data;
    });

    const verificationUrl = getVerificationUrl(certificateId);

    // Generate PDF
    const pdfResult = await generateCertificatePdf({
      participantName: fullName,
      eventTitle: event.name,
      eventDate: event.event_date,
      certificateId,
    });

    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      console.error("[API/attendance] PDF generation failed:", pdfResult.error);
      // Certificate generation failed but attendance was recorded
      // Still return success for attendance, note the cert failure
      return NextResponse.json(
        {
          success: false,
          error: "Attendance recorded but certificate generation failed. Please contact an administrator.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    // ── 6. Store certificate record ─────────────────────────
    const pdfUrl = `/api/certificates/${certificateId}`;
    const pdfHash = createHash("sha256").update(pdfResult.pdfBuffer).digest("hex");

    const { error: certInsertError } = await supabase
      .from("certificates")
      .insert({
        certificate_id: certificateId,
        event_id: eventId,
        participant_id: participantId,
        attendance_id: attendance.id,
        recipient_name_snapshot: fullName,
        event_name_snapshot: event.name,
        event_date_snapshot: event.event_date,
        pdf_url: pdfUrl,
        verification_url: verificationUrl,
        pdf_hash: pdfHash,
        issue_date: new Date().toISOString().split("T")[0],
      });

    if (certInsertError) {
      console.error("[API/attendance] Certificate insert error:", certInsertError);
      return NextResponse.json(
        { success: false, error: "Failed to store certificate record." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    console.log(`[API/attendance] Certificate ${certificateId} issued to ${fullName} (${email}) for event ${event.name}`);

    // ── 7. Return successful certificate response to frontend ─
    const responseData: AttendanceSubmitResponse = {
      certificateId,
      participantName: fullName,
      eventName: event.name,
      eventDate: event.event_date,
      verificationUrl,
      pdfDownloadUrl: pdfUrl,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
        message: "Attendance recorded and certificate generated successfully.",
      } satisfies ApiResponse<AttendanceSubmitResponse>,
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API/attendance] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
