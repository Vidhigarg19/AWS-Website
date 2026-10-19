import test from "node:test";
import assert from "node:assert/strict";
import { canManageUpload } from "../../lib/media/access.ts";

test("admins manage any upload, including orphaned ones", () => {
  for (const role of ["super_admin", "admin"] as const) {
    assert.equal(canManageUpload(role, "u1", "u2"), true);
    assert.equal(canManageUpload(role, "u1", null), true);
  }
});

test("media members manage only their own uploads", () => {
  assert.equal(canManageUpload("media_manager", "u1", "u1"), true);
  assert.equal(canManageUpload("media_manager", "u1", "u2"), false);
  assert.equal(canManageUpload("media_manager", "u1", null), false);
});
