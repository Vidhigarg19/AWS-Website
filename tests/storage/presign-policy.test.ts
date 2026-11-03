import test from "node:test";
import assert from "node:assert/strict";
import { buildPostPolicy, IMMUTABLE_CACHE_CONTROL } from "../../lib/storage/presign-policy.ts";
import { buildUploadKey } from "../../lib/media/keys.ts";
import { IMAGE_MAX_BYTES, PRESIGN_TTL_SECONDS, VIDEO_MAX_BYTES } from "../../lib/media/policy.ts";

const EVENT = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef";
const MEDIA = "fedcbafe-dcba-4cba-8cba-fedcbafedcba";
const imgKey = buildUploadKey(EVENT, MEDIA, "image", "jpg");
const vidKey = buildUploadKey(EVENT, MEDIA, "video", "mp4");

test("image policy pins key, type and exact size", () => {
  const p = buildPostPolicy({ bucket: "b", key: imgKey, mimeType: "image/jpeg", sizeBytes: 1234, kind: "image" });
  assert.equal(p.Key, imgKey);
  assert.equal(p.Bucket, "b");
  assert.equal(p.Expires, PRESIGN_TTL_SECONDS);
  assert.deepEqual(p.Conditions, [
    ["content-length-range", 1234, 1234],
    ["eq", "$Content-Type", "image/jpeg"],
  ]);
  assert.equal(p.Fields["Content-Type"], "image/jpeg");
  assert.equal(p.Fields["Cache-Control"], undefined);
});

test("video policy also pins immutable Cache-Control", () => {
  const p = buildPostPolicy({ bucket: "b", key: vidKey, mimeType: "video/mp4", sizeBytes: 5_000_000, kind: "video" });
  assert.equal(p.Fields["Cache-Control"], IMMUTABLE_CACHE_CONTROL);
  assert.deepEqual(p.Conditions.at(-1), ["eq", "$Cache-Control", IMMUTABLE_CACHE_CONTROL]);
});

test("rejects unsupported type, kind mismatch and bad sizes", () => {
  const base = { bucket: "b", key: imgKey, mimeType: "image/jpeg", sizeBytes: 10, kind: "image" as const };
  assert.throws(() => buildPostPolicy({ ...base, mimeType: "image/gif" }));
  assert.throws(() => buildPostPolicy({ ...base, kind: "video" }));
  assert.throws(() => buildPostPolicy({ ...base, sizeBytes: 0 }));
  assert.throws(() => buildPostPolicy({ ...base, sizeBytes: -5 }));
  assert.throws(() => buildPostPolicy({ ...base, sizeBytes: 1.5 }));
  assert.throws(() => buildPostPolicy({ ...base, sizeBytes: IMAGE_MAX_BYTES + 1 }));
  assert.doesNotThrow(() => buildPostPolicy({ ...base, sizeBytes: IMAGE_MAX_BYTES }));
  assert.throws(() =>
    buildPostPolicy({ bucket: "b", key: vidKey, mimeType: "video/mp4", sizeBytes: VIDEO_MAX_BYTES + 1, kind: "video" })
  );
});

test("rejects keys we did not generate or that sit in the wrong area", () => {
  const base = { bucket: "b", mimeType: "image/jpeg", sizeBytes: 10, kind: "image" as const };
  assert.throws(() => buildPostPolicy({ ...base, key: "events/../secret.jpg" }));
  assert.throws(() => buildPostPolicy({ ...base, key: `events/${EVENT}/web/${MEDIA}.jpg` })); // public area
  assert.throws(() => buildPostPolicy({ ...base, key: buildUploadKey(EVENT, MEDIA, "image", "png") })); // ext mismatch
  assert.throws(() => buildPostPolicy({ ...base, key: vidKey })); // video key for image
});
