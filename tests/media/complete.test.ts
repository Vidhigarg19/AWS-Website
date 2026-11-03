import test from "node:test";
import assert from "node:assert/strict";
import { completeUpload, UnreadableImage, type CompletionPorts, type CompletionRow, type MediaPatch } from "../../lib/media/complete.ts";
import type { MediaStatus } from "../../lib/media/status.ts";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const EVENT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]); // ....ftypisom

function imageRow(over: Partial<CompletionRow> = {}): CompletionRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    event_id: EVENT,
    uploaded_by: ME,
    kind: "image",
    mime_type: "image/jpeg",
    size_bytes: 5000,
    original_key: "events/e/original/m.jpg",
    status: "pending",
    ...over,
  };
}

/** In-memory fake of S3 + the media_items row, recording every call. */
function fake(opts: {
  object?: { size: number; contentType: string | undefined; bytes: Uint8Array } | null;
  status?: MediaStatus;
  /** Simulates another worker moving the row just before our update. */
  raceTo?: MediaStatus;
  /** How the image processor behaves. Default: succeeds. */
  processor?: "ok" | "unreadable" | "infra_error";
  /** Make the worker lose the race only at the final processing -> ready step. */
  raceAtReady?: MediaStatus;
}) {
  let status: MediaStatus | null = opts.status ?? "pending";
  const calls: string[] = [];
  const patches: Array<MediaPatch | undefined> = [];
  const puts: Array<{ key: string; type: string; bytes: number }> = [];
  const ports: CompletionPorts = {
    async headObject() {
      calls.push("head");
      return opts.object ? { size: opts.object.size, contentType: opts.object.contentType } : null;
    },
    async readFirstBytes() {
      calls.push("read");
      return opts.object!.bytes;
    },
    async readObject() {
      calls.push("readObject");
      return new Uint8Array([9, 9, 9]);
    },
    async putObject(key, body, type) {
      calls.push("put");
      puts.push({ key, type, bytes: body.length });
    },
    async processImage() {
      calls.push("process");
      if (opts.processor === "unreadable") throw new UnreadableImage("bad");
      if (opts.processor === "infra_error") throw new Error("S3 exploded");
      return { web: new Uint8Array(10), thumb: new Uint8Array(4), width: 1920, height: 1080 };
    },
    async deleteObject() {
      calls.push("delete");
    },
    async transition(_id, from, to, patch) {
      calls.push(`${from}->${to}`);
      if (opts.raceTo && calls.filter((c) => c.includes("->")).length === 1) {
        status = opts.raceTo; // someone else got there first
      }
      if (opts.raceAtReady && to === "ready") status = opts.raceAtReady;
      if (status !== from) return false;
      status = to;
      patches.push(patch);
      return true;
    },
    async currentStatus() {
      calls.push("status");
      return status;
    },
  };
  return { ports, calls, patches, puts, get status() { return status; } };
}

const asMe = { role: "media_manager" as const, userId: ME };

test("valid image: processed in the same call, written under server keys, goes ready", async () => {
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: JPEG } });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "accepted", status: "ready" });
  assert.equal(f.status, "ready");
  assert.ok(!f.calls.includes("delete"), "the private original is kept");
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  assert.deepEqual(f.puts.map((p) => p.key).sort(), [`events/${EVENT}/thumb/${id}.webp`, `events/${EVENT}/web/${id}.webp`]);
  assert.ok(f.puts.every((p) => p.type === "image/webp"));
  const last = f.patches[f.patches.length - 1];
  assert.deepEqual(last, { web_key: `events/${EVENT}/web/${id}.webp`, thumb_key: `events/${EVENT}/thumb/${id}.webp`, width: 1920, height: 1080 });
  // order: files are written BEFORE the row can go public
  assert.ok(f.calls.lastIndexOf("put") < f.calls.indexOf("processing->ready"));
});

test("undecodable image: failed for good, original deleted, nothing published", async () => {
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: JPEG }, processor: "unreadable" });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "rejected", reason: "unreadable_image" });
  assert.equal(f.status, "failed");
  assert.ok(f.calls.includes("delete"));
  assert.equal(f.puts.length, 0);
});

