import test from "node:test";
import assert from "node:assert/strict";
import {
  classify, ownedKeys, publicOwnedKeys, runCleanup,
  PENDING_MAX_AGE_MS, FAILED_RETENTION_MS, DELETED_GRACE_MS, PROCESSING_MAX_AGE_MS,
  type CleanupPorts, type CleanupRow,
} from "../../lib/media/cleanup.ts";

const NOW = Date.parse("2026-10-25T00:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const EV = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function row(over: Partial<CleanupRow> = {}): CleanupRow {
  const id = over.id ?? uid();
  return {
    id, event_id: EV, source: "s3", status: "ready",
    original_key: `events/${EV}/original/${id}.jpg`,
    web_key: `events/${EV}/web/${id}.webp`,
    thumb_key: `events/${EV}/thumb/${id}.webp`,
    poster_key: null,
    created_at: ago(100 * 86400000), updated_at: ago(100 * 86400000), deleted_at: null,
    ...over,
  };
}

test("classify: thresholds, per status, ready/hidden never touched", () => {
  const H = 3600000;
  assert.equal(classify(row({ status: "pending", created_at: ago(PENDING_MAX_AGE_MS - H) }), NOW), "keep");
  assert.equal(classify(row({ status: "pending", created_at: ago(PENDING_MAX_AGE_MS) }), NOW), "expire_pending");
  assert.equal(classify(row({ status: "processing", updated_at: ago(PROCESSING_MAX_AGE_MS - H) }), NOW), "keep");
  assert.equal(classify(row({ status: "processing", updated_at: ago(PROCESSING_MAX_AGE_MS) }), NOW), "expire_processing");
  assert.equal(classify(row({ status: "failed", updated_at: ago(FAILED_RETENTION_MS - H) }), NOW), "keep");
  assert.equal(classify(row({ status: "failed", updated_at: ago(FAILED_RETENTION_MS) }), NOW), "purge_failed");
  for (const status of ["ready", "hidden"] as const) assert.equal(classify(row({ status }), NOW), "keep");
});

test("classify: soft-deleted rows wait out the grace period, whatever their status", () => {
  for (const status of ["ready", "hidden", "pending", "failed"] as const) {
    assert.equal(classify(row({ status, deleted_at: ago(DELETED_GRACE_MS - 1000) }), NOW), "keep", status);
    assert.equal(classify(row({ status, deleted_at: ago(DELETED_GRACE_MS) }), NOW), "purge_deleted", status);
  }
});

test("classify fails SAFE on unparseable dates", () => {
  assert.equal(classify(row({ status: "pending", created_at: "garbage" }), NOW), "keep");
  assert.equal(classify(row({ deleted_at: "garbage" }), NOW), "keep");
});

test("ownedKeys: only our keys for THIS row; foreign, private-traversal and drive rows yield nothing extra", () => {
  const r = row();
  assert.equal(ownedKeys(r).length, 3);
  const other = uid();
  const foreign = row({ web_key: `events/${EV}/web/${other}.webp` });                // another item's file
  assert.ok(!ownedKeys(foreign).includes(`events/${EV}/web/${other}.webp`));
  const otherEvent = row({ thumb_key: `events/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/thumb/${r.id}.webp` });
  assert.ok(!ownedKeys(otherEvent).some((k) => k.includes("bbbbbbbb")));
  assert.deepEqual(ownedKeys(row({ original_key: "../../etc/passwd", web_key: "events/x", thumb_key: "", poster_key: null })), []);
  assert.deepEqual(ownedKeys(row({ source: "drive", original_key: null, web_key: null, thumb_key: null })), []);
});

test("ownedKeys: a video's web_key IS its original_key (deleted once); publicOwnedKeys excludes original/", () => {
  const id = uid();
  const v = row({ id, original_key: `events/${EV}/video/${id}.mp4`, web_key: `events/${EV}/video/${id}.mp4`, thumb_key: null });
  assert.deepEqual(ownedKeys(v), [`events/${EV}/video/${id}.mp4`]);
  const img = row();
  assert.ok(!publicOwnedKeys(img).some((k) => k.includes("/original/")));
  assert.equal(publicOwnedKeys(img).length, 2);
});

/** Fake backend recording every call, with switches for failure and races. */
function fake(rows: CleanupRow[], opts: { failKeys?: string[]; raceMarkFailed?: boolean; raceDeleteRow?: boolean } = {}) {
  const calls: string[] = [];
  const deleted = new Set<string>();
  const removed: string[] = [];
  const failedRows: string[] = [];
  const invalidated: string[] = [];
  const ports: CleanupPorts = {
    async listCandidates() { calls.push("list"); return rows; },
    async markFailed(id, from) { calls.push(`mark:${from}`); if (opts.raceMarkFailed) return false; failedRows.push(id); return true; },
    async deleteObjects(keys) { calls.push("files"); const failed = keys.filter((k) => opts.failKeys?.includes(k)); keys.filter((k) => !failed.includes(k)).forEach((k) => deleted.add(k)); return { failed }; },
    async deleteRow(id) { calls.push("row"); if (opts.raceDeleteRow) return false; removed.push(id); return true; },
    async invalidateCdn(keys) { calls.push("invalidate"); invalidated.push(...keys); },
  };
  return { ports, calls, deleted, removed, failedRows, invalidated };
}

