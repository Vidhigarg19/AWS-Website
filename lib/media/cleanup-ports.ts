// ============================================================
// Cleanup ports — the real Supabase / S3 / CloudFront glue (server only)
// ============================================================
// Thin on purpose: every rule lives in cleanup.ts (unit-tested).
// ============================================================

import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Storage } from "../storage/s3";
import {
  DELETED_GRACE_MS,
  FAILED_RETENTION_MS,
  PENDING_MAX_AGE_MS,
  PROCESSING_MAX_AGE_MS,
  type CleanupPorts,
  type CleanupRow,
} from "./cleanup";

const COLUMNS =
  "id,event_id,source,status,original_key,web_key,thumb_key,poster_key,created_at,updated_at,deleted_at";

const iso = (ms: number) => new Date(ms).toISOString();
const DELETE_BATCH = 1000; // S3 DeleteObjects maximum
const INVALIDATE_BATCH = 1000; // keep well below CloudFront's 3000-path limit

export interface CleanupDeps {
  db: SupabaseClient;
  storage: Storage;
  now: number;
  /** Optional. Without it, purged public files may stay cached on the CDN until they expire. */
  distributionId?: string;
}

export function cleanupPorts({ db, storage, now, distributionId }: CleanupDeps): CleanupPorts {
  return {
    async listCandidates(limit) {
      // One simple query per condition (oldest first). `classify` makes the final call.
      const queries = [
        db.from("media_items").select(COLUMNS)
          .not("deleted_at", "is", null).lt("deleted_at", iso(now - DELETED_GRACE_MS))
          .order("deleted_at", { ascending: true }).limit(limit),
        db.from("media_items").select(COLUMNS)
          .is("deleted_at", null).eq("status", "failed").lt("updated_at", iso(now - FAILED_RETENTION_MS))
          .order("updated_at", { ascending: true }).limit(limit),
        db.from("media_items").select(COLUMNS)
          .is("deleted_at", null).eq("status", "pending").lt("created_at", iso(now - PENDING_MAX_AGE_MS))
          .order("created_at", { ascending: true }).limit(limit),
        db.from("media_items").select(COLUMNS)
          .is("deleted_at", null).eq("status", "processing").lt("updated_at", iso(now - PROCESSING_MAX_AGE_MS))
          .order("updated_at", { ascending: true }).limit(limit),
      ];
      const results = await Promise.all(queries);
      const seen = new Map<string, CleanupRow>();
      for (const res of results) {
        if (res.error) throw new Error(`Cleanup listing failed: ${res.error.message}`);
        for (const row of (res.data ?? []) as CleanupRow[]) seen.set(row.id, row);
      }
      return [...seen.values()].slice(0, limit);
    },

    async markFailed(id, from) {
      const { data, error } = await db
        .from("media_items")
        .update({ status: "failed" })
        .eq("id", id)
        .eq("status", from)
        .is("deleted_at", null)
        .select("id");
      if (error) throw new Error(`Cleanup markFailed failed: ${error.message}`);
      return (data?.length ?? 0) === 1;
    },

    async deleteObjects(keys) {
      const failed: string[] = [];
      for (let i = 0; i < keys.length; i += DELETE_BATCH) {
        const batch = keys.slice(i, i + DELETE_BATCH);
        try {
          const res = await storage.client.send(
            new DeleteObjectsCommand({
              Bucket: storage.config.bucket,
              Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
            })
          );
          // S3 reports a missing key as deleted; only real errors land here.
          for (const e of res.Errors ?? []) if (e.Key) failed.push(e.Key);
        } catch {
          failed.push(...batch);
        }
      }
      return { failed };
    },

    async deleteRow(id, reason) {
      let q = db.from("media_items").delete().eq("id", id);
      q = reason === "deleted" ? q.not("deleted_at", "is", null) : q.eq("status", "failed");
      const { data, error } = await q.select("id");
      if (error) throw new Error(`Cleanup deleteRow failed: ${error.message}`);
      return (data?.length ?? 0) === 1;
    },

    async invalidateCdn(keys) {
      if (!distributionId || keys.length === 0) return;
      const cf = new CloudFrontClient({ region: "us-east-1" }); // CloudFront API is global
      for (let i = 0; i < keys.length; i += INVALIDATE_BATCH) {
        const batch = keys.slice(i, i + INVALIDATE_BATCH);
        await cf.send(
          new CreateInvalidationCommand({
            DistributionId: distributionId,
            InvalidationBatch: {
              CallerReference: `media-cleanup-${now}-${i}`,
              Paths: { Quantity: batch.length, Items: batch.map((k) => `/${k}`) },
            },
          })
        );
      }
    },
  };
}
