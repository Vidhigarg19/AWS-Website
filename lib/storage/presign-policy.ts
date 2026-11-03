// ============================================================
// Presigned-POST policy builder — PURE
// ============================================================
//
// The upload API will pass the result straight to createPresignedPost():
//   createPresignedPost(s3, buildPostPolicy({...}))
//
// The policy is what S3 itself enforces, so a modified browser cannot cheat:
//   - key            exactly the server-generated key (no path choice)
//   - Content-Type   exactly the declared, allowlisted type
//   - content-length-range  exactly the declared size (min = max = size), so
//                    the file must be the size we validated and budgeted for
//   - Expires        short-lived (PRESIGN_TTL_SECONDS)
//
// Videos are published as uploaded from video/ (public via CloudFront), so we
// also pin an immutable Cache-Control on them. Images land in the private
// original/ area and get their cache headers when the processing step
// writes the public WebP variants.
// ============================================================

import { ALLOWED_TYPES, PRESIGN_TTL_SECONDS, type MediaKind } from "../media/policy.ts";
import { parseMediaKey } from "../media/keys.ts";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface PostPolicyInput {
  bucket: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
}

export type PostCondition =
  | { [field: string]: string }
  | ["eq", string, string]
  | ["content-length-range", number, number];

export interface PostPolicy {
  Bucket: string;
  Key: string;
  Fields: Record<string, string>;
  Conditions: PostCondition[];
  Expires: number;
}

export function buildPostPolicy(input: PostPolicyInput): PostPolicy {
  const { bucket, key, mimeType, sizeBytes, kind } = input;

  const allowed = ALLOWED_TYPES[mimeType];
  if (!allowed || allowed.kind !== kind) {
    throw new Error("Unsupported or mismatched file type.");
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > allowed.maxBytes) {
    throw new Error("File size is outside the allowed range.");
  }

  // The key must be one we could have generated, in the area for this kind.
  const parsed = parseMediaKey(key);
  const expectedArea = kind === "video" ? "video" : "original";
  if (!parsed || parsed.area !== expectedArea || parsed.ext !== allowed.ext) {
    throw new Error("Key does not match the file type.");
  }

  const Fields: Record<string, string> = { "Content-Type": mimeType };
  const Conditions: PostCondition[] = [
    ["content-length-range", sizeBytes, sizeBytes],
    ["eq", "$Content-Type", mimeType],
  ];

  if (kind === "video") {
    Fields["Cache-Control"] = IMMUTABLE_CACHE_CONTROL;
    Conditions.push(["eq", "$Cache-Control", IMMUTABLE_CACHE_CONTROL]);
  }

  return { Bucket: bucket, Key: key, Fields, Conditions, Expires: PRESIGN_TTL_SECONDS };
}
