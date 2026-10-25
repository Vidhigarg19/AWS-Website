import test from "node:test";
import assert from "node:assert/strict";
import { buildHealth, type HealthCounts } from "../../lib/media/health.ts";

const zero: HealthCounts = { pending: 0, processing: 0, failed: 0, stalePending: 0, stuckProcessing: 0, softDeleted: 0, oldestPendingAt: null };
const good = { S3_BUCKET: "aws-sbg-media", S3_REGION: "ap-south-1", MEDIA_CDN_URL: "https://d1.cloudfront.net", CRON_SECRET: "c".repeat(40), MEDIA_CDN_DISTRIBUTION_ID: "E123", GOOGLE_DRIVE_API_KEY: "k" };

test("healthy setup has no warnings", () => {
  const h = buildHealth(good, zero);
  assert.deepEqual(h.warnings, []);
  assert.deepEqual(h.config, { storage: { ok: true }, driveKeySet: true, cronEnabled: true, cdnInvalidationEnabled: true });
});

test("missing config produces warnings, and secrets are never echoed", () => {
  const h = buildHealth({ CRON_SECRET: "short-secret-value" }, { ...zero, stalePending: 2 });
  assert.ok(h.warnings.some((w) => w.includes("S3_BUCKET")));
  assert.ok(h.warnings.some((w) => w.includes("CRON_SECRET")));
  assert.ok(h.warnings.some((w) => w.includes("stale pending")));
  assert.ok(!JSON.stringify(h).includes("short-secret-value"));
  assert.equal(h.config.cronEnabled, false);
});