test("infrastructure error while processing: row stays `processing` so a retry can finish it", async () => {
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: JPEG }, processor: "infra_error" });
  await assert.rejects(completeUpload("m", imageRow(), asMe, f.ports), /S3 exploded/);
  assert.equal(f.status, "processing");
  assert.ok(!f.calls.includes("delete"));
});

test("retry of a stuck `processing` image finishes it", async () => {
  const f = fake({ status: "processing" });
  const r = await completeUpload("m", imageRow({ status: "processing" }), asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "accepted", status: "ready" });
  assert.ok(!f.calls.includes("head"), "already verified; not checked again");
});

test("race at the final step: another worker wins, we report its state and never overwrite it", async () => {
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: JPEG }, raceAtReady: "hidden" });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "accepted", status: "hidden" });
  assert.equal(f.status, "hidden");
});

test("valid video: goes live, and the public file is the original key", async () => {
  const row = imageRow({ kind: "video", mime_type: "video/mp4", original_key: "events/e/video/m.mp4" });
  const f = fake({ object: { size: 5000, contentType: "video/mp4", bytes: MP4 } });
  const r = await completeUpload("m", row, asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "accepted", status: "ready" });
  assert.equal(f.patches[0]?.web_key, "events/e/video/m.mp4");
  assert.equal(f.status, "ready");
});

test("file not in S3 yet: report not_uploaded, change nothing", async () => {
  const f = fake({ object: null });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.equal(r.state, "not_uploaded");
  assert.equal(f.status, "pending");
  assert.deepEqual(f.calls, ["head"]);
});

test("wrong bytes: row failed, object deleted", async () => {
  const html = new TextEncoder().encode("<html>not a jpeg at all");
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: html } });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "rejected", reason: "content_mismatch" });
  assert.equal(f.status, "failed");
  assert.ok(f.calls.includes("delete"));
});

test("wrong size: rejected as size_mismatch", async () => {
  const f = fake({ object: { size: 4000, contentType: "image/jpeg", bytes: JPEG } });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "rejected", reason: "size_mismatch" });
});

test("someone else's upload looks exactly like a missing one", async () => {
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: JPEG } });
  const r = await completeUpload("m", imageRow({ uploaded_by: OTHER }), asMe, f.ports);
  assert.equal(r.state, "not_found");
  assert.deepEqual(f.calls, []); // no S3 access, no writes
  assert.equal((await completeUpload("m", undefined, asMe, f.ports)).state, "not_found");
});

test("an admin may complete a member's upload", async () => {
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: JPEG } });
  const r = await completeUpload("m", imageRow({ uploaded_by: OTHER }), { role: "admin", userId: ME }, f.ports);
  assert.equal(r.state, "accepted");
});

test("retry is idempotent: already ready/hidden (or a processing video) is a success, no S3 calls", async () => {
  const v = fake({ status: "processing" });
  assert.equal((await completeUpload("m", imageRow({ kind: "video", status: "processing" }), asMe, v.ports)).state, "accepted");
  assert.deepEqual(v.calls, []);
  for (const status of ["ready", "hidden"] as const) {
    const f = fake({ status });
    const r = await completeUpload("m", imageRow({ status }), asMe, f.ports);
    assert.deepEqual(r, { mediaId: "m", state: "accepted", status });
    assert.deepEqual(f.calls, []);
  }
  const f = fake({ status: "failed" });
  assert.equal((await completeUpload("m", imageRow({ status: "failed" }), asMe, f.ports)).state, "failed");
});

test("race: a worker already marked it ready, so our update is skipped and we report ready", async () => {
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: JPEG }, raceTo: "ready" });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.deepEqual(r, { mediaId: "m", state: "accepted", status: "ready" });
  assert.equal(f.status, "ready"); // we did not overwrite it
});

test("race on the failure path never overwrites a newer state or deletes the file", async () => {
  const html = new TextEncoder().encode("<html>not a jpeg at all");
  const f = fake({ object: { size: 5000, contentType: "image/jpeg", bytes: html }, raceTo: "processing" });
  const r = await completeUpload("m", imageRow(), asMe, f.ports);
  assert.equal(r.state, "accepted");
  assert.equal(f.status, "processing");
  assert.ok(!f.calls.includes("delete"));
});
