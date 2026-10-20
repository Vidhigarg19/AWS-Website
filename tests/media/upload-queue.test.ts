import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQueueItem,
  chunkForInit,
  formatBytes,
  pickToStart,
  precheckFile,
  queueReducer,
  summarize,
  type QueueAction,
  type QueueItem,
} from "../../lib/media/upload-queue.ts";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from "../../lib/media/policy.ts";

const jpg = (name = "a.jpg", size = 1000) => ({ name, type: "image/jpeg", size });
const mp4 = (name = "a.mp4", size = 1000) => ({ name, type: "video/mp4", size });

function run(items: QueueItem[], ...actions: QueueAction[]): QueueItem[] {
  return actions.reduce(queueReducer, items);
}
const one = (items: QueueItem[], id: string) => items.find((i) => i.id === id)!;

test("formatBytes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(25 * 1024 * 1024), "25 MB");
  assert.equal(formatBytes(-1), "—");
});

test("precheck: accepts allowed files, rejects the rest with a reason", () => {
  assert.equal(precheckFile(jpg(), "gallery"), null);
  assert.equal(precheckFile(mp4(), "gallery"), null);
  assert.match(precheckFile({ name: "a.jpg", type: "image/jpeg", size: 0 }, "gallery")!, /empty/);
  assert.match(precheckFile({ name: "a.gif", type: "image/gif", size: 5 }, "gallery")!, /Unsupported/);
  assert.match(precheckFile(jpg("a.jpg", IMAGE_MAX_BYTES + 1), "gallery")!, /Too large/);
  assert.equal(precheckFile(jpg("a.jpg", IMAGE_MAX_BYTES), "gallery"), null);
  assert.match(precheckFile(mp4("a.mp4", VIDEO_MAX_BYTES + 1), "gallery")!, /Too large/);
});

test("precheck: iPhone formats get a specific, helpful message", () => {
  assert.match(precheckFile({ name: "IMG_1.HEIC", type: "image/heic", size: 5 }, "gallery")!, /HEIC/);
  assert.match(precheckFile({ name: "clip.MOV", type: "video/quicktime", size: 5 }, "gallery")!, /MOV/);
  // browsers sometimes give an empty type for HEIC: the extension still triggers the hint
  assert.match(precheckFile({ name: "IMG_2.heic", type: "", size: 5 }, "gallery")!, /iPhone/);
});

test("precheck: covers must be images", () => {
  assert.equal(precheckFile(jpg(), "cover"), null);
  assert.match(precheckFile(mp4(), "cover")!, /cover must be an image/);
});

test("a file that fails the pre-check becomes a non-retryable error row", () => {
  const bad = buildQueueItem("x", { name: "a.gif", type: "image/gif", size: 5 }, "gallery");
  assert.equal(bad.state, "error");
  assert.equal(bad.retryable, false);
  const ok = buildQueueItem("y", jpg(), "gallery");
  assert.equal(ok.state, "queued");
  assert.equal(ok.kind, "image");
  assert.equal(buildQueueItem("z", mp4(), "gallery").kind, "video");
});

test("happy path: queued -> signing -> waiting -> uploading -> verifying -> live", () => {
  let s = run([], { type: "add", items: [buildQueueItem("1", jpg(), "gallery")] });
  s = run(s, { type: "signing", ids: ["1"] });
  assert.equal(one(s, "1").state, "signing");
  s = run(s, { type: "signed", id: "1", mediaId: "m1" });
  assert.equal(one(s, "1").state, "waiting");
  s = run(s, { type: "start", id: "1" }, { type: "progress", id: "1", progress: 40.4 });
  assert.equal(one(s, "1").progress, 40);
  s = run(s, { type: "uploaded", id: "1" });
  assert.equal(one(s, "1").state, "verifying");
  assert.equal(one(s, "1").uploaded, true);
  s = run(s, { type: "completed", id: "1", outcome: { state: "accepted", status: "ready" } });
  assert.equal(one(s, "1").state, "live");
});

test("image goes to processing, not live", () => {
  let s = run([buildQueueItem("1", jpg(), "gallery")], { type: "signing", ids: ["1"] }, { type: "signed", id: "1", mediaId: "m" }, { type: "start", id: "1" }, { type: "uploaded", id: "1" });
  s = run(s, { type: "completed", id: "1", outcome: { state: "accepted", status: "processing" } });
  assert.equal(one(s, "1").state, "processing");
});

test("progress is clamped and ignored when not uploading", () => {
  let s = run([buildQueueItem("1", jpg(), "gallery")], { type: "signing", ids: ["1"] }, { type: "signed", id: "1", mediaId: "m" }, { type: "start", id: "1" });
  s = run(s, { type: "progress", id: "1", progress: 250 });
  assert.equal(one(s, "1").progress, 100);
  s = run(s, { type: "progress", id: "1", progress: -5 });
  assert.equal(one(s, "1").progress, 0);
  const queued = [buildQueueItem("2", jpg(), "gallery")];
  assert.equal(run(queued, { type: "progress", id: "2", progress: 50 }), queued); // same reference: nothing changed
});

