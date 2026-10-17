// ============================================================
// POST /api/admin/team-members/bulk-import
// Accepts JSON array of team member objects parsed from
// Excel/CSV on the client side and bulk-inserts them.
// ============================================================

import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbTeamMember } from "@/types/certificate";

interface BulkImportMember {
  name: string;
  pic_url?: string | null;
  course: string;
  branch: string;
  year: string;
  role: string;
  batch?: string;
  display_order?: number;
}

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

  let body: {
    members: BulkImportMember[];
    batch?: string;
    mode?: "append" | "overwrite";
    overwriteScope?: "batch" | "all";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const {
    members,
    batch: defaultBatch = "2026-27",
    mode = "append",
    overwriteScope = "batch",
  } = body;

  if (!Array.isArray(members) || members.length === 0) {
    return NextResponse.json(
      { success: false, error: "No members provided." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  if (members.length > 200) {
    return NextResponse.json(
      { success: false, error: "Maximum 200 members per import batch." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // Validate & normalize each row
  const rows: BulkImportMember[] = [];
  const validationErrors: string[] = [];

  members.forEach((m, i) => {
    const rowNum = i + 2; // +2 because row 1 is header
    const name = (m.name ?? "").toString().trim();
    const course = (m.course ?? "").toString().trim();
    const branch = (m.branch ?? "").toString().trim();
    const year = (m.year ?? "").toString().trim();
    const role = (m.role ?? "").toString().trim();

    if (!name) { validationErrors.push(`Row ${rowNum}: Name is required`); return; }
    if (!course) { validationErrors.push(`Row ${rowNum}: Course is required`); return; }
    if (!branch) { validationErrors.push(`Row ${rowNum}: Branch is required`); return; }
    if (!year) { validationErrors.push(`Row ${rowNum}: Year is required`); return; }
    if (!role) { validationErrors.push(`Row ${rowNum}: Role is required`); return; }

    rows.push({
      name,
      pic_url: (m.pic_url ?? "").toString().trim() || null,
      course,
      branch,
      year,
      role,
      batch: (m.batch ?? "").toString().trim() || defaultBatch,
      display_order: typeof m.display_order === "number" ? m.display_order : i,
    });
  });

  if (validationErrors.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Validation failed for ${validationErrors.length} row(s).`,
        data: validationErrors,
      } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // If overwrite mode is selected, delete existing data prior to insert
  if (mode === "overwrite") {
    let deleteQuery;
    if (overwriteScope === "all") {
      deleteQuery = supabase
        .from("team_members")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      // Overwrite target batches
      const targetBatches = Array.from(
        new Set([defaultBatch, ...rows.map((r) => r.batch).filter(Boolean) as string[]])
      );
      deleteQuery = supabase
        .from("team_members")
        .delete()
        .in("batch", targetBatches);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.error("[API/team-members/bulk-import] Delete error during overwrite:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to overwrite existing data: " + deleteError.message } satisfies ApiResponse,
        { status: 500 }
      );
    }
  }

  // Bulk insert
  const { data: inserted, error: insertError } = await supabase
    .from("team_members")
    .insert(rows)
    .select("*");

  if (insertError) {
    console.error("[API/team-members/bulk-import] Insert error:", insertError);
    return NextResponse.json(
      { success: false, error: "Database insert failed: " + insertError.message } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: inserted,
      message:
        mode === "overwrite"
          ? `Successfully overwritten and imported ${inserted?.length ?? 0} team members.`
          : `Successfully imported ${inserted?.length ?? 0} team members.`,
    } satisfies ApiResponse<DbTeamMember[]>,
    { status: 201 }
  );
}
