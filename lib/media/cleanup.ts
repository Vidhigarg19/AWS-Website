// ============================================================
// Cleanup of abandoned, failed and deleted media — PURE planning + a runner
// over ports (no AWS SDK, no Supabase imports)
// ============================================================
//
// What it removes, and when (all thresholds are constants below):
//
//   pending     > 24 h   the member never finished the upload      -> failed, file deleted
//   processing  > 24 h   processing died and nobody retried        -> failed, file deleted
//   failed      > 7 d    kept briefly so support can look           -> files + row removed
//   soft-deleted> 7 d    takedown grace period                      -> files + row removed
//
// Safety rules (each one is tested in tests/media/cleanup.test.ts):
//   1. FILES FIRST, ROW LAST. If any file could not be deleted, the row stays,
//      so the next run retries. Deleting the row first would orphan the files forever.
//   2. A key is deleted only if it is OURS for THAT row: it must parse as a key
//      we generated, with this row's event id and media id. A corrupted row can
//      therefore never make the job delete someone else's photo.
//   3. Every status change is conditional (WHERE status = expected), so a member
//      finishing an upload at the same moment as the job wins, never loses.
//   4. Every step is idempotent: running twice, or crashing halfway, is safe.
//   5. Bounded: at most `limit` rows per run, so one run cannot time out.
//   6. Dry run reports what WOULD happen and changes nothing.
// ============================================================

import { parseMediaKey } from "./keys.ts";
import type { MediaStatus } from "./status.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const PENDING_MAX_AGE_MS = 24 * HOUR;
export const PROCESSING_MAX_AGE_MS = 24 * HOUR;
export const FAILED_RETENTION_MS = 7 * DAY;
export const DELETED_GRACE_MS = 7 * DAY;
export const DEFAULT_CLEANUP_LIMIT = 200;

export interface CleanupRow {
  id: string;
  event_id: string;
  source: "s3" | "drive";
  status: MediaStatus;
  original_key: string | null;
  web_key: string | null;
  thumb_key: string | null;
  poster_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CleanupAction =
  | "expire_pending"
  | "expire_processing"
  | "purge_deleted"
  | "purge_failed"
  | "keep";

const age = (iso: string | null, now: number): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? -Infinity : now - t; // unparseable date: never old enough (fail safe)
};

export function classify(row: CleanupRow, now: number): CleanupAction {
  // A soft-deleted row is purged after the grace period whatever its status.
  if (row.deleted_at !== null) {
    return age(row.deleted_at, now) >= DELETED_GRACE_MS ? "purge_deleted" : "keep";
  }
  switch (row.status) {
    case "failed":
      return age(row.updated_at, now) >= FAILED_RETENTION_MS ? "purge_failed" : "keep";
    case "pending":
      return age(row.created_at, now) >= PENDING_MAX_AGE_MS ? "expire_pending" : "keep";
    case "processing":
      return age(row.updated_at, now) >= PROCESSING_MAX_AGE_MS ? "expire_processing" : "keep";
    default:
      return "keep"; // ready / hidden are never touched
  }
}

/**
 * The S3 keys that belong to this row and may be deleted. Anything that is not
 * a key we generated for exactly this event + media id is ignored (rule 2).
 * A video's web_key equals its original_key; duplicates are removed.
 */
export function ownedKeys(row: CleanupRow): string[] {
  if (row.source !== "s3") return [];
  const out = new Set<string>();
  for (const key of [row.original_key, row.web_key, row.thumb_key, row.poster_key]) {
    if (!key) continue;
    const parsed = parseMediaKey(key);
    if (parsed && parsed.eventId === row.event_id.toLowerCase() && parsed.mediaId === row.id.toLowerCase()) {
      out.add(key);
    }
  }
  return [...out];
}

/** Keys that were ever public (CloudFront may have cached them). `original/` never is. */
export function publicOwnedKeys(row: CleanupRow): string[] {
  return ownedKeys(row).filter((k) => parseMediaKey(k)?.area !== "original");
}

