// ============================================================
// Media status rules — PURE
// ============================================================
//
//   pending ──► processing ──► ready ◄──► hidden
//      │             │
//      └──► failed ◄─┘
//
// The database stores the status; THIS file decides which moves are legal.
// Callers must also use a conditional update
//   UPDATE media_items SET status = $to WHERE id = $id AND status = $from
// so a slow request can never overwrite a newer state (for example `complete`
// finishing after the processing Lambda already marked the row `ready`).
// ============================================================

export const MEDIA_STATUSES = ["pending", "processing", "ready", "hidden", "failed"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

const TRANSITIONS: Readonly<Record<MediaStatus, readonly MediaStatus[]>> = {
  pending: ["processing", "failed"],
  processing: ["ready", "failed"],
  ready: ["hidden"],
  hidden: ["ready"],
  failed: [], // terminal: the cleanup job removes the object and the row
};

export function isMediaStatus(value: unknown): value is MediaStatus {
  return typeof value === "string" && (MEDIA_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: MediaStatus, to: MediaStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Visible on the public site: ready and not soft-deleted. */
export function isPubliclyVisible(status: MediaStatus, deletedAt: string | null): boolean {
  return status === "ready" && deletedAt === null;
}
