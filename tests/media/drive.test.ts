import test from "node:test";
import assert from "node:assert/strict";
import {
  driveKind, drivePreviewUrl, driveThumbUrl, isDriveUrl, parseDriveLink, planDriveImport,
  MAX_DRIVE_FILES_PER_IMPORT, type DriveFile,
} from "../../lib/media/drive.ts";
import { listDriveFiles, type FetchLike } from "../../lib/media/drive-api.ts";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz_-123";
const EVENT = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef";
const USER = "33333333-3333-4333-8333-333333333333";

test("parseDriveLink accepts the usual folder and file link shapes", () => {
  const folder = (u: string) => parseDriveLink(u);
  for (const u of [
    `https://drive.google.com/drive/folders/${ID}`,
    `https://drive.google.com/drive/folders/${ID}?usp=sharing`,
    `https://drive.google.com/drive/u/2/folders/${ID}`,
  ]) assert.deepEqual(folder(u), { ok: true, value: { kind: "folder", id: ID } }, u);
  for (const u of [
    `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?id=${ID}&export=download`,
  ]) assert.deepEqual(folder(u), { ok: true, value: { kind: "file", id: ID } }, u);
});

test("parseDriveLink rejects other hosts, schemes, junk and bad ids", () => {
  for (const u of [
    `http://drive.google.com/drive/folders/${ID}`,
    `https://evil.com/drive/folders/${ID}`,
    `https://drive.google.com.evil.com/drive/folders/${ID}`,
    `https://drive.google.com/drive/folders/short`,
    `https://drive.google.com/drive/folders/${ID}%2F..%2Fx`.replace(ID, "a b"),
    `javascript:alert(1)`, "not a url", "", " ",
  ]) assert.equal(parseDriveLink(u).ok, false, u);
  assert.equal(parseDriveLink(undefined).ok, false);
  assert.equal(parseDriveLink("https://drive.google.com/" + "a".repeat(3000)).ok, false);
});

test("driveKind: only images and videos (HEIC/MOV included, docs and folders not)", () => {
  assert.equal(driveKind("image/heic"), "image");
  assert.equal(driveKind("video/quicktime"), "video");
  assert.equal(driveKind("application/pdf"), null);
  assert.equal(driveKind("application/vnd.google-apps.folder"), null);
});

const f = (over: Partial<DriveFile> = {}): DriveFile => ({ id: ID, mimeType: "image/jpeg", size: "2048", ...over });

test("planDriveImport maps metadata and skips duplicates / unsupported", () => {
  const ID2 = ID.replace("1", "2"), ID3 = ID.replace("1", "3"), ID4 = ID.replace("1", "4");
  const plan = planDriveImport(
    [
      f(),
      f({ id: ID2, mimeType: "video/mp4", size: "9999", videoMediaMetadata: { width: 1920, height: 1080, durationMillis: "12500" } }),
      f({ id: ID3, mimeType: "application/pdf" }),
      f({ id: ID }), // duplicate within the batch
      f({ id: ID4 }), // already linked
      f({ id: "bad id!" }),
    ],
    new Set([ID4]),
    EVENT,
    USER
  );
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.duplicates, 2);
  assert.equal(plan.unsupported, 2);
  const v = plan.rows[1];
  assert.equal(v.kind, "video");
  assert.equal(v.duration_s, 12.5);
  assert.equal(v.width, 1920);
  assert.equal(v.status, "ready");
  assert.equal(plan.rows[0].size_bytes, 2048);
  assert.equal(plan.rows[0].uploaded_by, USER);
});

test("planDriveImport caps one import and reports the overflow", () => {
  const many = Array.from({ length: MAX_DRIVE_FILES_PER_IMPORT + 5 }, (_, i) => f({ id: `file${String(i).padStart(10, "0")}` }));
  const plan = planDriveImport(many, new Set(), EVENT, USER);
  assert.equal(plan.rows.length, MAX_DRIVE_FILES_PER_IMPORT);
  assert.equal(plan.overLimit, 5);
});

test("url builders only accept valid ids and clamp thumbnail width", () => {
  assert.equal(driveThumbUrl(ID, 400), `https://drive.google.com/thumbnail?id=${ID}&sz=w400`);
  assert.ok(driveThumbUrl(ID, 99999).endsWith("sz=w2000"));
  assert.equal(drivePreviewUrl(ID), `https://drive.google.com/file/d/${ID}/preview`);
  assert.throws(() => driveThumbUrl("x\"><script>", 400));
  assert.throws(() => drivePreviewUrl("../etc"));
  assert.equal(isDriveUrl(driveThumbUrl(ID, 100)), true);
  assert.equal(isDriveUrl("https://drive.google.com.evil.com/x"), false);
});

function fakeFetch(handler: (url: string) => { status: number; body?: unknown }): { fn: FetchLike; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    fn: async (url) => {
      urls.push(url);
      const r = handler(url);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    },
  };
}

test("listDriveFiles pages through a folder and only calls the Drive API host", async () => {
  const { fn, urls } = fakeFetch((u) =>
    u.includes("pageToken=p2")
      ? { status: 200, body: { files: [f({ id: "page2file0001" })] } }
      : { status: 200, body: { files: [f()], nextPageToken: "p2" } }
  );
  const r = await listDriveFiles({ kind: "folder", id: ID }, "KEY", fn);
  assert.ok(r.ok && r.files.length === 2 && !r.truncated);
  assert.ok(urls.every((u) => u.startsWith("https://www.googleapis.com/drive/v3/files")));
  assert.ok(urls[0].includes(encodeURIComponent(`'${ID}' in parents`)));
});

test("listDriveFiles: a file link that is really a folder is listed as a folder", async () => {
  const { fn } = fakeFetch((u) =>
    u.includes("/files/" + ID)
      ? { status: 200, body: { id: ID, mimeType: "application/vnd.google-apps.folder" } }
      : { status: 200, body: { files: [f({ id: "inside00001" })] } }
  );
  const r = await listDriveFiles({ kind: "file", id: ID }, "KEY", fn);
  assert.ok(r.ok && r.files[0].id === "inside00001");
});

test("listDriveFiles maps Drive errors to clear messages", async () => {
  const run = async (status: number) => listDriveFiles({ kind: "folder", id: ID }, "KEY", fakeFetch(() => ({ status })).fn);
  const nf = await run(404); assert.ok(!nf.ok && nf.status === 404);
  const forbidden = await run(403); assert.ok(!forbidden.ok && forbidden.status === 400 && /Anyone with the link/.test(forbidden.error));
  const down = await run(500); assert.ok(!down.ok && down.status === 502);
  const boom = await listDriveFiles({ kind: "folder", id: ID }, "KEY", async () => { throw new Error("net"); });
  assert.ok(!boom.ok && boom.status === 502);
  assert.equal((await listDriveFiles({ kind: "folder", id: "bad" }, "KEY", fakeFetch(() => ({ status: 200 })).fn)).ok, false);
});
