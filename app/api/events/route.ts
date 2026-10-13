// ============================================================
// GET /api/events — Public: list all events (no auth required)
// ============================================================
//
// Used by the public Events page to render live event data.
// Returns events ordered by event_date ascending so upcoming
// events appear first.
// ============================================================

import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbEvent } from "@/types/certificate";

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
    .select("id, name, description, event_date, event_timing, speaker_name, attendance_open")
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[API/events] Fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch events." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data: data ?? [] } satisfies ApiResponse<DbEvent[]>,
    {
      headers: {
        // Cache for 60 s on CDN edge, allow stale for up to 5 min while revalidating
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
