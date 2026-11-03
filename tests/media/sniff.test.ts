import test from "node:test";
import assert from "node:assert/strict";
import { matchesDeclaredType, sniffMime } from "../../lib/media/sniff.ts";

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const pad = (b: Uint8Array, n = 16) => Uint8Array.from([...b, ...new Array(Math.max(0, n - b.length)).fill(0)]);

const JPEG = pad(bytes([0xff, 0xd8, 0xff, 0xe0]));
const PNG = pad(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const WEBP = pad(bytes("RIFF", [0, 0, 0, 0], "WEBP"));
const MP4 = pad(bytes([0, 0, 0, 0x18], "ftyp", "isom"));
const WEBM = pad(bytes([0x1a, 0x45, 0xdf, 0xa3]));

test("recognises each allowed format from its first bytes", () => {
  assert.equal(sniffMime(JPEG), "image/jpeg");
  assert.equal(sniffMime(PNG), "image/png");
  assert.equal(sniffMime(WEBP), "image/webp");
  assert.equal(sniffMime(MP4), "video/mp4");
  assert.equal(sniffMime(WEBM), "video/webm");
});

test("rejects HEIC, QuickTime, GIF, PDF, HTML, executables and garbage", () => {
  const cases: Record<string, Uint8Array> = {
    heic: pad(bytes([0, 0, 0, 0x18], "ftyp", "heic")),
    avif: pad(bytes([0, 0, 0, 0x18], "ftyp", "avif")),
    quicktime: pad(bytes([0, 0, 0, 0x14], "ftyp", "qt  ")),
    gif: pad(bytes("GIF89a")),
    pdf: pad(bytes("%PDF-1.7")),
    html: pad(bytes("<html><script>")),
    exe: pad(bytes("MZ")),
    zeros: new Uint8Array(32),
    riffWave: pad(bytes("RIFF", [0, 0, 0, 0], "WAVE")),
  };
  for (const [name, b] of Object.entries(cases)) assert.equal(sniffMime(b), null, name);
});

test("too-short input never matches", () => {
  assert.equal(sniffMime(new Uint8Array(0)), null);
  assert.equal(sniffMime(Uint8Array.from([0xff, 0xd8, 0xff])), null);
});

test("matchesDeclaredType: a lie about the type is caught", () => {
  assert.equal(matchesDeclaredType("image/jpeg", JPEG), true);
  assert.equal(matchesDeclaredType("image/png", JPEG), false);       // claims PNG, is JPEG
  assert.equal(matchesDeclaredType("image/png", pad(bytes("<html>"))), false); // claims PNG, is HTML
  assert.equal(matchesDeclaredType("video/mp4", PNG), false);
  assert.equal(matchesDeclaredType("image/jpeg", new Uint8Array(0)), false);
});
