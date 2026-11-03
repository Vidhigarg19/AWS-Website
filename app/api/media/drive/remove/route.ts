// ============================================================
// POST /api/media/drive/remove   — unlink every Google Drive item from an event
// ============================================================
//
// Body: { eventId }
//
// Removes the items from the SITE only. Like DELETE /api/media/items/[id]
// this is a soft delete (deleted_at = now()): the items leave the public pages
// at once and the cleanup job drops the rows later. Files in Google Drive are
// never touched; the site only holds read-only links to them.
//
// Who may act (lib/media/access.ts): admins remove every Drive item on the
// event; media members remove only the Drive items they imported themselves.
//
// Soft-deleted rows do not block a re-import (media_items_drive_file_per_event_idx
// only covers rows with deleted_at IS NULL), so the same folder can be linked again.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { isUuid, MEDIA_PORTAL_ROLES } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { canManageAllUploads } from "@/lib/media/access";
import type { ApiResponse } from "@/types/certificate";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error } satisfies ApiResponse, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(MEDIA_PORTAL_ROLES);
  if (!auth.ok) return auth.response;
  const { role, user } = auth.session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const { eventId } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof eventId !== "string" || !isUuid(eventId)) return fail("A valid event is required.", 400);

  const db = getAdminClient();
  if (!db) return fail("Database not configured.", 500);

  let query = db
    .from("media_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("event_id", eventId.toLowerCase())
    .eq("source", "drive")
    .is("deleted_at", null);
  // Members may only remove what they imported (mirrors canManageUpload()).
  if (!canManageAllUploads(role)) query = query.eq("uploaded_by", user.id);

  const { data, error } = await query.select("id");
  if (error) {
    console.error("[API/media/drive/remove] Update error:", error.message);
    return fail("Failed to remove the Drive items.", 500);
  }

  const removed = data?.length ?? 0;
  if (removed > 0) {
    // "layout" also covers every page under /gallery (including /gallery/[eventId]).
    revalidatePath("/gallery", "layout");
  }

  return NextResponse.json({ success: true, data: { removed } } satisfies ApiResponse, { headers: NO_STORE });
}
