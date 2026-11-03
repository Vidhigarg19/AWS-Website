import test from "node:test";
import assert from "node:assert/strict";
import { checkNewPassword, MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "../../lib/auth/password-policy.ts";

const ctx = { currentPassword: "Temp-Passw0rd-Xk3", email: "piyush.lingwal@gmail.com" };

test("accepts long, unrelated passwords and passphrases (no symbol/digit rule)", () => {
  assert.equal(checkNewPassword("correct horse battery staple", ctx), null);
  assert.equal(checkNewPassword("purple-lantern-ocean-92", ctx), null);
  assert.equal(checkNewPassword("mango-kettle-river-7", ctx), null);
});

test("rejects short passwords and says the number", () => {
  const msg = checkNewPassword("short1A", ctx);
  assert.ok(msg && msg.includes(String(MIN_PASSWORD_LENGTH)));
  assert.equal(checkNewPassword("123456789", ctx) !== null, true);
});

test("rejects more than 72 BYTES (bcrypt ignores the rest), counting multibyte characters", () => {
  assert.equal(checkNewPassword("q7mz".repeat(18), ctx), null); // exactly 72 bytes
  assert.ok(checkNewPassword("q7mz".repeat(18) + "y", ctx));    // 73
  // 25 emoji = 100 bytes but only 25 characters
  assert.ok(checkNewPassword("🔥".repeat(25), ctx)?.includes(String(MAX_PASSWORD_BYTES)));
});

test("rejects whitespace padding, repetition, and reuse of the current password", () => {
  assert.ok(checkNewPassword("   abc       ", ctx));
  assert.ok(checkNewPassword("aaaaaaaaaaaa", ctx));
  assert.ok(checkNewPassword("abababababab", ctx));
  assert.match(checkNewPassword("Temp-Passw0rd-Xk3", ctx)!, /different/);
});

test("rejects passwords containing the email name (any case, any punctuation)", () => {
  assert.match(checkNewPassword("My-Piyush.Lingwal-2026!", ctx)!, /email/);
  assert.equal(checkNewPassword("lingwal-rocks-123", { email: "ab@x.com" }), null); // short local part: not checked
});

test("rejects guessable patterns anywhere in the password", () => {
  for (const p of ["MyPassword12345", "Qwerty-Qwerty-9", "iloveyou-forever", "Tulas-University-1", "Welcome to AWS 2026", "xx-admin-xxxxx-1"]) {
    assert.ok(checkNewPassword(p, ctx), p);
  }
});

test("non-strings are rejected without throwing", () => {
  for (const v of [undefined, null, 12345678901, {}, []]) assert.ok(checkNewPassword(v, ctx));
});
