// ============================================================
// GET /api/admin/media-health — configuration + queue health   (super_admin)
// ============================================================
// Booleans and counts only. Never returns a secret or a key.

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { SUPER_ADMIN_ONLY } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildHealth, type HealthCounts } from "@/lib/media/health";
import { PENDING_MAX_AGE_MS, PROCESSING_MAX_AGE_MS } from "@/lib/media/cleanup";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireRole(SUPER_ADMIN_ONLY);
  if (!auth.ok) return auth.response;
  const db = getAdminClient();
  if (!db) return NextResponse.json({ success: false, error: "Database is not configured." }, { status: 500, headers: NO_STORE });

  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const count = async (build: (q: ReturnType<typeof base>) => unknown) => {
    const res = (await build(base())) as { count: number | null; error: { message: string } | null };
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  };
  const base = () => db.from("media_items").select("id", { count: "exact", head: true });

  try {
    const [pending, processing, failed, stalePending, stuckProcessing, softDeleted, oldest] = await Promise.all([
      count((q) => q.is("deleted_at", null).eq("status", "pending")),
      count((q) => q.is("deleted_at", null).eq("status", "processing")),
      count((q) => q.is("deleted_at", null).eq("status", "failed")),
      count((q) => q.is("deleted_at", null).eq("status", "pending").lt("created_at", iso(now - PENDING_MAX_AGE_MS))),
      count((q) => q.is("deleted_at", null).eq("status", "processing").lt("updated_at", iso(now - PROCESSING_MAX_AGE_MS))),
      count((q) => q.not("deleted_at", "is", null)),
      db.from("media_items").select("created_at").is("deleted_at", null).eq("status", "pending")
        .order("created_at", { ascending: true }).limit(1),
    ]);
    const counts: HealthCounts = {
      pending, processing, failed, stalePending, stuckProcessing, softDeleted,
      oldestPendingAt: (oldest.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
    };
    return NextResponse.json({ success: true, data: buildHealth(process.env, counts) }, { headers: NO_STORE });
  } catch (err) {
    console.error("[media-health] failed:", err);
    return NextResponse.json({ success: false, error: "Could not read media health." }, { status: 500, headers: NO_STORE });
  }
}
