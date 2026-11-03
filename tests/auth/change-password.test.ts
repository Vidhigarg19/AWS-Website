import test from "node:test";
import assert from "node:assert/strict";
import { changePassword, type ChangePasswordPorts } from "../../lib/auth/change-password.ts";

const WHO = { userId: "33333333-3333-4333-8333-333333333333", email: "media@test.dev" };
const GOOD = { currentPassword: "Temp-Passw0rd-Xk3", newPassword: "purple lantern ocean 92" };

function fake(opts: { verify?: boolean; setFails?: boolean; clearFailsTimes?: number; revokeFails?: boolean } = {}) {
  const calls: string[] = [];
  let clearFails = opts.clearFailsTimes ?? 0;
  const ports: ChangePasswordPorts = {
    async verifyCurrent(email, pw, id) { calls.push(`verify:${email}:${pw}:${id}`); return opts.verify ?? true; },
    async setPassword(id, pw) { calls.push("set:" + pw); if (opts.setFails) throw new Error("auth down"); },
    async clearMustChange() { calls.push("clear"); if (clearFails-- > 0) throw new Error("db down"); },
    async revokeOtherSessions() { calls.push("revoke"); if (opts.revokeFails) throw new Error("nope"); },
  };
  return { ports, calls };
}

test("happy path: verify -> set -> clear -> revoke, in that order", async () => {
  const f = fake();
  const r = await changePassword(GOOD, WHO, f.ports);
  assert.deepEqual(r, { ok: true, flagCleared: true, otherSessionsRevoked: true });
  assert.deepEqual(f.calls, [`verify:media@test.dev:${GOOD.currentPassword}:${WHO.userId}`, `set:${GOOD.newPassword}`, "clear", "revoke"]);
});

test("wrong current password: nothing is changed", async () => {
  const f = fake({ verify: false });
  const r = await changePassword(GOOD, WHO, f.ports);
  assert.deepEqual(r, { ok: false, code: "wrong_current", error: "Your current password is not correct." });
  assert.equal(f.calls.length, 1);
});

test("weak or unchanged new password is refused BEFORE any network call", async () => {
  for (const newPassword of ["short", GOOD.currentPassword, "media-media-media-1"]) {
    const f = fake();
    const r = await changePassword({ currentPassword: GOOD.currentPassword, newPassword }, WHO, f.ports);
    assert.ok(!r.ok && r.code === "weak_password", newPassword);
    assert.deepEqual(f.calls, []);
  }
});

test("bad bodies are refused without touching anything", async () => {
  for (const body of [null, "x", {}, { currentPassword: "", newPassword: "purple lantern ocean 92" }, { currentPassword: "a", newPassword: 5 }, { currentPassword: "a".repeat(2000), newPassword: "purple lantern ocean 92" }]) {
    const f = fake();
    const r = await changePassword(body, WHO, f.ports);
    assert.ok(!r.ok && r.code === "invalid_input");
    assert.deepEqual(f.calls, []);
  }
  assert.ok(!(await changePassword(GOOD, { ...WHO, email: null }, fake().ports)).ok);
});

test("if setting the password fails: error propagates, flag and sessions untouched", async () => {
  const f = fake({ setFails: true });
  await assert.rejects(changePassword(GOOD, WHO, f.ports), /auth down/);
  assert.ok(!f.calls.includes("clear") && !f.calls.includes("revoke"));
});

test("flag clear is retried once; two failures are reported, not hidden", async () => {
  const once = await changePassword(GOOD, WHO, fake({ clearFailsTimes: 1 }).ports);
  assert.ok(once.ok && once.flagCleared);
  const twice = fake({ clearFailsTimes: 5 });
  const r = await changePassword(GOOD, WHO, twice.ports);
  assert.ok(r.ok && !r.flagCleared);
  assert.equal(twice.calls.filter((c) => c === "clear").length, 2);
});

test("failing to sign out other sessions does not undo the change", async () => {
  const r = await changePassword(GOOD, WHO, fake({ revokeFails: true }).ports);
  assert.deepEqual(r, { ok: true, flagCleared: true, otherSessionsRevoked: false });
});
