// ============================================================
// Upload queue for the portal screen — PURE (no React, no fetch, no DOM)
// ============================================================
//
// The screen has a lot of moving parts at once: files being checked, signed,
// uploaded in parallel, verified, retried. Keeping the rules here, as a plain
// reducer, means they are unit-tested instead of hoped-for, and the React
// component only wires events to actions.
//
// Life of one file:
//
//   queued -> signing -> waiting -> uploading -> verifying -> live | processing
//                                       \            \-> error (retry ok)
//                                        \-> error (retry = sign again)
//
//   `waiting` = signed, but all upload slots are busy (max 3 at once).
//   `live`      = visible on the public site now (videos).
//   `processing`= verified; waits for the image pipeline (step 7).
//
// The server re-checks EVERYTHING. The pre-check here only saves the user a
// round trip and explains problems early.
// ============================================================

import {
  ALLOWED_TYPES,
  MAX_FILES_PER_REQUEST,
  type MediaKind,
  type MediaPurpose,
} from "./policy.ts";

export const MAX_PARALLEL_UPLOADS = 3;

export type ItemState =
  | "queued"
  | "signing"
  | "waiting"
  | "uploading"
  | "verifying"
  | "processing"
  | "live"
  | "error";

export interface QueueItem {
  /** Local id, only used by the screen. */
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: MediaKind;
  state: ItemState;
  /** 0-100, bytes sent to storage. */
  progress: number;
  /** Server id, set once the upload has been signed. */
  mediaId?: string;
  /** True once the file fully reached storage (so retry only re-verifies). */
  uploaded: boolean;
  error?: string;
  retryable: boolean;
}

export interface FileInfo {
  name: string;
  type: string;
  size: number;
}

// ── Formatting ───────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`;
}

// ── Pre-check ────────────────────────────────────────────────

const IOS_FORMATS = /\.(heic|heif|mov)$/i;

/** Plain-language reason a file cannot be uploaded, or null if it looks fine. */
export function precheckFile(file: FileInfo, purpose: MediaPurpose): string | null {
  if (file.size <= 0) return "This file is empty.";

  const rule = Object.hasOwn(ALLOWED_TYPES, file.type) ? ALLOWED_TYPES[file.type] : undefined;
  if (!rule) {
    if (IOS_FORMATS.test(file.name) || /^(image\/hei[cf]|video\/quicktime)$/.test(file.type)) {
      return "iPhone formats (HEIC / MOV) are not supported yet. Export as JPEG or MP4 and try again.";
    }
    return "Unsupported file type. Use JPEG, PNG, WebP, MP4 or WebM.";
  }

  if (purpose === "cover" && rule.kind !== "image") return "A cover must be an image.";

  if (file.size > rule.maxBytes) {
    const limit = formatBytes(rule.maxBytes);
    return `Too large (${formatBytes(file.size)}). ${rule.kind === "image" ? "Images" : "Videos"} can be up to ${limit}.`;
  }
  return null;
}

/** Build a queue item. Files that fail the pre-check become non-retryable error rows. */
export function buildQueueItem(id: string, file: FileInfo, purpose: MediaPurpose): QueueItem {
  const rule = Object.hasOwn(ALLOWED_TYPES, file.type) ? ALLOWED_TYPES[file.type] : undefined;
  const problem = precheckFile(file, purpose);
  return {
    id,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    kind: rule?.kind ?? "image",
    state: problem ? "error" : "queued",
    progress: 0,
    uploaded: false,
    error: problem ?? undefined,
    retryable: false,
  };
}

// ── Actions and reducer ──────────────────────────────────────

export type QueueAction =
  | { type: "add"; items: QueueItem[] }
  | { type: "signing"; ids: string[] }
  | { type: "signed"; id: string; mediaId: string }
  | { type: "start"; id: string }
  | { type: "progress"; id: string; progress: number }
  | { type: "uploaded"; id: string }
  | { type: "completed"; id: string; outcome: CompleteOutcome }
  | { type: "fail"; id: string; message: string; retryable: boolean }
  | { type: "retry"; id: string }
  | { type: "remove"; id: string }
  | { type: "clearFinished" };

const BUSY: readonly ItemState[] = ["signing", "waiting", "uploading", "verifying"];
export const isBusy = (s: ItemState): boolean => BUSY.includes(s);

function update(items: QueueItem[], id: string, fn: (i: QueueItem) => QueueItem): QueueItem[] {
  let changed = false;
  const next = items.map((i) => {
    if (i.id !== id) return i;
    const out = fn(i);
    if (out !== i) changed = true;
    return out;
  });
  return changed ? next : items;
}

