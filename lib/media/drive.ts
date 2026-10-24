// ============================================================
// Google Drive links — PURE (no network, no framework imports)
// ============================================================
//
// "Link only" import: a member pastes a Drive folder (or file) link, the
// server lists the files and stores their Drive ids. Nothing is copied.
//
// Security rules enforced here:
//   - We only EXTRACT an id from the pasted text. The pasted URL is never
//     fetched, so it cannot be used to make our server call arbitrary hosts.
//   - Only https://drive.google.com/... and https://docs.google.com/... hosts
//     are accepted; anything else is rejected.
//   - Ids must match Drive's alphabet and length, so they are safe to place
//     in a URL, a DB column and an iframe src.
// ============================================================

import type { MediaKind } from "./policy.ts";
import type { Validation } from "../auth/roles.ts";

export const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;
/** Most files one import may add. Keeps a single click bounded. */
export const MAX_DRIVE_FILES_PER_IMPORT = 200;

export type DriveLinkKind = "folder" | "file";
export interface DriveLink {
  kind: DriveLinkKind;
  id: string;
}

const ALLOWED_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

/** Extracts the folder/file id from a pasted Drive link. */
export function parseDriveLink(input: unknown): Validation<DriveLink> {
  if (typeof input !== "string") return { ok: false, error: "Paste a Google Drive link." };
  const text = input.trim();
  if (text.length === 0 || text.length > 2048) {
    return { ok: false, error: "Paste a Google Drive link." };
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "That does not look like a link." };
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return { ok: false, error: "Only Google Drive links (drive.google.com) are accepted." };
  }

  // /drive/folders/ID, /drive/u/0/folders/ID, /folders/ID
  const folder = /\/folders\/([^/?#]+)/.exec(url.pathname);
  if (folder && DRIVE_ID_PATTERN.test(folder[1])) return { ok: true, value: { kind: "folder", id: folder[1] } };

  // /file/d/ID/view, /file/u/0/d/ID
  const file = /\/d\/([^/?#]+)/.exec(url.pathname);
  if (file && DRIVE_ID_PATTERN.test(file[1])) return { ok: true, value: { kind: "file", id: file[1] } };

  // /open?id=ID and /uc?id=ID: could be either; the API tells us which.
  const idParam = url.searchParams.get("id");
  if (idParam && DRIVE_ID_PATTERN.test(idParam)) return { ok: true, value: { kind: "file", id: idParam } };

  return { ok: false, error: "Could not find a folder or file id in that link." };
}

// ---- What Drive tells us about a file -----------------------------------

export interface DriveFile {
  id: string;
  name?: string;
  mimeType: string;
  size?: string; // Drive returns int64 as a string
  imageMediaMetadata?: { width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
}

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

/** image/* and video/* only. HEIC is fine here: Drive renders it for us. */
export function driveKind(mimeType: string): MediaKind | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

/** The row fields we store for one Drive file (matches media_items columns). */
export interface DriveRowFields {
  event_id: string;
  uploaded_by: string;
  source: "drive";
  drive_file_id: string;
  kind: MediaKind;
  purpose: "gallery";
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  status: "ready";
}

export interface DriveImportPlan {
  rows: DriveRowFields[];
  /** Files that were already linked to this event. */
  duplicates: number;
  /** Subfolders, documents and anything else that is not a photo/video. */
  unsupported: number;
  /** Files beyond MAX_DRIVE_FILES_PER_IMPORT. */
  overLimit: number;
}

function positiveInt(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function planDriveImport(
  files: readonly DriveFile[],
  alreadyLinked: ReadonlySet<string>,
  eventId: string,
  userId: string
): DriveImportPlan {
  const plan: DriveImportPlan = { rows: [], duplicates: 0, unsupported: 0, overLimit: 0 };
  const seen = new Set<string>();

  for (const f of files) {
    const kind = DRIVE_ID_PATTERN.test(f.id) ? driveKind(f.mimeType) : null;
    if (!kind) {
      plan.unsupported++;
      continue;
    }
    if (alreadyLinked.has(f.id) || seen.has(f.id)) {
      plan.duplicates++;
      continue;
    }
    if (plan.rows.length >= MAX_DRIVE_FILES_PER_IMPORT) {
      plan.overLimit++;
      continue;
    }
    seen.add(f.id);
    const meta = kind === "image" ? f.imageMediaMetadata : f.videoMediaMetadata;
    const ms = kind === "video" ? positiveInt(f.videoMediaMetadata?.durationMillis) : null;
    plan.rows.push({
      event_id: eventId,
      uploaded_by: userId,
      source: "drive",
      drive_file_id: f.id,
      kind,
      purpose: "gallery",
      mime_type: f.mimeType.slice(0, 100),
      size_bytes: positiveInt(f.size),
      width: positiveInt(meta?.width),
      height: positiveInt(meta?.height),
      duration_s: ms === null ? null : Math.round(ms) / 1000,
      status: "ready",
    });
  }
  return plan;
}

// ---- Public URLs (built from the id only) --------------------------------

export function driveThumbUrl(id: string, width: number): string {
  if (!DRIVE_ID_PATTERN.test(id)) throw new Error("Invalid Drive file id.");
  const w = Math.min(Math.max(Math.round(width), 64), 2000);
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
}

/** iframe player for a Drive video. */
export function drivePreviewUrl(id: string): string {
  if (!DRIVE_ID_PATTERN.test(id)) throw new Error("Invalid Drive file id.");
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function isDriveUrl(url: string): boolean {
  return url.startsWith("https://drive.google.com/");
}
