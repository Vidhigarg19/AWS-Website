// ============================================================
// GET /api/admin/events/[id]/participants — Event Participants
// ============================================================
//
// Returns all participants who attended the specified event,
// joined with their participant details and issued certificate ID.
// Also returns total participant count derived from attendance records.
//
// Admin route — protected via admin Supabase client.
//
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, AdminParticipantRow } from "@/types/certificate";
import { cleanFullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "Event ID is required." } satisfies ApiResponse,
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

    // 1. Verify event exists
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, name, event_date")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) {
      return NextResponse.json(
        { success: false, error: "Event not found." } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // 2. Fetch attendance rows joined with participants & certificates
    const { data: attendanceRows, error: attError, count } = await supabase
      .from("attendance")
      .select(
        `
        id,
        submitted_at,
        participant:participants!inner (
          id,
          full_name,
          email,
          course,
          roll_no
        ),
        certificate:certificates (
          certificate_id
        )
      `,
        { count: "exact" }
      )
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false });

    if (attError) {
      console.error("[API/admin/events/participants] Fetch error:", attError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch event participants." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    // 3. Format into AdminParticipantRow array
    const participants: AdminParticipantRow[] = (attendanceRows || []).map((row: any) => {
      const part = Array.isArray(row.participant) ? row.participant[0] : row.participant;
      const cert = Array.isArray(row.certificate) ? row.certificate[0] : row.certificate;

      return {
        attendanceId: row.id,
        participantId: part?.id,
        name: part?.full_name ? cleanFullName(part.full_name) : "Unknown",
        email: part?.email || "",
        course: part?.course || "",
        rollNo: part?.roll_no || "",
        submittedAt: row.submitted_at,
        certificateId: cert?.certificate_id || null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          event: {
            id: event.id,
            name: event.name,
            eventDate: event.event_date,
          },
          totalCount: count ?? participants.length,
          participants,
        },
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API/admin/events/participants] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[id]/participants — Remove an attendee and their certificate
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "Event ID is required." } satisfies ApiResponse,
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

    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const attendanceId = body.attendanceId || searchParams.get("attendanceId");
    const participantId = body.participantId || searchParams.get("participantId");
    const certificateId = body.certificateId || searchParams.get("certificateId");

    if (!attendanceId && !participantId) {
      return NextResponse.json(
        {
          success: false,
          error: "Attendance ID or Participant ID is required to remove participant.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 1. Delete certificate(s) for this event & participant / attendance
    if (certificateId) {
      await supabase.from("certificates").delete().eq("certificate_id", certificateId);
    }
    if (attendanceId) {
      await supabase.from("certificates").delete().eq("attendance_id", attendanceId);
    }
    if (participantId) {
      await supabase
        .from("certificates")
        .delete()
        .eq("event_id", eventId)
        .eq("participant_id", participantId);
    }

    // 2. Delete attendance record for this event
    if (attendanceId) {
      const { error: attDeleteErr } = await supabase
        .from("attendance")
        .delete()
        .eq("id", attendanceId);

      if (attDeleteErr) {
        console.error("[API/admin/events/participants] Delete attendance error:", attDeleteErr);
        return NextResponse.json(
          { success: false, error: "Failed to remove attendance record." } satisfies ApiResponse,
          { status: 500 }
        );
      }
    } else if (participantId) {
      await supabase
        .from("attendance")
        .delete()
        .eq("event_id", eventId)
        .eq("participant_id", participantId);
    }

    // 3. Clean up participant record if no other attendance records exist
    if (participantId) {
      const { data: otherAtt } = await supabase
        .from("attendance")
        .select("id")
        .eq("participant_id", participantId)
        .limit(1);

      if (!otherAtt || otherAtt.length === 0) {
        const { data: otherCerts } = await supabase
          .from("certificates")
          .select("id")
          .eq("participant_id", participantId)
          .limit(1);

        if (!otherCerts || otherCerts.length === 0) {
          await supabase.from("participants").delete().eq("id", participantId);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Participant removed successfully.",
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API/admin/events/participants] Unexpected delete error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to remove participant." } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
