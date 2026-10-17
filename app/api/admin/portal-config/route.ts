// ============================================================
// GET  /api/admin/portal-config — Get current portal config
// PUT  /api/admin/portal-config — Update portal config
// ============================================================

import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbPortalConfig } from "@/types/certificate";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("portal_config")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Portal config not found." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data } satisfies ApiResponse<DbPortalConfig>);
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  let body: { activeEventId?: string | null; attendanceEnabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.activeEventId !== undefined) updatePayload.active_event_id = body.activeEventId;
  if (body.attendanceEnabled !== undefined) updatePayload.attendance_enabled = body.attendanceEnabled;

  const { data, error } = await supabase
    .from("portal_config")
    .update(updatePayload)
    .not("id", "is", null)
    .select("*")
    .single();

  if (error) {
    console.error("[API/admin/portal-config] Update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update portal config." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data, message: "Portal config updated." } satisfies ApiResponse<DbPortalConfig>,
  );
}
