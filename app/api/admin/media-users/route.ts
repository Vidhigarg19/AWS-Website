// ============================================================
// GET  /api/admin/media-users — list media-member accounts   (super_admin)
// POST /api/admin/media-users — create a media-member account (super_admin)
// ============================================================
//
// Media members sign in at /media/login with email + password. There is NO
// public signup: only a super admin can create accounts, here.
//
// POST returns a generated temporary password ONCE. It is not stored and
// cannot be retrieved again (use PATCH { resetPassword: true } for a new one).

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { SUPER_ADMIN_ONLY, validateMediaMemberInput } from "@/lib/auth/roles";
import { generateTempPassword } from "@/lib/auth/passwords";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/certificate";

const NO_STORE = { "Cache-Control": "no-store" };

interface MediaMemberRow {
  id: string;
  email: string;
  display_name: string;
  active: boolean;
  created_at: string;
}

export async function GET() {
  const auth = await requireRole(SUPER_ADMIN_ONLY);
  if (!auth.ok) return auth.response;

  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const { data, error } = await db
    .from("media_members")
    .select("id, email, display_name, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[API/admin/media-users] List error:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to load media members." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data } satisfies ApiResponse<MediaMemberRow[]>,
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(SUPER_ADMIN_ONLY);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const input = validateMediaMemberInput(body);
  if (!input.ok) {
    return NextResponse.json(
      { success: false, error: input.error } satisfies ApiResponse,
      { status: 400 }
    );
  }
  const { email, displayName } = input.value;

  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { success: false, error: "Database not configured." } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const temporaryPassword = generateTempPassword();

  // 1) Auth account. createUser fails if the email is already registered, so
  //    this endpoint can never take over an existing admin's account.
  const created = await db.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (created.error || !created.data.user) {
    const message = created.error?.message ?? "";
    const exists = /already|registered|exists/i.test(message);
    if (!exists) console.error("[API/admin/media-users] createUser error:", message);
    return NextResponse.json(
      {
        success: false,
        error: exists
          ? "An account with this email already exists."
          : "Could not create the account.",
      } satisfies ApiResponse,
      { status: exists ? 409 : 500 }
    );
  }

  const newUser = created.data.user;

  // 2) Grant media access. If this fails, undo step 1 so we never leave an
  //    orphan login that has no role.
  const { error: insertError } = await db.from("media_members").insert({
    id: newUser.id,
    email,
    display_name: displayName,
    created_by: auth.session.user.id,
  });

  if (insertError) {
    console.error("[API/admin/media-users] insert error:", insertError.message);
    const { error: rollbackError } = await db.auth.admin.deleteUser(newUser.id);
    if (rollbackError) {
      console.error("[API/admin/media-users] ROLLBACK FAILED for", newUser.id, rollbackError.message);
    }
    return NextResponse.json(
      {
        success: false,
        error: "Could not grant media access. Check that the media_members migration is applied.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: { id: newUser.id, email, displayName, temporaryPassword },
      message: "Share the temporary password securely. It will not be shown again.",
    } satisfies ApiResponse,
    { status: 201, headers: NO_STORE }
  );
}
