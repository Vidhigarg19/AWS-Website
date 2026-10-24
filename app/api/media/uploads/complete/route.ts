// ============================================================
// POST /api/media/uploads/complete   — finish uploads  (media members + admins)
// ============================================================
//
// Body: { mediaIds: string[] }
//
// For each id the server checks the file that really landed in S3 (size,
// Content-Type, first bytes) and only then advances the row. The browser is
// never trusted to say "it worked".
//
// Always 200 with a result per id, so one bad file does not hide the others:
//   accepted | not_uploaded | rejected | failed | not_found | error
// Safe to call again for the same ids (idempotent).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { MEDIA_PORTAL_ROLES } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStorage, s3Ports } from "@/lib/storage/s3";
import { dbPorts } from "@/lib/media/db-ports";
import { completeUpload, type CompletionOutcome, type CompletionRow } from "@/lib/media/complete";
import { validateCompleteRequest } from "@/lib/media/validate";
import type { ApiResponse } from "@/types/certificate";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error } satisfies ApiResponse, { status });
}

type Result = CompletionOutcome | { mediaId: string; state: "error" };

export async function POST(request: NextRequest) {
  const auth = await requireRole(MEDIA_PORTAL_ROLES);
  if (!auth.ok) return auth.response;
  const caller = { role: auth.session.role, userId: auth.session.user.id };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const parsed = validateCompleteRequest(body);
  if (!parsed.ok) return fail(parsed.error, 400);
  const ids = parsed.value;

  const storage = getStorage();
  const db = getAdminClient();
  if (!storage || !db) return fail("Media uploads are not configured.", 500);

  const rowsRes = await db
    .from("media_items")
    .select("id, uploaded_by, kind, mime_type, size_bytes, original_key, status")
    .in("id", ids)
    .eq("source", "s3") // Drive items never go through S3 completion
    .is("deleted_at", null);
  if (rowsRes.error) {
    console.error("[API/media/complete] Row lookup error:", rowsRes.error.message);
    return fail("Failed to complete the upload.", 500);
  }
  const byId = new Map<string, CompletionRow>(
    (rowsRes.data as CompletionRow[]).map((r) => [r.id, r])
  );

  const ports = { ...s3Ports(storage), ...dbPorts(db) };

  const results: Result[] = await Promise.all(
    ids.map(async (id): Promise<Result> => {
      try {
        return await completeUpload(id, byId.get(id), caller, ports);
      } catch (err) {
        // Log details server-side; the client only learns "error" for this file.
        console.error("[API/media/complete] Item error:", id, err instanceof Error ? err.message : err);
        return { mediaId: id, state: "error" };
      }
    })
  );

  // Every file failed unexpectedly: almost certainly configuration (IAM, env).
  if (results.every((r) => r.state === "error")) {
    return fail("Failed to complete the upload.", 500);
  }

  // A video can go live here, so refresh the cached public gallery.
  if (results.some((r) => r.state === "accepted")) revalidatePath("/gallery", "layout");

  return NextResponse.json(
    { success: true, data: { results } } satisfies ApiResponse,
    { headers: NO_STORE }
  );
}
