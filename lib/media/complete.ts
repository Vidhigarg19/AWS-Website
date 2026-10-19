// ============================================================
// Finish one upload: verify the stored object, then advance its status
// ============================================================
//
// The orchestration is written against small "ports" (functions) instead of
// the AWS SDK or Supabase directly. Production passes real implementations;
// tests pass fakes, which lets us test the awkward cases (missing file, wrong
// bytes, a request that loses a race to another worker) without any network.
//
// Outcome per upload (never throws for expected situations):
//   not_found     row does not exist, or the caller may not touch it
//   not_uploaded  the file has not arrived in S3 yet — the client can retry
//   rejected      the file is not what was declared; row marked failed, file deleted
//   accepted      verified. `status` is where the row is now
//   failed        the row was already failed earlier
//
// Idempotent: calling complete twice (client retry, double click) is safe.
// ============================================================

import { canManageUpload } from "./access.ts";
import type { MediaKind } from "./policy.ts";
import { SNIFF_BYTES } from "./policy.ts";
import type { MediaStatus } from "./status.ts";
import { verifyUpload, type VerifyResult } from "./verify.ts";
import type { PortalRole } from "../auth/roles.ts";

export interface CompletionRow {
  id: string;
  uploaded_by: string | null;
  kind: MediaKind;
  mime_type: string;
  size_bytes: number;
  original_key: string;
  status: MediaStatus;
}

export interface CompletionPorts {
  /** null when the object does not exist (yet). Throw for real errors. */
  headObject(key: string): Promise<{ size: number; contentType: string | undefined } | null>;
  readFirstBytes(key: string, count: number): Promise<Uint8Array>;
  /** Best effort; failures must not abort the request. */
  deleteObject(key: string): Promise<void>;
  /**
   * Conditional update: UPDATE ... SET status = to [, web_key = ...]
   * WHERE id = $id AND status = $from. Returns true only if a row changed.
   */
  transition(id: string, from: MediaStatus, to: MediaStatus, patch?: { web_key: string }): Promise<boolean>;
  /** Current status, or null if the row is gone. */
  currentStatus(id: string): Promise<MediaStatus | null>;
}

export type CompletionOutcome =
  | { mediaId: string; state: "not_found" }
  | { mediaId: string; state: "not_uploaded" }
  | { mediaId: string; state: "rejected"; reason: Extract<VerifyResult, { ok: false }>["reason"] }
  | { mediaId: string; state: "failed" }
  | { mediaId: string; state: "accepted"; status: MediaStatus };

export async function completeUpload(
  mediaId: string,
  row: CompletionRow | undefined,
  caller: { role: PortalRole; userId: string },
  ports: CompletionPorts
): Promise<CompletionOutcome> {
  // Same answer for "missing" and "not yours": do not reveal other people's ids.
  if (!row || !canManageUpload(caller.role, caller.userId, row.uploaded_by)) {
    return { mediaId, state: "not_found" };
  }

  // Already past `pending`: a retry, or a fast worker got there first.
  if (row.status !== "pending") return settled(mediaId, row.status);

  const head = await ports.headObject(row.original_key);
  if (!head) return { mediaId, state: "not_uploaded" };

  const firstBytes = await ports.readFirstBytes(row.original_key, SNIFF_BYTES);
  const verdict = verifyUpload(
    { mimeType: row.mime_type, sizeBytes: row.size_bytes },
    { size: head.size, contentType: head.contentType, firstBytes }
  );

  if (!verdict.ok) {
    // Only fail the row if it is still pending; never overwrite a newer state.
    const failed = await ports.transition(row.id, "pending", "failed");
    if (failed) {
      await ports.deleteObject(row.original_key).catch(() => undefined);
      return { mediaId, state: "rejected", reason: verdict.reason };
    }
    return resolveRace(mediaId, row.id, ports);
  }

  // Videos are served exactly as uploaded from the public video/ area, so the
  // public file IS the original key. Images get web/thumb variants later.
  const patch = row.kind === "video" ? { web_key: row.original_key } : undefined;
  const advanced = await ports.transition(row.id, "pending", "processing", patch);
  if (!advanced) return resolveRace(mediaId, row.id, ports);

  if (row.kind === "video") {
    // No transcoding step for videos, so they can go live right away.
    // Conditional: if something else already moved it, that is fine too.
    await ports.transition(row.id, "processing", "ready");
    const now = await ports.currentStatus(row.id);
    return { mediaId, state: "accepted", status: now ?? "processing" };
  }

  return { mediaId, state: "accepted", status: "processing" };
}

function settled(mediaId: string, status: MediaStatus): CompletionOutcome {
  if (status === "failed") return { mediaId, state: "failed" };
  return { mediaId, state: "accepted", status };
}

/** Our conditional update changed nothing: someone else moved the row. Report where it is. */
async function resolveRace(
  mediaId: string,
  id: string,
  ports: CompletionPorts
): Promise<CompletionOutcome> {
  const now = await ports.currentStatus(id);
  if (now === null) return { mediaId, state: "not_found" };
  return settled(mediaId, now);
}
