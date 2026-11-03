// ============================================================
// POST /api/media/drive/import   — link a Google Drive folder/file to an event
// ============================================================
//
// Body: { eventId, link }
//
// "Link only": nothing is downloaded or copied to S3. We list the files Drive
// reports for the link, store their Drive ids, and the public pages show them
// straight from Drive (lib/media/public-view.ts).
//
// Needs GOOGLE_DRIVE_API_KEY (server env). The folder must be shared as
// "Anyone with the link". The pasted link itself is never fetched; only the id
// is extracted (lib/media/drive.ts) and sent to the fixed Drive API host.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { isUuid, MEDIA_PORTAL_ROLES } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { parseDriveLink, planDriveImport } from "@/lib/media/drive";
import { listDriveFiles } from "@/lib/media/drive-api";
import type { ApiResponse } from "@/types/certificate";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error } satisfies ApiResponse, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(MEDIA_PORTAL_ROLES);
  if (!auth.ok) return auth.response;
  const userId = auth.session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const { eventId, link } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof eventId !== "string" || !isUuid(eventId)) return fail("A valid event is required.", 400);
  const parsed = parseDriveLink(link);
  if (!parsed.ok) return fail(parsed.error, 400);

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  const db = getAdminClient();
  if (!apiKey || !db) return fail("Drive import is not configured.", 500);

  const event = await db.from("events").select("id").eq("id", eventId.toLowerCase()).maybeSingle();
  if (event.error) {
    console.error("[API/media/drive] Event lookup error:", event.error.message);
    return fail("Failed to import.", 500);
  }
  if (!event.data) return fail("Event not found.", 404);

  const listing = await listDriveFiles(parsed.value, apiKey, (url) => fetch(url, { cache: "no-store" }));
  if (!listing.ok) return fail(listing.error, listing.status);

  const existing = await db
    .from("media_items")
    .select("drive_file_id")
    .eq("event_id", event.data.id)
    .eq("source", "drive")
    .is("deleted_at", null);
  if (existing.error) {
    console.error("[API/media/drive] Existing lookup error:", existing.error.message);
    return fail("Failed to import.", 500);
  }
  const linked = new Set((existing.data ?? []).map((r) => r.drive_file_id as string));

  const plan = planDriveImport(listing.files, linked, event.data.id, userId);

  if (plan.rows.length > 0) {
    const insert = await db.from("media_items").insert(plan.rows);
    if (insert.error) {
      // Unique index: someone imported the same files a moment ago.
      if (insert.error.code === "23505") {
        return fail("Those files were just imported by someone else. Reload and check.", 409);
      }
      console.error("[API/media/drive] Insert error:", insert.error.message);
      return fail("Failed to import.", 500);
    }
    revalidatePath("/gallery", "layout");
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        added: plan.rows.length,
        duplicates: plan.duplicates,
        unsupported: plan.unsupported,
        overLimit: plan.overLimit,
        truncated: listing.truncated,
      },
    } satisfies ApiResponse,
    { headers: NO_STORE }
  );
}
