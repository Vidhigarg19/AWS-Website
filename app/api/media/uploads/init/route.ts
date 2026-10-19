// ============================================================
// POST /api/media/uploads/init   — start an upload   (media members + admins)
// ============================================================
//
// Body: { eventId, purpose?: "gallery" | "cover", files: [{ type, size }] }
//
// What it does, in order:
//   1. Auth (requireRole) and body validation (lib/media/validate.ts)
//   2. The event must exist
//   3. Per-user cap on unfinished uploads
//   4. Plan server-generated ids and S3 keys (the client never picks a key)
//   5. Sign one presigned POST per file (exact key, type and size)
//   6. Insert the `pending` rows, then return the signatures
//
// Signing happens BEFORE the insert, so a signing failure leaves no rows.
// The browser then POSTs each file straight to S3, and calls /complete.

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { MEDIA_PORTAL_ROLES } from "@/lib/auth/roles";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStorage, signUpload, type SignedUpload } from "@/lib/storage/s3";
import { validateInitRequest } from "@/lib/media/validate";
import { planPendingRows } from "@/lib/media/plan";
import { MAX_PENDING_PER_USER, PRESIGN_TTL_SECONDS } from "@/lib/media/policy";
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

  const parsed = validateInitRequest(body);
  if (!parsed.ok) return fail(parsed.error, 400);
  const req = parsed.value;

  const storage = getStorage();
  const db = getAdminClient();
  if (!storage || !db) return fail("Media uploads are not configured.", 500);

  // 2) The event must exist.
  const eventRes = await db.from("events").select("id").eq("id", req.eventId).maybeSingle();
  if (eventRes.error) {
    console.error("[API/media/init] Event lookup error:", eventRes.error.message);
    return fail("Failed to start the upload.", 500);
  }
  if (!eventRes.data) return fail("Event not found.", 404);

  // 3) Cap unfinished uploads (limits orphaned files from abandoned uploads).
  const pending = await db
    .from("media_items")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by", userId)
    .eq("status", "pending");
  if (pending.error) {
    console.error("[API/media/init] Pending count error:", pending.error.message);
    return fail("Failed to start the upload.", 500);
  }
  if ((pending.count ?? 0) + req.files.length > MAX_PENDING_PER_USER) {
    return fail("Too many unfinished uploads. Finish or wait for them to expire, then try again.", 429);
  }

  // A cover abandoned before its upload link expired would block the event's
  // single cover slot forever. Release stale ones (conditional: pending only).
  if (req.purpose === "cover") {
    const cutoff = new Date(Date.now() - (PRESIGN_TTL_SECONDS + 60) * 1000).toISOString();
    const release = await db
      .from("media_items")
      .update({ status: "failed" })
      .eq("event_id", req.eventId)
      .eq("purpose", "cover")
      .eq("status", "pending")
      .lt("created_at", cutoff);
    if (release.error) {
      console.error("[API/media/init] Stale cover release error:", release.error.message);
      return fail("Failed to start the upload.", 500);
    }
  }

  // 4) + 5) Plan and sign.
  const planned = planPendingRows(req, userId, () => crypto.randomUUID());
  let signed: SignedUpload[];
  try {
    signed = await Promise.all(
      planned.map(({ row }) =>
        signUpload(storage, {
          key: row.original_key,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          kind: row.kind,
        })
      )
    );
  } catch (err) {
    console.error("[API/media/init] Signing error:", err instanceof Error ? err.message : err);
    return fail("Failed to start the upload.", 500);
  }

  // 6) Insert the pending rows.
  const insert = await db.from("media_items").insert(planned.map((p) => p.row));
  if (insert.error) {
    if (insert.error.code === "23505" && req.purpose === "cover") {
      return fail("This event already has a cover image. Remove it before uploading a new one.", 409);
    }
    if (insert.error.code === "23503") return fail("Event not found.", 404);
    console.error("[API/media/init] Insert error:", insert.error.message);
    return fail("Failed to start the upload.", 500);
  }

  const uploads = planned.map((p, i) => ({
    index: p.index,
    mediaId: p.row.id,
    url: signed[i].url,
    fields: signed[i].fields,
  }));

  return NextResponse.json(
    { success: true, data: { uploads, expiresInSeconds: PRESIGN_TTL_SECONDS } } satisfies ApiResponse,
    { headers: NO_STORE }
  );
}
