import test from "node:test";
import assert from "node:assert/strict";
import { parseStorageConfig } from "../../lib/storage/config.ts";

const GOOD = {
  S3_BUCKET: "aws-sbg-media-prod",
  S3_REGION: "ap-south-1",
  MEDIA_CDN_URL: "https://d111111abcdef8.cloudfront.net",
};

test("accepts a valid config and normalizes the CDN url", () => {
  const r = parseStorageConfig({ ...GOOD, MEDIA_CDN_URL: GOOD.MEDIA_CDN_URL + "/" });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value, { bucket: GOOD.S3_BUCKET, region: "ap-south-1", cdnUrl: GOOD.MEDIA_CDN_URL });
});

test("rejects each missing variable", () => {
  for (const k of Object.keys(GOOD)) {
    const env: Record<string, string | undefined> = { ...GOOD };
    delete env[k];
    assert.equal(parseStorageConfig(env).ok, false, `${k} missing should fail`);
  }
});

test("rejects bad bucket names and regions", () => {
  assert.equal(parseStorageConfig({ ...GOOD, S3_BUCKET: "Bad_Bucket" }).ok, false);
  assert.equal(parseStorageConfig({ ...GOOD, S3_BUCKET: "ab" }).ok, false);
  assert.equal(parseStorageConfig({ ...GOOD, S3_REGION: "mumbai" }).ok, false);
});

test("CDN must be https, except http on localhost", () => {
  assert.equal(parseStorageConfig({ ...GOOD, MEDIA_CDN_URL: "http://cdn.example.com" }).ok, false);
  assert.equal(parseStorageConfig({ ...GOOD, MEDIA_CDN_URL: "not a url" }).ok, false);
  assert.equal(parseStorageConfig({ ...GOOD, MEDIA_CDN_URL: "http://localhost:4566" }).ok, true);
});
