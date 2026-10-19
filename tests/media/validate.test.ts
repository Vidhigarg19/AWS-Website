import test from "node:test";
import assert from "node:assert/strict";
import { validateCaption, validateInitRequest } from "../../lib/media/validate.ts";
import { IMAGE_MAX_BYTES, MAX_FILES_PER_REQUEST, VIDEO_MAX_BYTES } from "../../lib/media/policy.ts";

const EVENT = "11111111-1111-4111-8111-111111111111";
const jpg = (size = 1000) => ({ name: "a.jpg", type: "image/jpeg", size });

test("accepts a normal gallery upload and derives kind and ext from the MIME type", () => {
  const r = validateInitRequest({
    eventId: EVENT,
    files: [jpg(), { name: "clip.mp4", type: "video/mp4", size: 5_000_000 }],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.purpose, "gallery");
  assert.deepEqual(
    r.value.files.map((f) => [f.index, f.kind, f.ext]),
    [[0, "image", "jpg"], [1, "video", "mp4"]]
  );
});

test("the user's filename is never used for anything", () => {
  const r = validateInitRequest({
    eventId: EVENT,
    files: [{ name: "../../evil.exe", type: "image/png", size: 10 }],
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.files[0].ext, "png");
});

test("rejects bad bodies and bad event ids", () => {
  for (const body of [null, "x", 5, undefined, {}, { eventId: "nope", files: [jpg()] }, { eventId: 7, files: [jpg()] }]) {
    assert.equal(validateInitRequest(body).ok, false);
  }
});

test("rejects empty, non-array and too many files", () => {
  assert.equal(validateInitRequest({ eventId: EVENT, files: [] }).ok, false);
  assert.equal(validateInitRequest({ eventId: EVENT, files: "x" }).ok, false);
  const many = Array.from({ length: MAX_FILES_PER_REQUEST + 1 }, () => jpg());
  assert.equal(validateInitRequest({ eventId: EVENT, files: many }).ok, false);
  const max = Array.from({ length: MAX_FILES_PER_REQUEST }, () => jpg());
  assert.equal(validateInitRequest({ eventId: EVENT, files: max }).ok, true);
});

test("rejects unsupported types, including prototype-key tricks", () => {
  for (const type of ["application/pdf", "image/svg+xml", "image/heic", "video/quicktime", "text/html", "__proto__", "constructor", "toString", ""]) {
    assert.equal(validateInitRequest({ eventId: EVENT, files: [{ name: "x", type, size: 10 }] }).ok, false, type);
  }
  assert.equal(validateInitRequest({ eventId: EVENT, files: [{ name: "x", size: 10 }] }).ok, false);
});

test("enforces size limits per kind and sane sizes", () => {
  const img = (size: unknown) => validateInitRequest({ eventId: EVENT, files: [{ name: "x", type: "image/png", size }] }).ok;
  const vid = (size: unknown) => validateInitRequest({ eventId: EVENT, files: [{ name: "x", type: "video/mp4", size }] }).ok;
  assert.equal(img(IMAGE_MAX_BYTES), true);
  assert.equal(img(IMAGE_MAX_BYTES + 1), false);
  assert.equal(vid(VIDEO_MAX_BYTES), true);
  assert.equal(vid(VIDEO_MAX_BYTES + 1), false);
  for (const bad of [0, -1, 1.5, NaN, Infinity, "100", null, undefined]) {
    assert.equal(img(bad), false, String(bad));
  }
});

test("cover must be exactly one image", () => {
  assert.equal(validateInitRequest({ eventId: EVENT, purpose: "cover", files: [jpg()] }).ok, true);
  assert.equal(validateInitRequest({ eventId: EVENT, purpose: "cover", files: [jpg(), jpg()] }).ok, false);
  assert.equal(
    validateInitRequest({ eventId: EVENT, purpose: "cover", files: [{ name: "v", type: "video/mp4", size: 10 }] }).ok,
    false
  );
  assert.equal(validateInitRequest({ eventId: EVENT, purpose: "banner", files: [jpg()] }).ok, false);
});

test("event id is normalized to lowercase", () => {
  const hex = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef"; // has letters, so uppercasing really changes it
  const r = validateInitRequest({ eventId: hex.toUpperCase(), files: [jpg()] });
  assert.equal(r.ok && r.value.eventId, hex);
});

test("captions: trimmed, collapsed, nullable, length and control-character limits", () => {
  assert.deepEqual(validateCaption("  Great   day  "), { ok: true, value: "Great day" });
  assert.deepEqual(validateCaption("   "), { ok: true, value: null });
  assert.deepEqual(validateCaption(null), { ok: true, value: null });
  assert.equal(validateCaption("x".repeat(280)).ok, true);
  assert.equal(validateCaption("x".repeat(281)).ok, false);
  assert.equal(validateCaption("bad\u0000char").ok, false);
  assert.equal(validateCaption(5).ok, false);
});

import { validateCompleteRequest } from "../../lib/media/validate.ts";

test("complete request: accepts uuids, lowercases and de-duplicates", () => {
  const a = "ABCDEFAB-ABCD-4BCD-8BCD-ABCDEFABCDEF";
  const r = validateCompleteRequest({ mediaIds: [a, a.toLowerCase()] });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value, [a.toLowerCase()]);
});

test("complete request: rejects bad shapes, bad ids, and too many ids", () => {
  assert.equal(validateCompleteRequest(null).ok, false);
  assert.equal(validateCompleteRequest({}).ok, false);
  assert.equal(validateCompleteRequest({ mediaIds: [] }).ok, false);
  assert.equal(validateCompleteRequest({ mediaIds: ["nope"] }).ok, false);
  assert.equal(validateCompleteRequest({ mediaIds: [123] }).ok, false);
  const many = Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  assert.equal(validateCompleteRequest({ mediaIds: many }).ok, false);
});
