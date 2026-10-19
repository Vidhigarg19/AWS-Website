// ============================================================
// Plan the database rows for an init request — PURE
// ============================================================
//
// Ids come from an injected generator (crypto.randomUUID in production, a
// counter in tests), so this stays deterministic and testable. Keys are built
// by lib/media/keys.ts only: the client never influences them.
// ============================================================

import { buildUploadKey } from "./keys.ts";
import type { MediaKind, MediaPurpose } from "./policy.ts";
import type { ValidInitRequest } from "./validate.ts";

export interface PendingMediaRow {
  id: string;
  event_id: string;
  uploaded_by: string;
  kind: MediaKind;
  purpose: MediaPurpose;
  mime_type: string;
  size_bytes: number;
  original_key: string;
  status: "pending";
}

export interface PlannedUpload {
  /** Index of the file in the client's request. */
  index: number;
  row: PendingMediaRow;
}

export function planPendingRows(
  request: ValidInitRequest,
  userId: string,
  newId: () => string
): PlannedUpload[] {
  return request.files.map((file) => {
    const id = newId().toLowerCase();
    return {
      index: file.index,
      row: {
        id,
        event_id: request.eventId,
        uploaded_by: userId,
        kind: file.kind,
        purpose: request.purpose,
        mime_type: file.mimeType,
        size_bytes: file.sizeBytes,
        original_key: buildUploadKey(request.eventId, id, file.kind, file.ext),
        status: "pending",
      },
    };
  });
}
