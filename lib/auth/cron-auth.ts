// ============================================================
// Shared-secret check for scheduled jobs — PURE
// ============================================================
// The cron endpoint sits outside /api/admin and /api/media (nobody is signed
// in when a scheduler calls it), so this secret is its ONLY protection.
//   - disabled entirely if CRON_SECRET is unset or shorter than 32 chars
//   - constant-time comparison (hash both sides: equal length, no early exit)
// ============================================================

import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_CRON_SECRET_LENGTH = 32;

export type CronAuth = "ok" | "unauthorized" | "disabled";

const sha = (s: string) => createHash("sha256").update(s).digest();

export function checkCronAuth(authorization: string | null, secret: string | undefined): CronAuth {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) return "disabled";
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  if (!match) return "unauthorized";
  return timingSafeEqual(sha(match[1]), sha(secret)) ? "ok" : "unauthorized";
}
