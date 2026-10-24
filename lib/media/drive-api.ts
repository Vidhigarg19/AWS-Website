// ============================================================
// Google Drive API v3 (read-only, API key) — fetch is injected
// ============================================================
//
// Works only for items shared as "Anyone with the link". The key lives in the
// server env (GOOGLE_DRIVE_API_KEY) and is never sent to a browser: the public
// pages build thumbnail/preview URLs from the file id alone.
//
// We only ever call https://www.googleapis.com/drive/v3/files with ids that
// passed DRIVE_ID_PATTERN. User text never becomes a host or a path.
// ============================================================

import { DRIVE_ID_PATTERN, DRIVE_FOLDER_MIME, MAX_DRIVE_FILES_PER_IMPORT, type DriveFile, type DriveLink } from "./drive.ts";

const API = "https://www.googleapis.com/drive/v3/files";
const FIELDS = "id,name,mimeType,size,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis)";
const PAGE_SIZE = 100;
/** Hard stop on listing so a giant folder cannot loop us for long. */
const MAX_PAGES = Math.ceil(MAX_DRIVE_FILES_PER_IMPORT / PAGE_SIZE) + 2;

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type DriveListing =
  | { ok: true; files: DriveFile[]; truncated: boolean }
  | { ok: false; error: string; status: 400 | 404 | 502 };

function mapError(status: number): DriveListing {
  if (status === 404) {
    return { ok: false, status: 404, error: "Drive could not find that link. Check it, and that sharing is set to \"Anyone with the link\"." };
  }
  if (status === 403 || status === 401) {
    return { ok: false, status: 400, error: "Drive refused access. Set sharing to \"Anyone with the link\" (Viewer) and try again." };
  }
  return { ok: false, status: 502, error: "Google Drive is not responding right now. Try again shortly." };
}

function isDriveFile(v: unknown): v is DriveFile {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.mimeType === "string";
}

export async function listDriveFiles(
  link: DriveLink,
  apiKey: string,
  fetchFn: FetchLike
): Promise<DriveListing> {
  if (!DRIVE_ID_PATTERN.test(link.id)) return { ok: false, status: 400, error: "Invalid Drive link." };
  const key = encodeURIComponent(apiKey);

  try {
    // A single file (or an ambiguous id): ask Drive what it is.
    if (link.kind === "file") {
      const res = await fetchFn(`${API}/${link.id}?fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true&key=${key}`);
      if (!res.ok) return mapError(res.status);
      const body = await res.json();
      if (!isDriveFile(body)) return mapError(502);
      if (body.mimeType === DRIVE_FOLDER_MIME) return listFolder(body.id, key, fetchFn);
      return { ok: true, files: [body], truncated: false };
    }
    return await listFolder(link.id, key, fetchFn);
  } catch {
    return mapError(502);
  }
}

async function listFolder(folderId: string, key: string, fetchFn: FetchLike): Promise<DriveListing> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url =
      `${API}?q=${q}&pageSize=${PAGE_SIZE}&orderBy=createdTime&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      `&fields=${encodeURIComponent(`nextPageToken,files(${FIELDS})`)}&key=${key}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetchFn(url);
    if (!res.ok) return mapError(res.status);
    const body = (await res.json()) as { files?: unknown[]; nextPageToken?: string };
    for (const f of body.files ?? []) if (isDriveFile(f)) files.push(f);
    pageToken = body.nextPageToken;
    if (!pageToken) return { ok: true, files, truncated: false };
    if (files.length >= MAX_DRIVE_FILES_PER_IMPORT * 2) break;
  }
  return { ok: true, files, truncated: true };
}