/** Only apply `fn` when the item is in one of `from`; stale events are ignored. */
const when =
  (from: ItemState[], fn: (i: QueueItem) => QueueItem) =>
  (i: QueueItem): QueueItem =>
    from.includes(i.state) ? fn(i) : i;

export function queueReducer(items: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case "add":
      return [...items, ...action.items];

    case "signing": {
      const ids = new Set(action.ids);
      return items.map((i) => (ids.has(i.id) && i.state === "queued" ? { ...i, state: "signing" } : i));
    }

    case "signed":
      return update(items, action.id, when(["signing"], (i) => ({ ...i, state: "waiting", mediaId: action.mediaId })));

    case "start":
      return update(items, action.id, when(["waiting"], (i) => ({ ...i, state: "uploading", progress: 0 })));

    case "progress": {
      const p = Math.max(0, Math.min(100, Math.round(action.progress)));
      return update(items, action.id, when(["uploading"], (i) => (i.progress === p ? i : { ...i, progress: p })));
    }

    case "uploaded":
      return update(items, action.id, when(["uploading"], (i) => ({ ...i, state: "verifying", progress: 100, uploaded: true })));

    case "completed":
      return update(items, action.id, when(["verifying"], (i) => applyOutcome(i, action.outcome)));

    case "fail":
      return update(items, action.id, when(["signing", "waiting", "uploading", "verifying"], (i) => ({
        ...i,
        state: "error",
        error: action.message,
        retryable: action.retryable,
      })));

    case "retry":
      return update(items, action.id, (i) => {
        if (i.state !== "error" || !i.retryable) return i;
        // File already reached storage: only the check needs repeating.
        if (i.uploaded && i.mediaId) return { ...i, state: "verifying", error: undefined, retryable: false };
        // Otherwise start over: a fresh signature (and a new server id).
        return { ...i, state: "queued", progress: 0, mediaId: undefined, uploaded: false, error: undefined, retryable: false };
      });

    case "remove":
      return items.filter((i) => !(i.id === action.id && !isBusy(i.state)));

    case "clearFinished":
      return items.filter((i) => i.state !== "live" && i.state !== "processing");
  }
}

// ── Server outcome -> item state ─────────────────────────────

/** Shape of one entry in the /complete response. */
export type CompleteOutcome =
  | { state: "accepted"; status: string }
  | { state: "not_uploaded" }
  | { state: "rejected"; reason: string }
  | { state: "failed" }
  | { state: "not_found" }
  | { state: "error" };

const REJECT_MESSAGES: Record<string, string> = {
  size_mismatch: "The file changed size while uploading. Remove it and add it again.",
  type_mismatch: "The file type did not match. Remove it and add it again.",
  content_mismatch: "This file is not a valid image or video, so it was rejected.",
};

export function applyOutcome(item: QueueItem, outcome: CompleteOutcome): QueueItem {
  switch (outcome.state) {
    case "accepted":
      if (outcome.status === "processing") return { ...item, state: "processing", error: undefined, retryable: false };
      // ready (and hidden, which only admins can set) both mean "done on our side".
      return { ...item, state: "live", error: undefined, retryable: false };
    case "not_uploaded":
      return { ...item, state: "error", error: "The file did not reach storage. Try again.", retryable: true };
    case "rejected":
      return {
        ...item,
        state: "error",
        error: REJECT_MESSAGES[outcome.reason] ?? "This file was rejected.",
        retryable: false,
      };
    case "failed":
      return { ...item, state: "error", error: "This upload failed earlier. Remove it and add it again.", retryable: false };
    case "not_found":
      return { ...item, state: "error", error: "Upload not found. Remove it and add it again.", retryable: false };
    case "error":
      return { ...item, state: "error", error: "Something went wrong on our side. Try again.", retryable: true };
  }
}

// ── Scheduling helpers ───────────────────────────────────────

/** Ids to move from `waiting` to `uploading` now, respecting the parallel limit. */
export function pickToStart(items: QueueItem[], limit = MAX_PARALLEL_UPLOADS): string[] {
  const active = items.filter((i) => i.state === "uploading").length;
  const free = Math.max(0, limit - active);
  return items.filter((i) => i.state === "waiting").slice(0, free).map((i) => i.id);
}

/** Split `queued` items into init requests (the API accepts a limited number per call). */
export function chunkForInit(ids: string[], size = MAX_FILES_PER_REQUEST): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export interface QueueSummary {
  total: number;
  done: number;
  failed: number;
  inFlight: number;
}

export function summarize(items: QueueItem[]): QueueSummary {
  let done = 0;
  let failed = 0;
  let inFlight = 0;
  for (const i of items) {
    if (i.state === "live" || i.state === "processing") done++;
    else if (i.state === "error") failed++;
    else inFlight++;
  }
  return { total: items.length, done, failed, inFlight };
}
