// ============================================================
// Media health summary — PURE (config booleans + queue numbers, never secrets)
// ============================================================

import { parseStorageConfig } from "../storage/config.ts";
import { MIN_CRON_SECRET_LENGTH } from "../auth/cron-auth.ts";

export interface HealthCounts {
  pending: number;
  processing: number;
  failed: number;
  /** pending older than the cleanup threshold: uploads that never finished. */
  stalePending: number;
  stuckProcessing: number;
  softDeleted: number;
  oldestPendingAt: string | null;
}

export interface MediaHealth {
  config: {
    storage: { ok: boolean; problem?: string };
    driveKeySet: boolean;
    cronEnabled: boolean;
    cdnInvalidationEnabled: boolean;
  };
  counts: HealthCounts;
  warnings: string[];
}

export function buildHealth(env: Record<string, string | undefined>, counts: HealthCounts): MediaHealth {
  const storage = parseStorageConfig(env);
  const cronEnabled = (env.CRON_SECRET?.length ?? 0) >= MIN_CRON_SECRET_LENGTH;
  const cdnInvalidationEnabled = Boolean(env.MEDIA_CDN_DISTRIBUTION_ID?.trim());
  const warnings: string[] = [];
  if (!storage.ok) warnings.push(storage.error);
  if (!cronEnabled) warnings.push("CRON_SECRET is missing or shorter than 32 characters: scheduled cleanup is OFF.");
  if (!cdnInvalidationEnabled) warnings.push("MEDIA_CDN_DISTRIBUTION_ID is not set: purged files can stay cached on the CDN.");
  if (counts.stalePending > 0 || counts.stuckProcessing > 0) {
    warnings.push(`${counts.stalePending} stale pending and ${counts.stuckProcessing} stuck processing item(s): cleanup has not run (or is failing).`);
  }
  return {
    config: {
      storage: storage.ok ? { ok: true } : { ok: false, problem: storage.error },
      driveKeySet: Boolean(env.GOOGLE_DRIVE_API_KEY?.trim()),
      cronEnabled,
      cdnInvalidationEnabled,
    },
    counts,
    warnings,
  };
}
