// ============================================================
// Moderation rules for PATCH /api/media/items/[id] — PURE
// ============================================================
//
// Two things can change on an existing item:
//   - its caption
//   - whether it is hidden from the public site (ready <-> hidden)
//
// Hiding is reversible and instant. Deleting is a separate soft delete
// (DELETE route): the row stays for the cleanup job, the public site stops
// showing it at once.
//
// Only items that are already past upload can be edited (processing, ready,
// hidden). `pending`/`failed` rows are not real items yet.
// ============================================================

import type { Validation } from "../auth/roles.ts";
import { validateCaption } from "./validate.ts";
import { canTransition, type MediaStatus } from "./status.ts";

export interface ItemPatch {
  /** undefined = leave alone, null = clear, string = set */
  caption?: string | null;
  /** true = hide from the public site, false = show again */
  hidden?: boolean;
}

export function validateItemPatch(body: unknown): Validation<ItemPatch> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }
  const { caption, hidden } = body as Record<string, unknown>;
  const patch: ItemPatch = {};

  if (caption !== undefined) {
    const c = validateCaption(caption);
    if (!c.ok) return c;
    patch.caption = c.value;
  }
  if (hidden !== undefined) {
    if (typeof hidden !== "boolean") return { ok: false, error: "'hidden' must be true or false." };
    patch.hidden = hidden;
  }
  if (patch.caption === undefined && patch.hidden === undefined) {
    return { ok: false, error: "Nothing to change." };
  }
  return { ok: true, value: patch };
}

export interface ItemUpdate {
  caption?: string | null;
  status?: MediaStatus;
}

export type PatchPlan =
  | {
      ok: true;
      /** Fields to write. Empty object = nothing to do (already in that state). */
      update: ItemUpdate;
      /** The conditional-update guard: only write if the row is STILL in this status. */
      expectStatus: MediaStatus;
    }
  | { ok: false; error: string };

const EDITABLE: readonly MediaStatus[] = ["processing", "ready", "hidden"];

export function planItemPatch(current: MediaStatus, patch: ItemPatch): PatchPlan {
  if (!EDITABLE.includes(current)) {
    return { ok: false, error: "This item is not available for changes." };
  }

  const update: ItemUpdate = {};
  if (patch.caption !== undefined) update.caption = patch.caption;

  if (patch.hidden === true) {
    if (current === "ready") {
      if (!canTransition("ready", "hidden")) return { ok: false, error: "Cannot hide this item." };
      update.status = "hidden";
    } else if (current !== "hidden") {
      return { ok: false, error: "Only items that are live can be hidden." };
    }
  } else if (patch.hidden === false) {
    if (current === "hidden") {
      if (!canTransition("hidden", "ready")) return { ok: false, error: "Cannot show this item." };
      update.status = "ready";
    } else if (current !== "ready") {
      return { ok: false, error: "This item is not hidden." };
    }
  }

  return { ok: true, update, expectStatus: current };
}
