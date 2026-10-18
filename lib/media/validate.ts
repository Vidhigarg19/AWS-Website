// ============================================================
// Validation of POST /api/media/uploads/init — PURE
// ============================================================
//
// Everything the client sends is untrusted. This turns the raw JSON body into
// a normalized, safe list or a single clear error. Whole request fails if any
// file is invalid (simpler and safer than partial acceptance).
// ============================================================

import { isUuid, type Validation } from "../auth/roles.ts";
import {
  ALLOWED_TYPES,
  MAX_CAPTION_LENGTH,
  MAX_FILES_PER_REQUEST,
  MEDIA_PURPOSES,
  type AllowedType,
  type MediaKind,
  type MediaPurpose,
} from "./policy.ts";

export interface ValidFile {
  /** Position in the request, so the response can be matched to the file. */
  index: number;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
  ext: string;
}

export interface ValidInitRequest {
  eventId: string;
  purpose: MediaPurpose;
  files: ValidFile[];
}

function formatMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function validateInitRequest(body: unknown): Validation<ValidInitRequest> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const { eventId, purpose, files } = body as Record<string, unknown>;

  if (typeof eventId !== "string" || !isUuid(eventId)) {
    return { ok: false, error: "A valid event is required." };
  }

  let cleanPurpose: MediaPurpose = "gallery";
  if (purpose !== undefined) {
    if (typeof purpose !== "string" || !MEDIA_PURPOSES.includes(purpose as MediaPurpose)) {
      return { ok: false, error: "Purpose must be 'cover' or 'gallery'." };
    }
    cleanPurpose = purpose as MediaPurpose;
  }

  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, error: "Choose at least one file." };
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return { ok: false, error: `You can upload at most ${MAX_FILES_PER_REQUEST} files at a time.` };
  }

  const valid: ValidFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const label = `File ${i + 1}`;
    if (typeof f !== "object" || f === null) {
      return { ok: false, error: `${label}: invalid entry.` };
    }
    const { type, size } = f as Record<string, unknown>;

    if (typeof type !== "string" || !Object.hasOwn(ALLOWED_TYPES, type)) {
      return { ok: false, error: `${label}: unsupported file type. Use JPEG, PNG, WebP, MP4 or WebM.` };
    }
    const rule: AllowedType = ALLOWED_TYPES[type];

    if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
      return { ok: false, error: `${label}: invalid file size.` };
    }
    if (size > rule.maxBytes) {
      return { ok: false, error: `${label}: too large. ${rule.kind === "image" ? "Images" : "Videos"} can be up to ${formatMB(rule.maxBytes)}.` };
    }

    valid.push({ index: i, mimeType: type, sizeBytes: size, kind: rule.kind, ext: rule.ext });
  }

  if (cleanPurpose === "cover") {
    if (valid.length !== 1 || valid[0].kind !== "image") {
      return { ok: false, error: "A cover must be exactly one image." };
    }
  }

  return { ok: true, value: { eventId: eventId.toLowerCase(), purpose: cleanPurpose, files: valid } };
}

/** Caption for PATCH /api/media/items/[id]. Empty string clears it. */
export function validateCaption(input: unknown): Validation<string | null> {
  if (input === null) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "Caption must be text." };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(input)) return { ok: false, error: "Caption contains invalid characters." };
  const clean = input.trim().replace(/\s+/g, " ");
  if (clean.length === 0) return { ok: true, value: null };
  if (clean.length > MAX_CAPTION_LENGTH) {
    return { ok: false, error: `Caption can be at most ${MAX_CAPTION_LENGTH} characters.` };
  }
  return { ok: true, value: clean };
}
