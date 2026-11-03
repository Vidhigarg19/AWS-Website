// ============================================================
// POST /api/media/change-password   — change MY OWN password
// ============================================================
//
// Body: { currentPassword, newPassword }
//
// Allowed for every portal role, and (unlike every other media route) also
// while the account still has its temporary password: that is its whole job.
//
// The order of checks lives in lib/auth/change-password.ts and is unit-tested.
// This file only plugs in the real Supabase calls:
//   - verify the current password with a throwaway, session-less client
//   - set the new one with the service key (works whatever the project's
//     "secure password change" setting is)
//   - clear the must-change flag, and sign out the OTHER sessions
//
// Passwords are never logged and never echoed back.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";
import { MEDIA_PORTAL_ROLES } from "@/lib/auth/roles";
import { changePassword, type ChangePasswordPorts } from "@/lib/auth/change-password";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/certificate";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error } satisfies ApiResponse, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(MEDIA_PORTAL_ROLES, { allowPasswordChangePending: true });
  if (!auth.ok) return auth.response;
  const { user } = auth.session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const db = getAdminClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!db || !url || !anonKey) return fail("Password change is not configured.", 500);

  const ports: ChangePasswordPorts = {
    async verifyCurrent(email, password, userId) {
      // A fresh client that stores nothing: this sign-in must not touch the
      // caller's real session cookies.
      const probe = createSupabase(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await probe.auth.signInWithPassword({ email, password });
      // The credentials must belong to THIS account, not just to someone.
      return !error && data.user?.id === userId;
    },

    async setPassword(userId, newPassword) {
      const { error } = await db.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) throw new Error(`updateUserById failed: ${error.message}`);
    },

    async clearMustChange(userId) {
      // Admins have no media_members row: zero rows updated, which is fine.
      const { error } = await db
        .from("media_members")
        .update({ must_change_password: false })
        .eq("id", userId);
      if (error) throw new Error(`clear flag failed: ${error.message}`);
    },

    async revokeOtherSessions() {
      const supabase = createClient(await cookies());
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("no access token");
      const { error } = await db.auth.admin.signOut(token, "others");
      if (error) throw new Error(`signOut(others) failed: ${error.message}`);
    },
  };

  try {
    const outcome = await changePassword(body, { userId: user.id, email: user.email ?? null }, ports);
    if (!outcome.ok) {
      return fail(outcome.error, 400);
    }
    if (!outcome.flagCleared) {
      console.error("[API/media/change-password] password changed but flag NOT cleared for", user.id);
    }
    return NextResponse.json(
      {
        success: true,
        data: { flagCleared: outcome.flagCleared, otherSessionsRevoked: outcome.otherSessionsRevoked },
        message: "Password changed.",
      } satisfies ApiResponse,
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[API/media/change-password] error:", err instanceof Error ? err.message : err);
    return fail("Could not change the password. Try again shortly.", 500);
  }
}
