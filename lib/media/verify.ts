// ============================================================
// Is the stored object really what the client said it was? — PURE
// ============================================================
//
// S3 already enforced the declared size and Content-Type through the
// presigned POST policy. We check again from what S3 actually stored
// (defense in depth: a policy bug or a manual upload must not slip through),
// and we sniff the first bytes because Content-Type is just a label the
// browser chose.
// ============================================================

import { matchesDeclaredType } from "./sniff.ts";

export interface StoredObjectFacts {
  /** From HeadObject. */
  size: number;
  contentType: string | undefined;
  /** First bytes of the object (Range read). */
  firstBytes: Uint8Array;
}

export interface DeclaredUpload {
  mimeType: string;
  sizeBytes: number;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "size_mismatch" | "type_mismatch" | "content_mismatch" };

export function verifyUpload(declared: DeclaredUpload, stored: StoredObjectFacts): VerifyResult {
  if (stored.size !== declared.sizeBytes) return { ok: false, reason: "size_mismatch" };
  if (stored.contentType !== declared.mimeType) return { ok: false, reason: "type_mismatch" };
  if (!matchesDeclaredType(declared.mimeType, stored.firstBytes)) {
    return { ok: false, reason: "content_mismatch" };
  }
  return { ok: true };
}
