// ============================================================
// GET /api/media/me — who am I, and may I use the Media Portal?
// ============================================================
// Used by /media/login right after sign-in so an account without media
// access (for example a random Supabase user) is told so and signed out.

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { MEDIA_PORTAL_ROLES, type PortalRole } from "@/lib/auth/roles";
import type { ApiResponse } from "@/types/certificate";

interface MeResponse {
  role: PortalRole;
  email: string | null;
  displayName: string | null;
}

export async function GET() {
  const auth = await requireRole(MEDIA_PORTAL_ROLES);
  if (!auth.ok) return auth.response;

  const { user, role, displayName } = auth.session;
  return NextResponse.json(
    {
      success: true,
      data: { role, email: user.email ?? null, displayName },
    } satisfies ApiResponse<MeResponse>,
    { headers: { "Cache-Control": "no-store" } }
  );
}
