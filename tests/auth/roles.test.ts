// Run with:  npm test      (Node 22.6+, no extra dependencies)

import test from "node:test";
import assert from "node:assert/strict";
import {
  MEDIA_PORTAL_ROLES,
  SUPER_ADMIN_ONLY,
  isRoleAllowed,
  isUuid,
  resolvePortalRole,
  validateMediaMemberInput,
  validateMediaMemberPatch,
} from "../../lib/auth/roles.ts";

// ---------- role resolution ----------

test("admin_users role wins over media membership", () => {
  assert.equal(resolvePortalRole("super_admin", true), "super_admin");
  assert.equal(resolvePortalRole("admin", true), "admin");
});

test("active media member resolves to media_manager", () => {
  assert.equal(resolvePortalRole(null, true), "media_manager");
  assert.equal(resolvePortalRole(undefined, true), "media_manager");
});

test("inactive, missing or unknown means no role (fails closed)", () => {
  assert.equal(resolvePortalRole(null, false), null);
  assert.equal(resolvePortalRole(null, null), null);
  assert.equal(resolvePortalRole(undefined, undefined), null);
  assert.equal(resolvePortalRole("owner", null), null); // unknown admin role grants nothing
  assert.equal(resolvePortalRole("media_manager", null), null); // media role is never read from admin_users
});

// ---------- permissions matrix ----------

test("media_manager can use the media portal but never super-admin routes", () => {
  assert.equal(isRoleAllowed("media_manager", MEDIA_PORTAL_ROLES), true);
  assert.equal(isRoleAllowed("media_manager", SUPER_ADMIN_ONLY), false);
});

test("only super_admin passes the super-admin-only gate", () => {
  assert.equal(isRoleAllowed("super_admin", SUPER_ADMIN_ONLY), true);
  assert.equal(isRoleAllowed("admin", SUPER_ADMIN_ONLY), false);
  assert.equal(isRoleAllowed(null, SUPER_ADMIN_ONLY), false);
  assert.equal(isRoleAllowed(null, MEDIA_PORTAL_ROLES), false);
});

// ---------- create-member input ----------

test("valid input is trimmed, lower-cased and whitespace-collapsed", () => {
  const r = validateMediaMemberInput({ email: "  Aarav@Example.COM ", displayName: "  Aarav   Sharma " });
  assert.deepEqual(r, { ok: true, value: { email: "aarav@example.com", displayName: "Aarav Sharma" } });
});

test("rejects bad emails", () => {
  for (const email of ["", "no-at", "a@b", "a b@c.com", "x@y.z ".repeat(1) + "a".repeat(260) + "@x.com"]) {
    const r = validateMediaMemberInput({ email, displayName: "Valid Name" });
    assert.equal(r.ok, false, `expected "${email.slice(0, 20)}" to be rejected`);
  }
});

test("rejects bad names", () => {
  for (const displayName of ["", "A", "x".repeat(81), "bad\u0000name", "bell\u0007name", "   "]) {
    const r = validateMediaMemberInput({ email: "a@b.com", displayName });
    assert.equal(r.ok, false);
  }
});

test("newlines and tabs inside a name are collapsed to single spaces", () => {
  const r = validateMediaMemberInput({ email: "a@b.com", displayName: "Line\n\tBreak" });
  assert.deepEqual(r, { ok: true, value: { email: "a@b.com", displayName: "Line Break" } });
});

test("rejects non-object and wrongly typed bodies", () => {
  for (const body of [null, undefined, "x", 5, [], { email: 1, displayName: "Ok Name" }, { email: "a@b.com" }]) {
    assert.equal(validateMediaMemberInput(body).ok, false);
  }
});

// ---------- patch input ----------

test("patch accepts booleans and rejects empty or wrong types", () => {
  assert.deepEqual(validateMediaMemberPatch({ active: false }), { ok: true, value: { active: false } });
  assert.deepEqual(validateMediaMemberPatch({ resetPassword: true }), { ok: true, value: { resetPassword: true } });
  assert.equal(validateMediaMemberPatch({}).ok, false);
  assert.equal(validateMediaMemberPatch({ active: "yes" }).ok, false);
  assert.equal(validateMediaMemberPatch({ resetPassword: 1 }).ok, false);
  assert.equal(validateMediaMemberPatch(null).ok, false);
});

// ---------- ids ----------

test("isUuid only accepts real UUIDs", () => {
  assert.equal(isUuid("3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b; drop table"), false);
  assert.equal(isUuid(""), false);
});