test("expire: pending and processing become failed and their files are freed; fresh and ready rows untouched", async () => {
  const stale = row({ status: "pending", created_at: ago(2 * 86400000) });
  const stuck = row({ status: "processing", updated_at: ago(2 * 86400000) });
  const fresh = row({ status: "pending", created_at: ago(60000) });
  const live = row({ status: "ready" });
  const f = fake([stale, stuck, fresh, live]);
  const r = await runCleanup(f.ports, { now: NOW });
  assert.deepEqual([r.expiredPending, r.expiredProcessing], [1, 1]);
  assert.deepEqual(f.failedRows.sort(), [stale.id, stuck.id].sort());
  assert.ok(ownedKeys(stale).every((k) => f.deleted.has(k)));
  assert.ok(![...f.deleted].some((k) => k.includes(fresh.id) || k.includes(live.id)));
  assert.equal(f.removed.length, 0, "expiring never deletes the row");
});

test("purge: files first, row last; public keys sent to the CDN invalidation", async () => {
  const gone = row({ deleted_at: ago(10 * 86400000) });
  const f = fake([gone]);
  const r = await runCleanup(f.ports, { now: NOW });
  assert.equal(r.purgedDeleted, 1);
  assert.ok(f.calls.indexOf("files") < f.calls.indexOf("row"));
  assert.deepEqual(f.invalidated.sort(), publicOwnedKeys(gone).sort());
  assert.ok(!f.invalidated.some((k) => k.includes("/original/")));
});

test("RULE 1: if a file cannot be deleted the row is KEPT for the next run", async () => {
  const gone = row({ status: "failed", updated_at: ago(30 * 86400000) });
  const f = fake([gone], { failKeys: [gone.thumb_key!] });
  const r = await runCleanup(f.ports, { now: NOW });
  assert.equal(r.retryLater, 1);
  assert.equal(f.removed.length, 0);
  assert.equal(r.purgedFailed, 0);
  assert.ok(!f.calls.includes("invalidate"));
  // next run, storage healthy again: it completes
  const f2 = fake([gone]);
  assert.equal((await runCleanup(f2.ports, { now: NOW })).purgedFailed, 1);
});

test("RULE 2: a corrupted row cannot make the job delete another item's file", async () => {
  const victim = row();
  const evil = row({ deleted_at: ago(10 * 86400000), web_key: victim.web_key, thumb_key: victim.thumb_key, original_key: victim.original_key });
  const f = fake([evil]);
  const r = await runCleanup(f.ports, { now: NOW });
  assert.equal(r.purgedDeleted, 1); // the bad row itself is removed...
  assert.equal(f.deleted.size, 0);  // ...but the victim's files are untouched
  assert.deepEqual(f.invalidated, []);
});

test("RULE 3: losing a race (member finished the upload / row changed) skips cleanly", async () => {
  const stale = row({ status: "pending", created_at: ago(2 * 86400000) });
  const f = fake([stale], { raceMarkFailed: true });
  const r = await runCleanup(f.ports, { now: NOW });
  assert.equal(r.skippedRaces, 1);
  assert.equal(f.deleted.size, 0, "no file deleted when the status change did not happen");
  const gone = row({ deleted_at: ago(10 * 86400000) });
  const g = fake([gone], { raceDeleteRow: true });
  const r2 = await runCleanup(g.ports, { now: NOW });
  assert.equal(r2.skippedRaces, 1);
  assert.equal(r2.purgedDeleted, 0);
});

test("RULE 5: respects the limit", async () => {
  const many = Array.from({ length: 10 }, () => row({ deleted_at: ago(10 * 86400000) }));
  const f = fake(many);
  const r = await runCleanup(f.ports, { now: NOW, limit: 3 });
  assert.equal(r.purgedDeleted, 3);
});

test("RULE 6: a dry run reports the same counts and changes nothing", async () => {
  const rows = [
    row({ status: "pending", created_at: ago(2 * 86400000) }),
    row({ deleted_at: ago(10 * 86400000) }),
    row({ status: "failed", updated_at: ago(30 * 86400000) }),
  ];
  const f = fake(rows);
  const r = await runCleanup(f.ports, { now: NOW, dryRun: true });
  assert.deepEqual([r.expiredPending, r.purgedDeleted, r.purgedFailed, r.dryRun], [1, 1, 1, true]);
  assert.deepEqual(f.calls, ["list"], "no writes of any kind");
});

test("drive rows are purged without touching S3 and not sent to the CDN", async () => {
  const d = row({ source: "drive", original_key: null, web_key: null, thumb_key: null, deleted_at: ago(10 * 86400000) });
  const f = fake([d]);
  const r = await runCleanup(f.ports, { now: NOW });
  assert.equal(r.purgedDeleted, 1);
  assert.ok(!f.calls.includes("files") && !f.calls.includes("invalidate"));
});

test("idempotent: a second pass over what is left does nothing", async () => {
  const rows = [row({ deleted_at: ago(10 * 86400000) }), row({ status: "ready" })];
  const f = fake(rows);
  await runCleanup(f.ports, { now: NOW });
  const f2 = fake(rows.filter((r) => !f.removed.includes(r.id)));
  const r2 = await runCleanup(f2.ports, { now: NOW });
  assert.deepEqual([r2.purgedDeleted, r2.expiredPending, r2.filesDeleted, r2.retryLater], [0, 0, 0, 0]);
});

import { checkCronAuth } from "../../lib/auth/cron-auth.ts";

test("cron auth: disabled without a long secret, 401 on wrong/missing, ok on match", () => {
  const secret = "s".repeat(40);
  assert.equal(checkCronAuth(`Bearer ${secret}`, undefined), "disabled");
  assert.equal(checkCronAuth(`Bearer short`, "short"), "disabled");
  assert.equal(checkCronAuth(null, secret), "unauthorized");
  assert.equal(checkCronAuth("Basic abc", secret), "unauthorized");
  assert.equal(checkCronAuth(`Bearer ${"x".repeat(40)}`, secret), "unauthorized");
  assert.equal(checkCronAuth(`Bearer ${secret}`, secret), "ok");
});
