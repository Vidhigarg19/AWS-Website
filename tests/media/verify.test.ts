import test from "node:test";
import assert from "node:assert/strict";
import { verifyUpload } from "../../lib/media/verify.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const declared = { mimeType: "image/jpeg", sizeBytes: 5000 };
const good = { size: 5000, contentType: "image/jpeg", firstBytes: JPEG };

test("accepts an object that matches what was declared", () => {
  assert.deepEqual(verifyUpload(declared, good), { ok: true });
});

test("rejects a different size", () => {
  assert.deepEqual(verifyUpload(declared, { ...good, size: 4999 }), { ok: false, reason: "size_mismatch" });
});

test("rejects a different stored Content-Type, including a missing one", () => {
  assert.deepEqual(verifyUpload(declared, { ...good, contentType: "image/png" }), { ok: false, reason: "type_mismatch" });
  assert.deepEqual(verifyUpload(declared, { ...good, contentType: undefined }), { ok: false, reason: "type_mismatch" });
});

test("rejects a file whose bytes are not the declared type (HTML labelled as JPEG)", () => {
  const html = new TextEncoder().encode("<html><script>alert(1)</script>");
  assert.deepEqual(verifyUpload(declared, { ...good, firstBytes: html }), { ok: false, reason: "content_mismatch" });
});

test("rejects a PNG labelled as JPEG", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.deepEqual(verifyUpload(declared, { ...good, firstBytes: png }), { ok: false, reason: "content_mismatch" });
});
