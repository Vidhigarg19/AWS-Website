// ============================================================
// GET /api/team-members — Public API to retrieve team members
// Supports optional query parameter: ?batch=2026-27
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbTeamMember } from "@/types/certificate";

export const dynamic = "force-dynamic";

type SupabaseErrorDebug = {
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
};

function getMissingSupabaseVariables(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SECRET_KEY) {
    missing.push("SUPABASE_SECRET_KEY");
  }
  return missing;
}

export async function GET(request: NextRequest) {
  const supabase = getAdminClient();
  if (!supabase) {
    const missingVariables = getMissingSupabaseVariables();
    const message = missingVariables.length
      ? `Missing required environment variable(s): ${missingVariables.join(", ")}.`
      : "Supabase client could not be created.";

    console.error("[API/team-members] Supabase client unavailable:", {
      missingVariables,
      message,
    });

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          success: false,
          error: "Database not configured.",
          debug: {
            code: "SUPABASE_CLIENT_UNAVAILABLE",
            message,
            details: null,
            hint: null,
            missingVariables,
          },
        },
        { status: 500 }
      );
    }

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
    const debug: SupabaseErrorDebug = {
      code: error.code ?? null,
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    };
    console.error("[API/team-members] Fetch error:", debug);

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch team members.",
          debug,
        },
        { status: 500 }
      );
    }

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
