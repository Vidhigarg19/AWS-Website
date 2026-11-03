import test from "node:test";
import assert from "node:assert/strict";
import { MEDIA_STATUSES, canTransition, isMediaStatus, isPubliclyVisible } from "../../lib/media/status.ts";
import { PUBLIC_MEDIA_COLUMNS, PUBLIC_MEDIA_SELECT } from "../../lib/media/types.ts";

test("the happy path is legal, step by step", () => {
  assert.equal(canTransition("pending", "processing"), true);
  assert.equal(canTransition("processing", "ready"), true);
  assert.equal(canTransition("ready", "hidden"), true);
  assert.equal(canTransition("hidden", "ready"), true);
});

test("cannot skip processing or go straight from pending to ready", () => {
  assert.equal(canTransition("pending", "ready"), false);
  assert.equal(canTransition("pending", "hidden"), false);
  assert.equal(canTransition("processing", "hidden"), false);
});

test("failed is terminal and ready never regresses", () => {
  for (const to of MEDIA_STATUSES) assert.equal(canTransition("failed", to), false, `failed -> ${to}`);
  assert.equal(canTransition("ready", "pending"), false);
  assert.equal(canTransition("ready", "processing"), false);
  assert.equal(canTransition("ready", "failed"), false);
});

test("nothing transitions to itself", () => {
  for (const s of MEDIA_STATUSES) assert.equal(canTransition(s, s), false, s);
});

test("isMediaStatus accepts only the five known values", () => {
  for (const s of MEDIA_STATUSES) assert.equal(isMediaStatus(s), true);
  for (const bad of ["published", "", "READY", null, undefined, 1, {}]) assert.equal(isMediaStatus(bad), false);
});

test("public visibility = ready AND not deleted", () => {
  assert.equal(isPubliclyVisible("ready", null), true);
  assert.equal(isPubliclyVisible("ready", "2026-10-18T00:00:00Z"), false);
  for (const s of ["pending", "processing", "hidden", "failed"] as const) {
    assert.equal(isPubliclyVisible(s, null), false, s);
  }
});

test("public queries can never select staff ids or private S3 keys", () => {
  const forbidden = ["uploaded_by", "original_key", "size_bytes", "mime_type", "deleted_at", "status", "updated_at"];
  for (const col of forbidden) {
    assert.equal((PUBLIC_MEDIA_COLUMNS as readonly string[]).includes(col), false, col);
    assert.equal(PUBLIC_MEDIA_SELECT.split(", ").includes(col), false, col);
  }
});
