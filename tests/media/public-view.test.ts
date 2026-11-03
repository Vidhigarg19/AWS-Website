import test from "node:test";
import assert from "node:assert/strict";
import { groupByEvent, pickCover, toPublicView, toPublicViews } from "../../lib/media/public-view.ts";
import type { PublicMediaItem } from "../../lib/media/types.ts";

const CDN = "https://cdn.example.com";
const E1 = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef";
const E2 = "bbcdefab-abcd-4bcd-8bcd-abcdefabcdef";

function row(over: Partial<PublicMediaItem> = {}): PublicMediaItem {
  const id = over.id ?? "fedcbafe-dcba-4cba-8cba-fedcbafedcba";
  return {
    id,
    event_id: E1,
    kind: "image",
    purpose: "gallery",
    width: 800,
    height: 600,
    duration_s: null,
    caption: null,
    source: "s3",
    drive_file_id: null,
    web_key: `events/${E1}/web/${id}.webp`,
    thumb_key: `events/${E1}/thumb/${id}.webp`,
    poster_key: null,
    created_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

test("toPublicView builds URLs and drops a row with no web_key yet", () => {
  const v = toPublicView(row(), CDN);
  assert.ok(v);
  assert.equal(v!.url, `${CDN}/${row().web_key}`);
  assert.equal(v!.thumbUrl, `${CDN}/${row().thumb_key}`);
  assert.equal(v!.posterUrl, undefined);
  assert.equal(toPublicView(row({ web_key: null }), CDN), null);
});

test("video gets a poster url and falls back thumb to the main url", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const v = toPublicView(
    row({ id, kind: "video", thumb_key: null, poster_key: `events/${E1}/poster/${id}.webp`, web_key: `events/${E1}/video/${id}.mp4` }),
    CDN
  );
  assert.ok(v);
  assert.equal(v!.thumbUrl, v!.url); // fallback
  assert.equal(v!.posterUrl, `${CDN}/events/${E1}/poster/${id}.webp`);
});

test("toPublicViews silently drops unrenderable rows instead of throwing", () => {
  const out = toPublicViews([row({ id: "00000000-0000-4000-8000-000000000001" }), row({ web_key: null }), row({ id: "00000000-0000-4000-8000-000000000002" })], CDN);
  assert.equal(out.length, 2);
});

test("pickCover prefers a purpose=cover item, else the first item, else null", () => {
  const gallery = toPublicViews([row({ id: "00000000-0000-4000-8000-000000000003", purpose: "gallery" })], CDN);
  assert.equal(pickCover(gallery)!.purpose, "gallery"); // falls back
  const withCover = toPublicViews(
    [row({ id: "00000000-0000-4000-8000-000000000004", purpose: "gallery" }), row({ id: "00000000-0000-4000-8000-000000000005", purpose: "cover" })],
    CDN
  );
  assert.equal(pickCover(withCover)!.purpose, "cover");
  assert.equal(pickCover([]), null);
});

test("groupByEvent: groups, orders items newest-first, splits off the cover", () => {
  const events = [
    { id: E1, name: "Cloud Day", event_date: "2026-11-01" },
    { id: E2, name: "No Media Event", event_date: "2026-12-01" },
  ];
  const idOld = "00000000-0000-4000-8000-000000000001";
  const idNew = "00000000-0000-4000-8000-000000000002";
  const idCover = "00000000-0000-4000-8000-000000000003";
  const items = toPublicViews(
    [
      row({ id: idOld, event_id: E1, created_at: "2026-10-01T00:00:00Z" }),
      row({ id: idNew, event_id: E1, created_at: "2026-10-05T00:00:00Z" }),
      row({ id: idCover, event_id: E1, purpose: "cover", created_at: "2026-10-03T00:00:00Z" }),
    ],
    CDN
  );
  const groups = groupByEvent(events, items);
  assert.equal(groups.length, 1); // E2 has no media: left out
  assert.equal(groups[0].event.id, E1);
  assert.equal(groups[0].cover?.id, idCover);
  assert.equal(groups[0].items.length, 2); // cover excluded from the grid
  assert.deepEqual(groups[0].items.map((i) => i.id), [idNew, idOld]); // newest first
});

test("groupByEvent: events with media sort newest-dated first, TBA (null date) first of all", () => {
  const E3 = "cbcdefab-abcd-4bcd-8bcd-abcdefabcdef";
  const events = [
    { id: E1, name: "Older", event_date: "2026-09-01" },
    { id: E2, name: "Newer", event_date: "2026-11-01" },
    { id: E3, name: "TBA", event_date: null },
  ];
  const items = toPublicViews(
    [
      row({ id: "00000000-0000-4000-8000-000000000001", event_id: E1 }),
      row({ id: "00000000-0000-4000-8000-000000000002", event_id: E2 }),
      row({ id: "00000000-0000-4000-8000-000000000003", event_id: E3 }),
    ],
    CDN
  );
  const groups = groupByEvent(events, items);
  assert.deepEqual(groups.map((g) => g.event.id), [E3, E2, E1]);
});

test("groupByEvent: an item for an unknown event id is simply never grouped", () => {
  const items = toPublicViews([row({ id: "00000000-0000-4000-8000-000000000001", event_id: "99999999-9999-4999-8999-999999999999" })], CDN);
  assert.deepEqual(groupByEvent([{ id: E1, name: "x", event_date: null }], items), []);
});

const DRIVE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz_-123";
function driveRow(over: Partial<PublicMediaItem> = {}): PublicMediaItem {
  return row({ source: "drive", drive_file_id: DRIVE_ID, web_key: null, thumb_key: null, poster_key: null, ...over });
}

test("a Drive image becomes Drive thumbnail urls, with no CDN needed", () => {
  const v = toPublicView(driveRow(), null);
  assert.ok(v);
  assert.equal(v!.source, "drive");
  assert.equal(v!.url, `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w1600`);
  assert.equal(v!.thumbUrl, `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w480`);
  assert.equal(v!.embedUrl, undefined);
});

test("a Drive video gets an embed player and a still poster", () => {
  const v = toPublicView(driveRow({ kind: "video" }), CDN);
  assert.equal(v!.embedUrl, `https://drive.google.com/file/d/${DRIVE_ID}/preview`);
  assert.equal(v!.posterUrl, v!.url);
});

test("Drive row without an id, or S3 row without a CDN, is dropped", () => {
  assert.equal(toPublicView(driveRow({ drive_file_id: null }), CDN), null);
  assert.equal(toPublicView(row(), null), null);
});

test("a malformed Drive id is dropped, never turned into a url", () => {
  assert.equal(toPublicView(driveRow({ drive_file_id: "x\"><b>" }), CDN), null);
  assert.equal(toPublicViews([driveRow({ drive_file_id: "../etc" })], CDN).length, 0);
});

test("pickCover prefers a still image over a video when there is no cover purpose", () => {
  const items = toPublicViews([driveRow({ id: "00000000-0000-4000-8000-0000000000a1", kind: "video" }), row({ id: "00000000-0000-4000-8000-0000000000a2" })], CDN);
  assert.equal(pickCover(items)!.kind, "image");
});
