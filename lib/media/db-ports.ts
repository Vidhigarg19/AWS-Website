// ============================================================
// The database half of the completion ports (server only)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompletionPorts } from "./complete";
import { isMediaStatus } from "./status";

export function dbPorts(db: SupabaseClient): Pick<CompletionPorts, "transition" | "currentStatus"> {
  return {
    async transition(id, from, to, patch) {
      // Conditional update: matches only if the row is STILL in `from`.
      // Zero rows back means another request moved it first.
      const { data, error } = await db
        .from("media_items")
        .update({ status: to, ...patch })
        .eq("id", id)
        .eq("status", from)
        .select("id");
      if (error) throw new Error(`transition ${from}->${to} failed: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },

    async currentStatus(id) {
      const { data, error } = await db
        .from("media_items")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`status lookup failed: ${error.message}`);
      return isMediaStatus(data?.status) ? data.status : null;
    },
  };
}
