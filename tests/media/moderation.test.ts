import test from "node:test";
import assert from "node:assert/strict";
import { planItemPatch, validateItemPatch } from "../../lib/media/moderation.ts";
import { MAX_CAPTION_LENGTH } from "../../lib/media/policy.ts";

test("validate: needs at least one known field", () => {
  assert.equal(validateItemPatch({}).ok, false);
  assert.equal(validateItemPatch(null).ok, false);
  assert.equal(validateItemPatch([]).ok, false);
  assert.equal(validateItemPatch({ foo: 1 }).ok, false);
});

test("validate: caption is trimmed/collapsed, empty clears, bad input rejected", () => {
  const a = validateItemPatch({ caption: "  Keynote   on stage " });
  assert.ok(a.ok);
  if (a.ok) assert.equal(a.value.caption, "Keynote on stage");
  const b = validateItemPatch({ caption: "   " });
  assert.ok(b.ok);
  if (b.ok) assert.equal(b.value.caption, null);
  assert.equal(validateItemPatch({ caption: 5 }).ok, false);
  assert.equal(validateItemPatch({ caption: "x".repeat(MAX_CAPTION_LENGTH + 1) }).ok, false);
  assert.equal(validateItemPatch({ caption: "bad\u0000char" }).ok, false);
});

test("validate: hidden must be a real boolean (not 'false' the string)", () => {
  assert.equal(validateItemPatch({ hidden: "false" }).ok, false);
  assert.equal(validateItemPatch({ hidden: 1 }).ok, false);
  assert.ok(validateItemPatch({ hidden: true }).ok);
  assert.ok(validateItemPatch({ hidden: false }).ok);
});

test("plan: hide a live item, show a hidden item", () => {
  const hide = planItemPatch("ready", { hidden: true });
  assert.deepEqual(hide, { ok: true, update: { status: "hidden" }, expectStatus: "ready" });
  const show = planItemPatch("hidden", { hidden: false });
  assert.deepEqual(show, { ok: true, update: { status: "ready" }, expectStatus: "hidden" });
});

test("plan: hiding twice or showing a live item is a harmless no-op", () => {
  assert.deepEqual(planItemPatch("hidden", { hidden: true }), { ok: true, update: {}, expectStatus: "hidden" });
  assert.deepEqual(planItemPatch("ready", { hidden: false }), { ok: true, update: {}, expectStatus: "ready" });
});

test("plan: cannot hide/show an item that is not live yet", () => {
  assert.equal(planItemPatch("processing", { hidden: true }).ok, false);
  assert.equal(planItemPatch("processing", { hidden: false }).ok, false);
});

test("plan: pending and failed rows are not editable at all", () => {
  for (const s of ["pending", "failed"] as const) {
    assert.equal(planItemPatch(s, { caption: "x" }).ok, false);
    assert.equal(planItemPatch(s, { hidden: true }).ok, false);
  }
});

test("plan: caption can change in any editable state and combines with hide", () => {
  for (const s of ["processing", "ready", "hidden"] as const) {
    const p = planItemPatch(s, { caption: "Hello" });
    assert.ok(p.ok);
    if (p.ok) assert.deepEqual(p.update, { caption: "Hello" });
  }
  const both = planItemPatch("ready", { caption: null, hidden: true });
  assert.deepEqual(both, { ok: true, update: { caption: null, status: "hidden" }, expectStatus: "ready" });
});
