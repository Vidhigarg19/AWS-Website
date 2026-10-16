// ============================================================
// PUT    /api/admin/team-members/[id]  — Update a team member
// DELETE /api/admin/team-members/[id]  — Delete a team member
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbTeamMember, AdminTeamMemberRequest } from "@/types/certificate";

/**
 * PUT: Updates an existing team member.
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

  let body: Partial<AdminTeamMemberRequest>;
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
  if (body.picUrl !== undefined) updatePayload.pic_url = body.picUrl?.trim() || null;
  if (body.course !== undefined) updatePayload.course = body.course.trim();
  if (body.branch !== undefined) updatePayload.branch = body.branch.trim();
  if (body.year !== undefined) updatePayload.year = body.year.trim();
  if (body.role !== undefined) updatePayload.role = body.role.trim();
  if (body.batch !== undefined) updatePayload.batch = body.batch.trim() || "2026-27";
  if (body.displayOrder !== undefined) updatePayload.display_order = body.displayOrder;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { success: false, error: "No fields to update." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const { data, error: updateError } = await supabase
    .from("team_members")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    console.error("[API/admin/team-members/[id]] Update error:", updateError);
    return NextResponse.json(
      { success: false, error: "Failed to update team member." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data, message: "Team member updated successfully." } satisfies ApiResponse<DbTeamMember>,
  );
}

/**
 * DELETE: Deletes a team member by ID.
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

  // Check if member exists
  const { data: existingMember, error: fetchError } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("id", id)
    .single();

  if (fetchError || !existingMember) {
    return NextResponse.json(
      { success: false, error: "Team member not found." } satisfies ApiResponse,
      { status: 404 }
    );
  }

  const { error: deleteError } = await supabase
    .from("team_members")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[API/admin/team-members/[id]] Delete error:", deleteError);
    return NextResponse.json(
      { success: false, error: "Failed to delete team member: " + deleteError.message } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Team member "${existingMember.name}" removed successfully.`,
  } satisfies ApiResponse);
}
