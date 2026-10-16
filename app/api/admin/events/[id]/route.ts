// ============================================================
// PUT /api/admin/events/[id]  — Update an event
// GET /api/admin/events/[id]  — Get a single event
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbEvent, AdminEventRequest } from "@/types/certificate";

/**
 * GET: Returns a single event by ID.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const { id } = await context.params;

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Event not found." } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data } satisfies ApiResponse<DbEvent>);
}

/**
 * PUT: Updates an existing event. Optionally sets it as the active portal event.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const { id } = await context.params;

  let body: Partial<AdminEventRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // Build update payload — only include fields that were provided
  const updatePayload: Record<string, unknown> = {};
  if (body.name !== undefined) updatePayload.name = body.name.trim();
  if (body.description !== undefined) updatePayload.description = body.description?.trim() || null;
  if (body.isTBA) {
    updatePayload.event_date = null;
    updatePayload.event_timing = null;
  } else {
    if (body.eventDate !== undefined) updatePayload.event_date = body.eventDate ? body.eventDate.trim() : null;
    if (body.eventTiming !== undefined) updatePayload.event_timing = body.eventTiming ? body.eventTiming.trim() : null;
  }
  if (body.speakerName !== undefined) updatePayload.speaker_name = body.speakerName?.trim() || null;
  if (body.attendanceOpen !== undefined) updatePayload.attendance_open = body.attendanceOpen;

  if (Object.keys(updatePayload).length === 0 && !body.setAsActive) {
    return NextResponse.json(
      { success: false, error: "No fields to update." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // ── Update event ──────────────────────────────────────────
  let updatedEvent: DbEvent | null = null;

  if (Object.keys(updatePayload).length > 0) {
    const { data, error: updateError } = await supabase
      .from("events")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[API/admin/events/[id]] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update event." } satisfies ApiResponse,
        { status: 500 }
      );
    }
    updatedEvent = data;
  }

  // ── Optionally set as active event ────────────────────────
  if (body.setAsActive) {
    const attendanceEnabled = body.attendanceOpen ?? updatedEvent?.attendance_open ?? false;

    const { error: configError } = await supabase
      .from("portal_config")
      .update({
        active_event_id: id,
        attendance_enabled: attendanceEnabled,
      })
      .not("id", "is", null);

    if (configError) {
      console.error("[API/admin/events/[id]] Portal config update error:", configError);
    }
  }

  // If we only updated portal config, fetch the event for the response
  if (!updatedEvent) {
    const { data } = await supabase.from("events").select("*").eq("id", id).single();
    updatedEvent = data;
  }

  return NextResponse.json(
    { success: true, data: updatedEvent, message: "Event updated successfully." } satisfies ApiResponse<DbEvent | null>,
  );
}

/**
 * DELETE: Deletes an event by ID.
 * Automatically cascades to attendance and certificates in database.
 * If this was the active event, resets portal_config.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const { id } = await context.params;

  // 1. Check if event exists
  const { data: existingEvent, error: fetchError } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .single();

  if (fetchError || !existingEvent) {
    return NextResponse.json(
      { success: false, error: "Event not found." } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 2. If it is the active portal event, reset portal_config
  const { data: config } = await supabase
    .from("portal_config")
    .select("id, active_event_id")
    .single();

  if (config?.active_event_id === id) {
    await supabase
      .from("portal_config")
      .update({
        active_event_id: null,
        attendance_enabled: false,
      })
      .eq("id", config.id);
  }

  // 3. Delete the event (cascades to attendance and certificates)
  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[API/admin/events/[id]] Delete error:", deleteError);
    return NextResponse.json(
      { success: false, error: "Failed to delete event: " + deleteError.message } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Event "${existingEvent.name}" deleted successfully.`,
  } satisfies ApiResponse);
}

