import test from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatEventDate } from "../../lib/media/format.ts";

test("formatEventDate: formats a real date, falls back for null/invalid", () => {
  assert.equal(formatEventDate("2026-11-01"), "1 November 2026");
  assert.equal(formatEventDate(null), "Date to be announced");
  assert.equal(formatEventDate("not-a-date"), "Date to be announced");
  assert.equal(formatEventDate(null, "TBA"), "TBA");
});

test("formatDuration: mm:ss, zero-padded seconds, falls back for unknown", () => {
  assert.equal(formatDuration(5), "0:05");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(600), "10:00");
  assert.equal(formatDuration(null), "Video");
  assert.equal(formatDuration(-1), "Video");
  assert.equal(formatDuration(NaN), "Video");
});
