import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUploadKey,
  buildVariantKeys,
  isPublicKey,
  parseMediaKey,
  publicUrl,
} from "../../lib/media/keys.ts";

const EVENT = "11111111-1111-4111-8111-111111111111";
const MEDIA = "22222222-2222-4222-8222-222222222222";
// Contains letters, so .toUpperCase() really changes it (digit-only ids would not).
const HEX_EVENT = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef";
const HEX_MEDIA = "fedcbafe-dcba-4cba-8cba-fedcbafedcba";

test("images upload to the private original/ area, videos to video/", () => {
  assert.equal(buildUploadKey(EVENT, MEDIA, "image", "jpg"), `events/${EVENT}/original/${MEDIA}.jpg`);
  assert.equal(buildUploadKey(EVENT, MEDIA, "video", "mp4"), `events/${EVENT}/video/${MEDIA}.mp4`);
});

test("variant keys are webp under web/ thumb/ poster/", () => {
  const k = buildVariantKeys(EVENT, MEDIA);
  assert.equal(k.web, `events/${EVENT}/web/${MEDIA}.webp`);
  assert.equal(k.thumb, `events/${EVENT}/thumb/${MEDIA}.webp`);
  assert.equal(k.poster, `events/${EVENT}/poster/${MEDIA}.webp`);
});

test("ids are lowercased so one file always has one key", () => {
  assert.notEqual(HEX_EVENT.toUpperCase(), HEX_EVENT); // guard: the test input must really be uppercase
  const key = buildUploadKey(HEX_EVENT.toUpperCase(), HEX_MEDIA.toUpperCase(), "image", "png");
  assert.equal(key, `events/${HEX_EVENT}/original/${HEX_MEDIA}.png`);
});

test("path tricks, bad ids and bad extensions can never produce a key", () => {
  assert.throws(() => buildUploadKey("../etc", MEDIA, "image", "jpg"));
  assert.throws(() => buildUploadKey(EVENT, `${MEDIA}/../x`, "image", "jpg"));
  assert.throws(() => buildUploadKey(EVENT, MEDIA, "image", "exe"));
  assert.throws(() => buildUploadKey(EVENT, MEDIA, "image", "jpg/../../x"));
  assert.throws(() => buildVariantKeys("nope", MEDIA));
});

test("parseMediaKey round-trips what we build", () => {
  const parsed = parseMediaKey(buildUploadKey(EVENT, MEDIA, "video", "webm"));
  assert.deepEqual(parsed, { eventId: EVENT, area: "video", mediaId: MEDIA, ext: "webm" });
});

test("parseMediaKey rejects anything we did not generate", () => {
  for (const bad of [
    "",
    "events/x/original/y.jpg",
    `events/${EVENT}/original/${MEDIA}.exe`,
    `events/${EVENT}/secret/${MEDIA}.jpg`,
    `events/${EVENT}/original/${MEDIA}.jpg/extra`,
    `/events/${EVENT}/original/${MEDIA}.jpg`,
    `events/${EVENT}/../original/${MEDIA}.jpg`,
    `events/${HEX_EVENT.toUpperCase()}/original/${HEX_MEDIA}.jpg`,
    `events/${HEX_EVENT}/original/${HEX_MEDIA.toUpperCase()}.jpg`,
  ]) {
    assert.equal(parseMediaKey(bad), null, bad);
  }
});

test("only web/ thumb/ poster/ video/ are public. original/ never is", () => {
  const k = buildVariantKeys(EVENT, MEDIA);
  assert.equal(isPublicKey(k.web), true);
  assert.equal(isPublicKey(k.thumb), true);
  assert.equal(isPublicKey(k.poster), true);
  assert.equal(isPublicKey(buildUploadKey(EVENT, MEDIA, "video", "mp4")), true);
  assert.equal(isPublicKey(buildUploadKey(EVENT, MEDIA, "image", "jpg")), false);
  assert.equal(isPublicKey("anything/else.jpg"), false);
});

test("publicUrl refuses private keys and malformed CDN bases", () => {
  const k = buildVariantKeys(EVENT, MEDIA);
  assert.equal(publicUrl("https://cdn.example.com", k.thumb), `https://cdn.example.com/${k.thumb}`);
  assert.throws(() => publicUrl("https://cdn.example.com", buildUploadKey(EVENT, MEDIA, "image", "jpg")));
  assert.throws(() => publicUrl("http://cdn.example.com", k.web));
  assert.throws(() => publicUrl("https://cdn.example.com/", k.web));
  assert.throws(() => publicUrl("https://cdn.example.com/path", k.web));
});