export interface CleanupPorts {
  /** Rows that MAY be due (a loose query is fine: `classify` decides). Oldest first. */
  listCandidates(limit: number): Promise<CleanupRow[]>;
  /** Conditional: UPDATE ... SET status='failed' WHERE id AND status = from. True if a row changed. */
  markFailed(id: string, from: "pending" | "processing"): Promise<boolean>;
  /** Deletes what exists; a missing object counts as deleted. Reports keys that could NOT be deleted. */
  deleteObjects(keys: string[]): Promise<{ failed: string[] }>;
  /** Conditional hard delete: only if the row is still soft-deleted / still failed. True if removed. */
  deleteRow(id: string, reason: "deleted" | "failed"): Promise<boolean>;
  /** Best effort: ask the CDN to forget these public keys. Never throws into the run. */
  invalidateCdn(keys: string[]): Promise<void>;
}

export interface CleanupReport {
  dryRun: boolean;
  scanned: number;
  expiredPending: number;
  expiredProcessing: number;
  purgedDeleted: number;
  purgedFailed: number;
  filesDeleted: number;
  /** Rows left for the next run because a file could not be deleted. */
  retryLater: number;
  /** Rows whose state changed under us (someone else won the race): skipped. */
  skippedRaces: number;
}

export async function runCleanup(
  ports: CleanupPorts,
  opts: { now: number; dryRun?: boolean; limit?: number }
): Promise<CleanupReport> {
  const dryRun = opts.dryRun === true;
  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_CLEANUP_LIMIT, 1000));
  const rows = await ports.listCandidates(limit);

  const report: CleanupReport = {
    dryRun,
    scanned: rows.length,
    expiredPending: 0,
    expiredProcessing: 0,
    purgedDeleted: 0,
    purgedFailed: 0,
    filesDeleted: 0,
    retryLater: 0,
    skippedRaces: 0,
  };
  const invalidate: string[] = [];

  for (const row of rows.slice(0, limit)) {
    const action = classify(row, opts.now);
    if (action === "keep") continue;
    const keys = ownedKeys(row);

    if (action === "expire_pending" || action === "expire_processing") {
      const from = action === "expire_pending" ? "pending" : "processing";
      if (dryRun) {
        if (from === "pending") report.expiredPending++; else report.expiredProcessing++;
        report.filesDeleted += keys.length;
        continue;
      }
      // Conditional: if the member just finished the upload, we lose the race and do nothing.
      if (!(await ports.markFailed(row.id, from))) {
        report.skippedRaces++;
        continue;
      }
      if (from === "pending") report.expiredPending++; else report.expiredProcessing++;
      // Free the (possibly 500 MB) file now; whatever fails is retried by the purge step later.
      if (keys.length > 0) {
        const res = await ports.deleteObjects(keys);
        report.filesDeleted += keys.length - res.failed.length;
      }
      continue;
    }

    // purge_deleted | purge_failed: files first, row last (rule 1)
    if (dryRun) {
      if (action === "purge_deleted") report.purgedDeleted++; else report.purgedFailed++;
      report.filesDeleted += keys.length;
      continue;
    }
    let failed: string[] = [];
    if (keys.length > 0) {
      failed = (await ports.deleteObjects(keys)).failed;
      report.filesDeleted += keys.length - failed.length;
    }
    if (failed.length > 0) {
      report.retryLater++;
      continue; // keep the row so the next run retries the files
    }
    invalidate.push(...publicOwnedKeys(row));
    const removed = await ports.deleteRow(row.id, action === "purge_deleted" ? "deleted" : "failed");
    if (!removed) {
      report.skippedRaces++;
      continue;
    }
    if (action === "purge_deleted") report.purgedDeleted++; else report.purgedFailed++;
  }

  if (!dryRun && invalidate.length > 0) {
    await ports.invalidateCdn([...new Set(invalidate)]).catch(() => undefined);
  }
  return report;
}
