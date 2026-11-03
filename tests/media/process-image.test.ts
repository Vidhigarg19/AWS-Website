import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processImage, UnreadableImageError, WEB_MAX_PX, THUMB_MAX_PX } from "../../lib/media/process-image.ts";
import { mapLimit } from "../../lib/media/concurrency.ts";
import { heicToJpegName, isHeicFile } from "../../lib/media/heic.ts";

const solid = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 30 } } });

test("big photo: web <= 1920, thumb <= 480, both WebP, aspect kept", async () => {
  const input = await solid(4000, 3000).jpeg().toBuffer();
  const out = await processImage(input);
  const web = await sharp(out.web).metadata();
  const thumb = await sharp(out.thumb).metadata();
  assert.equal(web.format, "webp");
  assert.equal(thumb.format, "webp");
  assert.deepEqual([web.width, web.height], [WEB_MAX_PX, 1440]);
  assert.deepEqual([thumb.width, thumb.height], [THUMB_MAX_PX, 360]);
  assert.deepEqual([out.width, out.height], [WEB_MAX_PX, 1440]);
});

test("a small image is never enlarged", async () => {
  const out = await processImage(await solid(300, 200).png().toBuffer());
  assert.deepEqual([out.width, out.height], [300, 200]);
  const thumb = await sharp(out.thumb).metadata();
  assert.deepEqual([thumb.width, thumb.height], [300, 200]);
});

test("EXIF orientation is applied, and ALL metadata (GPS, device, copyright) is dropped", async () => {
  // Stored 4000x3000 with orientation 6 (rotate 90): shown as portrait 3000x4000.
  const input = await solid(4000, 3000)
    .jpeg()
    .withExif({ IFD0: { Copyright: "secret-owner", Make: "SecretPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "30/1 19/1 0/1" } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const before = await sharp(input).metadata();
  assert.equal(before.orientation, 6);
  assert.ok(before.exif, "fixture must actually carry EXIF");

  const out = await processImage(input);
  const web = await sharp(out.web).metadata();
  assert.deepEqual([web.width, web.height], [1440, 1920]); // portrait now
  assert.equal(web.exif, undefined);
  assert.ok(!Buffer.from(out.web).includes("secret-owner"));
  assert.ok(!Buffer.from(out.web).includes("SecretPhone"));
  assert.equal((await sharp(out.thumb).metadata()).exif, undefined);
});

test("garbage bytes and a truncated image are rejected as unreadable, not as a crash", async () => {
  await assert.rejects(processImage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), UnreadableImageError);
  const good = await solid(2000, 2000).jpeg().toBuffer();
  await assert.rejects(processImage(good.subarray(0, 200)), UnreadableImageError);
});

test("an image over the pixel limit is refused before decoding", async () => {
  // 10000x9000 = 90 MP > 80 MP limit; a flat PNG of that size is tiny on disk.
  const bomb = await sharp({ create: { width: 10000, height: 9000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
  assert.ok(bomb.length < 5_000_000);
  await assert.rejects(processImage(bomb), UnreadableImageError);
});

test("an animated image uses only its first frame", async () => {
  const frames = await sharp({ create: { width: 100, height: 300, channels: 3, background: "#00f" } }).webp().toBuffer();
  const out = await processImage(frames);
  assert.equal((await sharp(out.web).metadata()).pages ?? 1, 1);
});

test("mapLimit keeps order and never exceeds the limit", async () => {
  let running = 0, peak = 0;
  const res = await mapLimit([5, 1, 4, 2, 3, 6, 7], 3, async (n) => {
    running++; peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, n * 5));
    running--;
    return n * 10;
  });
  assert.deepEqual(res, [50, 10, 40, 20, 30, 60, 70]);
  assert.ok(peak <= 3 && peak >= 2, `peak ${peak}`);
  assert.deepEqual(await mapLimit([], 3, async (x) => x), []);
});

test("HEIC detection works by type or extension, and renames to .jpg", () => {
  assert.equal(isHeicFile({ name: "IMG_1.HEIC", type: "" }), true);
  assert.equal(isHeicFile({ name: "x", type: "image/heif" }), true);
  assert.equal(isHeicFile({ name: "a.heif", type: "application/octet-stream" }), true);
  assert.equal(isHeicFile({ name: "a.jpg", type: "image/jpeg" }), false);
  assert.equal(isHeicFile({ name: "heic.png", type: "image/png" }), false);
  assert.equal(heicToJpegName("IMG_1234.HEIC"), "IMG_1234.jpg");
  assert.equal(heicToJpegName(".heic"), "photo.jpg");
});
