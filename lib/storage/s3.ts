// ============================================================
// S3 access for the Media Portal (server only)
// ============================================================
//
// No access keys anywhere. The AWS SDK finds credentials by itself:
//   - on Amplify: from the app's IAM compute role (infra/media-storage.yaml)
//   - locally:    from your AWS CLI profile / environment
//
// This file is thin glue; the rules live in the pure modules
// (presign-policy.ts, lib/media/*) which have unit tests.
// ============================================================

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { parseStorageConfig, type StorageConfig } from "./config";
import { buildPostPolicy, type PostPolicyInput } from "./presign-policy";
import type { CompletionPorts } from "../media/complete";

export interface Storage {
  config: StorageConfig;
  client: S3Client;
}

let cached: Storage | null = null;

/** Returns null (and logs why) when the S3_* variables are missing or invalid. */
export function getStorage(): Storage | null {
  if (cached) return cached;
  const parsed = parseStorageConfig(process.env);
  if (!parsed.ok) {
    console.error("[storage]", parsed.error);
    return null;
  }
  cached = {
    config: parsed.value,
    client: new S3Client({ region: parsed.value.region }),
  };
  return cached;
}

export interface SignedUpload {
  url: string;
  fields: Record<string, string>;
}

/** Create the browser upload permission. Throws if the input breaks our policy. */
export async function signUpload(
  storage: Storage,
  input: Omit<PostPolicyInput, "bucket">
): Promise<SignedUpload> {
  const policy = buildPostPolicy({ ...input, bucket: storage.config.bucket });
  return createPresignedPost(storage.client, policy);
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}

/** The S3 half of the completion ports. */
export function s3Ports(
  storage: Storage
): Pick<CompletionPorts, "headObject" | "readFirstBytes" | "readObject" | "putObject" | "deleteObject"> {
  const { client, config } = storage;
  return {
    async headObject(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return { size: res.ContentLength ?? -1, contentType: res.ContentType };
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err; // 403 here means the IAM policy is wrong: surface it, do not hide it
      }
    },

    async readFirstBytes(key, count) {
      try {
        const res = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=0-${count - 1}` })
        );
        return (await res.Body?.transformToByteArray()) ?? new Uint8Array();
      } catch (err) {
        // A zero-byte object cannot satisfy a Range request (416): treat as empty.
        if ((err as { name?: string })?.name === "InvalidRange") return new Uint8Array();
        throw err;
      }
    },

    async readObject(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      if (!res.Body) throw new Error("Empty S3 response body.");
      return res.Body.transformToByteArray();
    },

    async putObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Keys are unique per media id, so browsers/CDN may cache them forever.
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
