// ============================================================
// Admin authorization — the ONE place that decides "is this an admin?"
// ============================================================
//
// Why this exists:
//   - Routes under /api/admin/* use the Supabase SERVICE-ROLE client, which
//     bypasses Row Level Security. RLS cannot protect them, so every handler
//     must authorize the caller itself, on the server, before touching data.
//   - Being signed in is NOT enough. Admin status comes from the
//     public.admin_users table (written only by trusted server code).
//   - We never read user_metadata for roles: signed-in users can edit their
//     own user_metadata, so it is not a trustworthy source of authority.
//
// Usage in a route handler (first lines of the handler):
//
//   const auth = await requireAdmin();
//   if (!auth.ok) return auth.response;
//
// Usage in a server component / layout:
//
//   const result = await getAdminSession();
//
// ============================================================

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/certificate";

export type AdminRole = "super_admin" | "admin" | "media";

export interface AdminSession {
  user: User;
  role: AdminRole;
}

export type AdminFailure = "unauthenticated" | "forbidden" | "misconfigured";

export type AdminLookup =
  | { ok: true; session: AdminSession }
  | { ok: false; reason: AdminFailure };

/**
 * Resolves the current cookie session to an admin, or says why not.
 * Fails CLOSED: any unexpected problem means "not an admin".
 */
export async function getAdminSession(): Promise<AdminLookup> {
  // getUser() validates the JWT with the Supabase Auth server.
  // (getSession() only reads the cookie and must not be used for authorization.)
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const db = getAdminClient();
  if (!db) {
    console.error("[auth] Supabase admin client is not configured.");
    return { ok: false, reason: "misconfigured" };
  }

  const { data, error: lookupError } = await db
    .from("admin_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (lookupError) {
    // Most likely cause: the admin_users migration has not been applied yet.
    console.error("[auth] admin_users lookup failed:", lookupError.message);
    return { ok: false, reason: "misconfigured" };
  }

  // Determine user role:
  // - Explicit role in admin_users ('super_admin', 'admin', 'media', 'media_lead')
  // - Or fallback if user email / user_metadata designates the media lead account
  let role: AdminRole | null = null;

  if (data?.role === "media" || data?.role === "media_lead") {
    role = "media";
  } else if (data?.role === "super_admin" || data?.role === "admin") {
    role = data.role as AdminRole;
  } else if (
    user.email?.toLowerCase().includes("media") ||
    user.user_metadata?.role === "media"
  ) {
    role = "media";
  }

  if (!role) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, session: { user, role } };
}

const FAILURE_RESPONSES: Record<AdminFailure, { status: number; error: string }> = {
  unauthenticated: { status: 401, error: "Authentication required." },
  forbidden: { status: 403, error: "You do not have permission to do this." },
  misconfigured: { status: 500, error: "Server configuration error." },
};

/**
 * Guard for API route handlers. Returns the admin session, or a ready-made
 * JSON error response the handler should return immediately.
 */
export async function requireAdmin(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse }
> {
  const result = await getAdminSession();
  if (result.ok) return result;

  const { status, error } = FAILURE_RESPONSES[result.reason];
  return {
    ok: false,
    response: NextResponse.json({ success: false, error } satisfies ApiResponse, { status }),
  };
}