test("stale events cannot resurrect or corrupt an item", () => {
  const done = run([buildQueueItem("1", jpg(), "gallery")], { type: "signing", ids: ["1"] }, { type: "signed", id: "1", mediaId: "m" }, { type: "start", id: "1" }, { type: "uploaded", id: "1" }, { type: "completed", id: "1", outcome: { state: "accepted", status: "ready" } });
  assert.equal(one(run(done, { type: "progress", id: "1", progress: 10 }), "1").progress, 100);
  assert.equal(one(run(done, { type: "fail", id: "1", message: "late", retryable: true }), "1").state, "live");
  assert.equal(one(run(done, { type: "completed", id: "1", outcome: { state: "failed" } }), "1").state, "live");
});

test("upload failure is retryable and restarts from scratch (new signature)", () => {
  let s = run([buildQueueItem("1", jpg(), "gallery")], { type: "signing", ids: ["1"] }, { type: "signed", id: "1", mediaId: "m" }, { type: "start", id: "1" });
  s = run(s, { type: "fail", id: "1", message: "Network error", retryable: true });
  assert.equal(one(s, "1").state, "error");
  s = run(s, { type: "retry", id: "1" });
  const i = one(s, "1");
  assert.equal(i.state, "queued");
  assert.equal(i.mediaId, undefined);
  assert.equal(i.progress, 0);
});

test("verification failure after a full upload retries ONLY the check", () => {
  let s = run([buildQueueItem("1", jpg(), "gallery")], { type: "signing", ids: ["1"] }, { type: "signed", id: "1", mediaId: "m1" }, { type: "start", id: "1" }, { type: "uploaded", id: "1" });
  s = run(s, { type: "completed", id: "1", outcome: { state: "error" } });
  assert.equal(one(s, "1").state, "error");
  assert.equal(one(s, "1").retryable, true);
  s = run(s, { type: "retry", id: "1" });
  assert.equal(one(s, "1").state, "verifying");
  assert.equal(one(s, "1").mediaId, "m1"); // same server id, no duplicate row
});

test("rejected / failed / not_found are not retryable and have clear messages", () => {
  for (const outcome of [
    { state: "rejected", reason: "content_mismatch" },
    { state: "rejected", reason: "size_mismatch" },
    { state: "failed" },
    { state: "not_found" },
  ] as const) {
    let s = run([buildQueueItem("1", jpg(), "gallery")], { type: "signing", ids: ["1"] }, { type: "signed", id: "1", mediaId: "m" }, { type: "start", id: "1" }, { type: "uploaded", id: "1" });
    s = run(s, { type: "completed", id: "1", outcome });
    assert.equal(one(s, "1").state, "error");
    assert.equal(one(s, "1").retryable, false);
    assert.ok((one(s, "1").error ?? "").length > 10);
    assert.equal(run(s, { type: "retry", id: "1" }), s); // retry is a no-op
  }
  // an unknown rejection reason still produces a message
  let s = run([buildQueueItem("1", jpg(), "gallery")], { type: "signing", ids: ["1"] }, { type: "signed", id: "1", mediaId: "m" }, { type: "start", id: "1" }, { type: "uploaded", id: "1" });
  s = run(s, { type: "completed", id: "1", outcome: { state: "rejected", reason: "something_new" } });
  assert.equal(one(s, "1").error, "This file was rejected.");
});

test("busy items cannot be removed; others can; clearFinished keeps errors and in-flight", () => {
  const mk = (id: string, state: QueueItem["state"]): QueueItem => ({ ...buildQueueItem(id, jpg(), "gallery"), state });
  const items = [mk("q", "queued"), mk("u", "uploading"), mk("v", "verifying"), mk("l", "live"), mk("p", "processing"), mk("e", "error")];
  assert.equal(run(items, { type: "remove", id: "u" }).length, 6);
  assert.equal(run(items, { type: "remove", id: "v" }).length, 6);
  assert.equal(run(items, { type: "remove", id: "q" }).length, 5);
  assert.equal(run(items, { type: "remove", id: "e" }).length, 5);
  assert.deepEqual(run(items, { type: "clearFinished" }).map((i) => i.id), ["q", "u", "v", "e"]);
});

test("pickToStart respects the parallel limit and order", () => {
  const mk = (id: string, state: QueueItem["state"]): QueueItem => ({ ...buildQueueItem(id, jpg(), "gallery"), state });
  const items = [mk("a", "uploading"), mk("b", "waiting"), mk("c", "waiting"), mk("d", "waiting"), mk("e", "queued")];
  assert.deepEqual(pickToStart(items, 3), ["b", "c"]);
  assert.deepEqual(pickToStart(items, 1), []);
  assert.deepEqual(pickToStart([], 3), []);
  const full = [mk("a", "uploading"), mk("b", "uploading"), mk("c", "uploading"), mk("d", "waiting")];
  assert.deepEqual(pickToStart(full), []);
});

test("chunkForInit splits into API-sized groups", () => {
  const ids = Array.from({ length: 45 }, (_, i) => String(i));
  const chunks = chunkForInit(ids);
  assert.deepEqual(chunks.map((c) => c.length), [20, 20, 5]);
  assert.deepEqual(chunkForInit([]), []);
});

test("summarize counts each bucket once", () => {
  const mk = (id: string, state: QueueItem["state"]): QueueItem => ({ ...buildQueueItem(id, jpg(), "gallery"), state });
  const s = summarize([mk("1", "live"), mk("2", "processing"), mk("3", "error"), mk("4", "uploading"), mk("5", "queued")]);
  assert.deepEqual(s, { total: 5, done: 2, failed: 1, inFlight: 2 });
});
