import test from "node:test";
import assert from "node:assert/strict";
import { planPendingRows } from "../../lib/media/plan.ts";
import { validateInitRequest } from "../../lib/media/validate.ts";
import { parseMediaKey } from "../../lib/media/keys.ts";

const EVENT = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef";
const USER = "99999999-9999-4999-8999-999999999999";

function counter() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

function plan(files: Array<{ type: string; size: number }>, purpose?: string) {
  const v = validateInitRequest({ eventId: EVENT, purpose, files });
  assert.ok(v.ok);
  if (!v.ok) throw new Error("unreachable");
  return planPendingRows(v.value, USER, counter());
}

test("images go to original/, videos to video/, all pending and owned by the caller", () => {
  const rows = plan([
    { type: "image/jpeg", size: 100 },
    { type: "video/mp4", size: 200 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(parseMediaKey(rows[0].row.original_key)?.area, "original");
  assert.equal(parseMediaKey(rows[1].row.original_key)?.area, "video");
  for (const { row } of rows) {
    assert.equal(row.status, "pending");
    assert.equal(row.uploaded_by, USER);
    assert.equal(row.event_id, EVENT);
    assert.equal(row.purpose, "gallery");
  }
  assert.equal(rows[0].row.size_bytes, 100);
  assert.equal(rows[1].row.mime_type, "video/mp4");
});

test("ids and keys are unique per file and the key embeds the row id", () => {
  const rows = plan(Array.from({ length: 5 }, () => ({ type: "image/png", size: 10 })));
  assert.equal(new Set(rows.map((r) => r.row.id)).size, 5);
  assert.equal(new Set(rows.map((r) => r.row.original_key)).size, 5);
  for (const { row } of rows) assert.equal(parseMediaKey(row.original_key)?.mediaId, row.id);
});

test("indexes map back to the request order; purpose is carried over", () => {
  const rows = plan([{ type: "image/webp", size: 10 }], "cover");
  assert.deepEqual(rows.map((r) => r.index), [0]);
  assert.equal(rows[0].row.purpose, "cover");
});
