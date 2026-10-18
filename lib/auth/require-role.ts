// ============================================================
// Role-based authorization for the Media Portal and its admin APIs
// ============================================================
//
// requireAdmin()  (require-admin.ts)  → "is this a dashboard admin?"
//                                        reads ONLY public.admin_users.
// requireRole()   (this file)         → "does this user hold one of these roles?"
//                                        also knows media members.
//
// Media members are stored in public.media_members, never in admin_users, so
// they can NEVER pass requireAdmin() or the is_admin() RLS helper.
//
// Usage in a route handler (first lines):
//
//   const auth = await requireRole(MEDIA_PORTAL_ROLES);
//   if (!auth.ok) return auth.response;
//   auth.session.role  // "super_admin" | "admin" | "media_manager"
//
// Like requireAdmin(), this fails CLOSED and uses getUser() (validated with
// the Auth server), never getSession() or user_metadata.
//
// ============================================================

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/certificate";
import { FAILURE_RESPONSES, type AdminFailure } from "./require-admin";
import { isRoleAllowed, resolvePortalRole, type PortalRole } from "./roles";

export interface PortalSession {
  user: User;
  role: PortalRole;
  /** Shown in the portal header. Falls back to the email if unknown. */
  displayName: string | null;
}

export type PortalLookup =
  | { ok: true; session: PortalSession }
  | { ok: false; reason: AdminFailure };

export async function getPortalSession(): Promise<PortalLookup> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { ok: false, reason: "unauthenticated" };

  const db = getAdminClient();
  if (!db) {
    console.error("[auth] Supabase admin client is not configured.");
    return { ok: false, reason: "misconfigured" };
  }

  // 1) Dashboard admins first. An admin row always wins.
  const adminRes = await db
    .from("admin_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminRes.error) {
    console.error("[auth] admin_users lookup failed:", adminRes.error.message);
    return { ok: false, reason: "misconfigured" };
  }

  const adminRole = resolvePortalRole(adminRes.data?.role, null);
  if (adminRole) {
    return {
      ok: true,
      session: {
        user,
        role: adminRole,
        displayName: (user.user_metadata?.display_name as string | undefined) ?? null,
      },
    };
  }

  // 2) Media members (must be explicitly active).
  const memberRes = await db
    .from("media_members")
    .select("active, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (memberRes.error) {
    // Most likely cause: the media_members migration has not been applied.
    console.error("[auth] media_members lookup failed:", memberRes.error.message);
    return { ok: false, reason: "misconfigured" };
  }

  const role = resolvePortalRole(null, memberRes.data?.active);
  if (!role) return { ok: false, reason: "forbidden" };

  return {
    ok: true,
    session: { user, role, displayName: memberRes.data?.display_name ?? null },
  };
}

/**
 * Guard for API route handlers. Returns the session, or a ready-made JSON
 * error response the handler should return immediately.
 */
export async function requireRole(
  allowed: readonly PortalRole[]
): Promise<
  { ok: true; session: PortalSession } | { ok: false; response: NextResponse }
> {
  const result = await getPortalSession();

  if (!result.ok) {
    const { status, error } = FAILURE_RESPONSES[result.reason];
    return {
      ok: false,
      response: NextResponse.json({ success: false, error } satisfies ApiResponse, { status }),
    };
  }

  if (!isRoleAllowed(result.session.role, allowed)) {
    const { status, error } = FAILURE_RESPONSES.forbidden;
    return {
      ok: false,
      response: NextResponse.json({ success: false, error } satisfies ApiResponse, { status }),
    };
  }

  return result;
}
