// ============================================================
// GET /api/team-members — Public API to retrieve team members
// Supports optional query parameter: ?batch=2026-27
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbTeamMember } from "@/types/certificate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
    console.error("[API/team-members] Fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team members." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: data || [],
  } satisfies ApiResponse<DbTeamMember[]>);
}
