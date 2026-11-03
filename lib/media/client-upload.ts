// ============================================================
// Browser-side helpers for the upload screen (fetch + XHR)
// ============================================================
//
// Thin wrappers only; every decision lives in upload-queue.ts (tested).
// XHR is used for the S3 upload because fetch() cannot report upload progress.
// ============================================================

import type { MediaPurpose } from "./policy";
import type { CompleteOutcome } from "./upload-queue";

export interface SignedUpload {
  index: number;
  mediaId: string;
  url: string;
  fields: Record<string, string>;
}

export type InitResult =
  | { ok: true; uploads: SignedUpload[] }
  | { ok: false; error: string; retryable: boolean };

export async function initUploads(
  eventId: string,
  purpose: MediaPurpose,
  files: Array<{ type: string; size: number }>
): Promise<InitResult> {
  try {
    const res = await fetch("/api/media/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, purpose, files }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && Array.isArray(json.data?.uploads)) {
      return { ok: true, uploads: json.data.uploads as SignedUpload[] };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Your session has ended. Sign in again.", retryable: false };
    }
    return {
      ok: false,
      error: typeof json?.error === "string" ? json.error : "Could not start the upload.",
      // Server trouble may pass; bad input (400), missing event (404) or a cover conflict (409) will not.
      retryable: res.status >= 500 || res.status === 429,
    };
  } catch {
    return { ok: false, error: "Network error. Check your connection.", retryable: true };
  }
}

export type S3Result = { ok: true } | { ok: false; error: string };

/** POST the file to S3 using the signed form. The file field MUST come last. */
export function postToS3(
  signed: { url: string; fields: Record<string, string> },
  file: File,
  onProgress: (percent: number) => void
): Promise<S3Result> {
  return new Promise((resolve) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", signed.url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true });
      // 403 here almost always means the signed link expired (10 minutes).
      resolve({
        ok: false,
        error:
          xhr.status === 403
            ? "The upload link expired. Try again."
            : `Upload failed (${xhr.status}). Try again.`,
      });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Network error. Check your connection." });
    xhr.onabort = () => resolve({ ok: false, error: "Upload cancelled." });
    xhr.send(form);
  });
}

export async function completeOne(mediaId: string): Promise<CompleteOutcome> {
  try {
    const res = await fetch("/api/media/uploads/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaIds: [mediaId] }),
    });
    const json = await res.json().catch(() => null);
    const result = json?.data?.results?.[0];
    if (res.ok && json?.success && result && typeof result.state === "string") {
      return result as CompleteOutcome;
    }
    return { state: "error" };
  } catch {
    return { state: "error" };
  }
}
