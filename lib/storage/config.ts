// ============================================================
// Storage configuration — PURE (takes an env-like object, reads nothing itself)
// ============================================================
//
// Amplify reserves env var names that start with AWS_, so we use:
//   S3_BUCKET      bucket name
//   S3_REGION      bucket region, e.g. ap-south-1
//   MEDIA_CDN_URL  CloudFront URL, e.g. https://d111111abcdef8.cloudfront.net
//
// There are NO access keys here on purpose: on Amplify the compute IAM role
// supplies credentials automatically (see infra/README.md).
// ============================================================

import type { Validation } from "../auth/roles.ts";

export interface StorageConfig {
  bucket: string;
  region: string;
  /** CDN base URL with no trailing slash. */
  cdnUrl: string;
}

// S3 bucket naming rules (3-63 chars, lowercase, digits, dots, hyphens).
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d$/;

export function parseStorageConfig(
  env: Record<string, string | undefined>
): Validation<StorageConfig> {
  const bucket = env.S3_BUCKET?.trim() ?? "";
  const region = env.S3_REGION?.trim() ?? "";
  const cdnRaw = env.MEDIA_CDN_URL?.trim() ?? "";

  if (!BUCKET_PATTERN.test(bucket)) {
    return { ok: false, error: "S3_BUCKET is missing or not a valid bucket name." };
  }
  if (!REGION_PATTERN.test(region)) {
    return { ok: false, error: "S3_REGION is missing or not a valid region (e.g. ap-south-1)." };
  }

  let url: URL;
  try {
    url = new URL(cdnRaw);
  } catch {
    return { ok: false, error: "MEDIA_CDN_URL is missing or not a valid URL." };
  }
  // Public media must be served over HTTPS. Allow http only for localhost dev.
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    return { ok: false, error: "MEDIA_CDN_URL must use https." };
  }

  return {
    ok: true,
    value: { bucket, region, cdnUrl: url.origin },
  };
}
