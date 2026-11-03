// ============================================================
// POST /api/cron/media-cleanup   — scheduled housekeeping (secret-protected)
// ============================================================
//
//   Authorization: Bearer <CRON_SECRET>      (>= 32 chars, else this route is OFF)
//   ?dryRun=1                                 report only, change nothing
//   ?limit=100                                rows per run (default 200, max 1000)
//
// Called once a day by .github/workflows/media-cleanup.yml (or EventBridge
// Scheduler). See docs/architecture/media-portal.md#cleanup.

import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/auth/cron-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStorage } from "@/lib/storage/s3";
import { runCleanup, DEFAULT_CLEANUP_LIMIT } from "@/lib/media/cleanup";
import { cleanupPorts } from "@/lib/media/cleanup-ports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "disabled") {
    // 404, not 403: do not advertise a job that is switched off.
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404, headers: NO_STORE });
  }
  if (auth !== "ok") {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401, headers: NO_STORE });
  }

  const storage = getStorage();
  const db = getAdminClient();
  if (!storage || !db) {
    return NextResponse.json({ success: false, error: "Media is not configured." }, { status: 500, headers: NO_STORE });
  }

  const params = request.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const limitParam = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : DEFAULT_CLEANUP_LIMIT;

  try {
    const now = Date.now();
    const report = await runCleanup(
      cleanupPorts({ db, storage, now, distributionId: process.env.MEDIA_CDN_DISTRIBUTION_ID?.trim() || undefined }),
      { now, dryRun, limit }
    );
    console.log("[media-cleanup]", JSON.stringify(report));
    return NextResponse.json({ success: true, report }, { headers: NO_STORE });
  } catch (err) {
    console.error("[media-cleanup] failed:", err);
    return NextResponse.json({ success: false, error: "Cleanup failed." }, { status: 500, headers: NO_STORE });
  }
}
