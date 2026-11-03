// ============================================================
// PATCH  /api/media/items/[id]  — edit caption, hide or show   (members + admins)
// DELETE /api/media/items/[id]  — remove from the site (soft delete)
// ============================================================
//
// Who may act: admins on any item; media members only on items THEY uploaded
// (lib/media/access.ts). Someone else's item looks exactly like a missing one (404).
//
// PATCH body: { caption?: string | null, hidden?: boolean }
//   - hide / show moves the row ready <-> hidden with a conditional update
//     (UPDATE ... WHERE id = $id AND status = <what we just read>), so two
//     people clicking at once cannot overwrite each other.
//
// DELETE is a SOFT delete (deleted_at = now()): the item leaves the public
// site immediately. The S3 files are purged later by the cleanup job.
//
// Both refresh the cached public gallery so a takedown is visible right away.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { MEDIA_PORTAL_ROLES, isUuid } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { canManageUpload } from "@/lib/media/access";
import { planItemPatch, validateItemPatch } from "@/lib/media/moderation";
import { isMediaStatus } from "@/lib/media/status";
import type { ApiResponse } from "@/types/certificate";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error } satisfies ApiResponse, { status });
}

/** Load the row and check the caller may act on it. Null = respond 404. */
async function loadManageable(
  id: string,
  caller: { role: Parameters<typeof canManageUpload>[0]; userId: string }
) {
  const db = getAdminClient();
  if (!db) return { error: fail("Database not configured.", 500) } as const;

  const { data, error } = await db
    .from("media_items")
    .select("id, uploaded_by, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[API/media/items] Lookup error:", error.message);
    return { error: fail("Failed to load the item.", 500) } as const;
  }
  if (!data || !isMediaStatus(data.status) || !canManageUpload(caller.role, caller.userId, data.uploaded_by)) {
    return { error: fail("Item not found.", 404) } as const;
  }
  return { db, row: { id: data.id as string, status: data.status } } as const;
}

function refreshPublicPages() {
  // "layout" also covers every page under /gallery (including /gallery/[eventId]).
  revalidatePath("/gallery", "layout");
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MEDIA_PORTAL_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return fail("Invalid item id.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const parsed = validateItemPatch(body);
  if (!parsed.ok) return fail(parsed.error, 400);

  const loaded = await loadManageable(id.toLowerCase(), { role: auth.session.role, userId: auth.session.user.id });
  if ("error" in loaded) return loaded.error;
  const { db, row } = loaded;

  const plan = planItemPatch(row.status, parsed.value);
  if (!plan.ok) return fail(plan.error, 409);

  if (Object.keys(plan.update).length === 0) {
    return NextResponse.json({ success: true, data: { status: row.status, changed: false } } satisfies ApiResponse, { headers: NO_STORE });
  }

  const { data, error } = await db
    .from("media_items")
    .update(plan.update)
    .eq("id", row.id)
    .eq("status", plan.expectStatus) // conditional: only if nobody changed it meanwhile
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[API/media/items] Update error:", error.message);
    return fail("Failed to update the item.", 500);
  }
  if ((data?.length ?? 0) === 0) {
    return fail("This item was just changed by someone else. Reload and try again.", 409);
  }

  refreshPublicPages();
  return NextResponse.json(
    { success: true, data: { status: plan.update.status ?? row.status, changed: true } } satisfies ApiResponse,
    { headers: NO_STORE }
  );
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MEDIA_PORTAL_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return fail("Invalid item id.", 400);

  const loaded = await loadManageable(id.toLowerCase(), { role: auth.session.role, userId: auth.session.user.id });
  if ("error" in loaded) return loaded.error;
  const { db, row } = loaded;

  const { error } = await db
    .from("media_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("deleted_at", null);

  if (error) {
    console.error("[API/media/items] Delete error:", error.message);
    return fail("Failed to delete the item.", 500);
  }

  refreshPublicPages();
  return NextResponse.json({ success: true } satisfies ApiResponse, { headers: NO_STORE });
}
