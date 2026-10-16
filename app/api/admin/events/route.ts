// ============================================================
// GET  /api/admin/events      — List all events
// POST /api/admin/events      — Create a new event
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbEvent, AdminEventRequest } from "@/types/certificate";

/**
 * GET: Returns all events, ordered by event_date descending.
 */
export async function GET() {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });

  if (error) {
    console.error("[API/admin/events] List error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch events." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data } satisfies ApiResponse<DbEvent[]>);
}

/**
 * POST: Creates a new event. Optionally sets it as the active portal event.
 */
export async function POST(request: NextRequest) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  let body: AdminEventRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // ── Validate ──────────────────────────────────────────────
  const errors: Record<string, string> = {};
  if (!body.name?.trim()) errors.name = "Event name is required.";
  const isTBA = Boolean(body.isTBA || (!body.eventDate && !body.eventTiming));
  if (!isTBA) {
    if (!body.eventDate?.trim()) errors.eventDate = "Event date is required.";
    if (!body.eventTiming?.trim()) errors.eventTiming = "Event timing is required.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { success: false, error: "Validation failed.", data: errors } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // ── Insert event ──────────────────────────────────────────
  const { data: newEvent, error: insertError } = await supabase
    .from("events")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      event_date: isTBA ? null : (body.eventDate?.trim() || null),
      event_timing: isTBA ? null : (body.eventTiming?.trim() || null),
      speaker_name: body.speakerName?.trim() || null,
      attendance_open: body.attendanceOpen ?? false,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("[API/admin/events] Insert error:", insertError);
    return NextResponse.json(
      { success: false, error: "Failed to create event." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  // ── Optionally set as active event ────────────────────────
  if (body.setAsActive && newEvent) {
    const { error: configError } = await supabase
      .from("portal_config")
      .update({
        active_event_id: newEvent.id,
        attendance_enabled: body.attendanceOpen ?? false,
      })
      .not("id", "is", null); // Update the single row

    if (configError) {
      console.error("[API/admin/events] Portal config update error:", configError);
      // Event was created but config update failed — log but don't fail
    }
  }

  return NextResponse.json(
    { success: true, data: newEvent, message: "Event created successfully." } satisfies ApiResponse<DbEvent>,
    { status: 201 }
  );
}
