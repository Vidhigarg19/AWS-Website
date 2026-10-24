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
// Images are processed right here (inside this call): the original is read,
// the public WebP versions are written, and the row goes processing -> ready.
// A video needs no processing and goes live as uploaded. If the process dies
// halfway, the row stays `processing` and the next complete call finishes it
// (the steps are idempotent: same keys, same bytes).
//
// Idempotent: calling complete twice (client retry, double click) is safe.
// ============================================================

import { canManageUpload } from "./access.ts";
import type { MediaKind } from "./policy.ts";
import { SNIFF_BYTES } from "./policy.ts";
import type { MediaStatus } from "./status.ts";
import { verifyUpload, type VerifyResult } from "./verify.ts";
import type { PortalRole } from "../auth/roles.ts";
import { buildVariantKeys } from "./keys.ts";

export interface CompletionRow {
  id: string;
  event_id: string;
  uploaded_by: string | null;
  kind: MediaKind;
  mime_type: string;
  size_bytes: number;
  original_key: string;
  status: MediaStatus;
}

/** Columns the processing step may set on the way to `ready`. */
export interface MediaPatch {
  web_key?: string;
  thumb_key?: string;
  width?: number;
  height?: number;
}

/** Output of the image processor (see lib/media/process-image.ts). */
export interface ProcessedImageData {
  web: Uint8Array;
  thumb: Uint8Array;
  width: number;
  height: number;
}

export class UnreadableImage extends Error {}

export interface CompletionPorts {
  /** null when the object does not exist (yet). Throw for real errors. */
  headObject(key: string): Promise<{ size: number; contentType: string | undefined } | null>;
  readFirstBytes(key: string, count: number): Promise<Uint8Array>;
  /** The whole object. Only used for images (size-capped by the upload policy). */
  readObject(key: string): Promise<Uint8Array>;
  /** Public variants are immutable: written once under a key that never changes. */
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Throws UnreadableImage when the bytes are not a decodable image. */
  processImage(original: Uint8Array): Promise<ProcessedImageData>;
  /** Best effort; failures must not abort the request. */
  deleteObject(key: string): Promise<void>;
  /**
   * Conditional update: UPDATE ... SET status = to [, web_key = ...]
   * WHERE id = $id AND status = $from. Returns true only if a row changed.
   */
  transition(id: string, from: MediaStatus, to: MediaStatus, patch?: MediaPatch): Promise<boolean>;
  /** Current status, or null if the row is gone. */
  currentStatus(id: string): Promise<MediaStatus | null>;
}

export type CompletionOutcome =
  | { mediaId: string; state: "not_found" }
  | { mediaId: string; state: "not_uploaded" }
  | { mediaId: string; state: "rejected"; reason: Extract<VerifyResult, { ok: false }>["reason"] | "unreadable_image" }
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

  // An image left in `processing` (the process died, or the client retried):
  // finish it. Safe to run twice; the final transition is conditional.
  if (row.status === "processing" && row.kind === "image") return finishImage(mediaId, row, ports);

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
  // public file IS the original key. Images get their variants in finishImage below.
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

  return finishImage(mediaId, row, ports);
}

/** Read the original, write web + thumb, mark ready. The row is already `processing`. */
async function finishImage(
  mediaId: string,
  row: CompletionRow,
  ports: CompletionPorts
): Promise<CompletionOutcome> {
  let processed: ProcessedImageData;
  try {
    processed = await ports.processImage(await ports.readObject(row.original_key));
  } catch (err) {
    if (!(err instanceof UnreadableImage)) throw err; // infrastructure problem: leave `processing`, retryable
    // Passed the type check but cannot be decoded: corrupt or hostile. Fail it for good.
    const failed = await ports.transition(row.id, "processing", "failed");
    if (failed) {
      await ports.deleteObject(row.original_key).catch(() => undefined);
      return { mediaId, state: "rejected", reason: "unreadable_image" };
    }
    return resolveRace(mediaId, row.id, ports);
  }

  const keys = buildVariantKeys(row.event_id, row.id);
  await Promise.all([
    ports.putObject(keys.web, processed.web, "image/webp"),
    ports.putObject(keys.thumb, processed.thumb, "image/webp"),
  ]);

  const live = await ports.transition(row.id, "processing", "ready", {
    web_key: keys.web,
    thumb_key: keys.thumb,
    width: processed.width,
    height: processed.height,
  });
  if (!live) return resolveRace(mediaId, row.id, ports);
  return { mediaId, state: "accepted", status: "ready" };
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
