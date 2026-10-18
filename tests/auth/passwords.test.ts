import test from "node:test";
import assert from "node:assert/strict";
import { generateTempPassword } from "../../lib/auth/passwords.ts";

test("default password is 16 chars from the unambiguous alphabet", () => {
  const p = generateTempPassword();
  assert.equal(p.length, 16);
  assert.match(p, /^[abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
});

test("always contains a lowercase letter, an uppercase letter and a digit", () => {
  for (let i = 0; i < 500; i++) {
    const p = generateTempPassword();
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /[0-9]/);
  }
});

test("passwords do not repeat", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) seen.add(generateTempPassword());
  assert.equal(seen.size, 2000);
});

test("refuses weak lengths", () => {
  assert.throws(() => generateTempPassword(8));
});
