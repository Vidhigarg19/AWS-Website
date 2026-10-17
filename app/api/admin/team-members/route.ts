// ============================================================
// GET  /api/admin/team-members      — List all team members
// POST /api/admin/team-members      — Create a new team member
// ============================================================

import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbTeamMember, AdminTeamMemberRequest } from "@/types/certificate";

/**
 * GET: Returns all team members, ordered by batch, display_order then name.
 * Optional query parameter ?batch=2026-27 filters by batch.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const batch = searchParams.get("batch");

  let query = supabase.from("team_members").select("*");

  if (batch && batch !== "ALL") {
    query = query.eq("batch", batch);
  }

  const { data, error } = await query
    .order("batch", { ascending: false })
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[API/admin/team-members] List error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team members." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data } satisfies ApiResponse<DbTeamMember[]>);
}

/**
 * POST: Creates a new team member.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  let body: AdminTeamMemberRequest;
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
  if (!body.name?.trim()) errors.name = "Name is required.";
  if (!body.course?.trim()) errors.course = "Course is required.";
  if (!body.branch?.trim()) errors.branch = "Branch is required.";
  if (!body.year?.trim()) errors.year = "Year is required.";
  if (!body.role?.trim()) errors.role = "Role is required.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { success: false, error: "Validation failed.", data: errors } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // ── Insert team member ──────────────────────────────────────
  const { data: newMember, error: insertError } = await supabase
    .from("team_members")
    .insert({
      name: body.name.trim(),
      pic_url: body.picUrl?.trim() || null,
      course: body.course.trim(),
      branch: body.branch.trim(),
      year: body.year.trim(),
      role: body.role.trim(),
      batch: body.batch?.trim() || "2026-27",
      display_order: body.displayOrder ?? 0,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("[API/admin/team-members] Insert error:", insertError);
    return NextResponse.json(
      { success: false, error: "Failed to create team member." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data: newMember, message: "Team member added successfully." } satisfies ApiResponse<DbTeamMember>,
    { status: 201 }
  );
}
