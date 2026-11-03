// ============================================================
// PATCH /api/admin/media-users/[id] — deactivate / reactivate / reset password
//                                                              (super_admin)
// ============================================================
//
// Body: { active?: boolean, resetPassword?: boolean }
//
// SAFETY: this route only ever acts on ids that exist in public.media_members
// and are NOT in public.admin_users, so it can never be used to disable or
// reset the password of an admin.
//
// Deactivating takes effect immediately for the portal and /api/media/*,
// because every request re-checks media_members.active. (An already-issued
// Supabase JWT stays valid for up to its expiry, but it grants nothing
// without an active media_members row.)

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { SUPER_ADMIN_ONLY, isUuid, validateMediaMemberPatch } from "@/lib/auth/roles";
import { generateTempPassword } from "@/lib/auth/passwords";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/certificate";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(SUPER_ADMIN_ONLY);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid member id." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const parsed = validateMediaMemberPatch(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error } satisfies ApiResponse,
      { status: 400 }
    );
  }
  const patch = parsed.value;

  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  // The target must be a media member...
  const member = await db
    .from("media_members")
    .select("id, active")
    .eq("id", id)
    .maybeSingle();

  if (member.error) {
    console.error("[API/admin/media-users] lookup error:", member.error.message);
    return NextResponse.json(
      { success: false, error: "Could not load the member." } satisfies ApiResponse,
      { status: 500 }
    );
  }
  if (!member.data) {
    return NextResponse.json(
      { success: false, error: "Media member not found." } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // ...and must not also be an admin.
  const adminRow = await db.from("admin_users").select("id").eq("id", id).maybeSingle();
  if (adminRow.error) {
    console.error("[API/admin/media-users] admin check error:", adminRow.error.message);
    return NextResponse.json(
      { success: false, error: "Server configuration error." } satisfies ApiResponse,
      { status: 500 }
    );
  }
  if (adminRow.data) {
    return NextResponse.json(
      { success: false, error: "This account is also an admin and cannot be changed here." } satisfies ApiResponse,
      { status: 409 }
    );
  }

  if (patch.active !== undefined) {
    const { error } = await db
      .from("media_members")
      .update({ active: patch.active })
      .eq("id", id);
    if (error) {
      console.error("[API/admin/media-users] update error:", error.message);
      return NextResponse.json(
        { success: false, error: "Could not update the member." } satisfies ApiResponse,
        { status: 500 }
      );
    }
  }

  let temporaryPassword: string | undefined;
  if (patch.resetPassword) {
    // Flag FIRST: if the reset itself then fails, the member is merely asked to
    // pick a new password. The other order could leave a temporary password
    // in use with no prompt. It also locks sessions that are already open.
    const flag = await db.from("media_members").update({ must_change_password: true }).eq("id", id);
    if (flag.error) {
      console.error("[API/admin/media-users] flag error:", flag.error.message);
      return NextResponse.json(
        { success: false, error: "Could not reset the password." } satisfies ApiResponse,
        { status: 500 }
      );
    }
    temporaryPassword = generateTempPassword();
    const { error } = await db.auth.admin.updateUserById(id, { password: temporaryPassword });
    if (error) {
      console.error("[API/admin/media-users] password reset error:", error.message);
      return NextResponse.json(
        { success: false, error: "Could not reset the password." } satisfies ApiResponse,
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: { id, active: patch.active ?? member.data.active, temporaryPassword },
    } satisfies ApiResponse,
    { headers: { "Cache-Control": "no-store" } }
  );
}
