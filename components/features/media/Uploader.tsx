"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Film, Image as ImageIcon, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import type { MediaPurpose } from "@/lib/media/policy";
import {
  buildQueueItem,
  chunkForInit,
  formatBytes,
  pickToStart,
  queueReducer,
  summarize,
  isBusy,
  type QueueItem,
} from "@/lib/media/upload-queue";
import { completeOne, initUploads, postToS3 } from "@/lib/media/client-upload";
import { isHeicFile } from "@/lib/media/heic";
import { convertHeicToJpeg } from "./convert-heic";

// HEIC (iPhone photos) is accepted by the picker and converted to JPEG in the browser first.
const HEIC_ACCEPT = "image/heic,image/heif,.heic,.heif";
const IMAGE_ACCEPT = `image/jpeg,image/png,image/webp,${HEIC_ACCEPT}`;
const ACCEPT = `${IMAGE_ACCEPT},video/mp4,video/webm`;

const STATUS_LABEL: Record<string, string> = {
  queued: "Waiting…",
  signing: "Preparing…",
  waiting: "Waiting for a free slot…",
  verifying: "Checking the file…",
  processing: "Uploaded · being prepared for the site",
  live: "Uploaded · live",
};

export function Uploader({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [items, dispatch] = useReducer(queueReducer, [] as QueueItem[]);
  const [purpose, setPurpose] = useState<MediaPurpose>("gallery");
  const [dragging, setDragging] = useState(false);
  /** iPhone photos still being converted to JPEG (shown as a message). */
  const [converting, setConverting] = useState(0);

  // Non-state bookkeeping: the File objects, signed forms, previews, and
  // "already started" guards (so React StrictMode's double effects cannot
  // start the same upload twice).
  const filesRef = useRef(new Map<string, File>());
  const signedRef = useRef(new Map<string, { url: string; fields: Record<string, string> }>());
  const previewsRef = useRef(new Map<string, string>());
  const signingStarted = useRef(new Set<string>());
  const uploadStarted = useRef(new Set<string>());
  const completing = useRef(new Set<string>());
  const purposeRef = useRef(purpose);
  purposeRef.current = purpose;

  const summary = summarize(items);
  const hasUnfinished = items.some((i) => i.state !== "live" && i.state !== "processing" && i.state !== "error");

  // ── 1. Sign queued files (one init request per group of up to 20) ──────
  useEffect(() => {
    const queued = items.filter((i) => i.state === "queued" && !signingStarted.current.has(i.id));
    if (queued.length === 0) return;
    const ids = queued.map((i) => i.id);
    ids.forEach((id) => signingStarted.current.add(id));
    dispatch({ type: "signing", ids });

    for (const group of chunkForInit(ids)) {
      const groupItems = group.map((id) => queued.find((q) => q.id === id)!);
      void initUploads(eventId, purposeRef.current, groupItems.map((i) => ({ type: i.mimeType, size: i.size }))).then((res) => {
        if (!res.ok) {
          for (const id of group) dispatch({ type: "fail", id, message: res.error, retryable: res.retryable });
          return;
        }
        const byIndex = new Map(res.uploads.map((u) => [u.index, u]));
        group.forEach((id, index) => {
          const u = byIndex.get(index);
          if (!u) {
            dispatch({ type: "fail", id, message: "Could not start the upload.", retryable: true });
            return;
          }
          signedRef.current.set(id, { url: u.url, fields: u.fields });
          dispatch({ type: "signed", id, mediaId: u.mediaId });
        });
      });
    }
  }, [items, eventId]);

  // ── 2. Start uploads, at most 3 at a time ──────────────────────────────
  useEffect(() => {
    for (const id of pickToStart(items)) {
      if (uploadStarted.current.has(id)) continue;
      const file = filesRef.current.get(id);
      const signed = signedRef.current.get(id);
      if (!file || !signed) continue;
      uploadStarted.current.add(id);
      dispatch({ type: "start", id });
      void postToS3(signed, file, (p) => dispatch({ type: "progress", id, progress: p })).then((res) => {
        signedRef.current.delete(id); // a signature is single-use
        if (res.ok) dispatch({ type: "uploaded", id });
        else dispatch({ type: "fail", id, message: res.error, retryable: true });
      });
    }
  }, [items]);

  // ── 3. Ask the server to verify finished uploads ───────────────────────
  useEffect(() => {
    for (const item of items) {
      if (item.state !== "verifying" || !item.mediaId || completing.current.has(item.id)) continue;
      completing.current.add(item.id);
      void completeOne(item.mediaId).then((outcome) => {
        completing.current.delete(item.id);
        dispatch({ type: "completed", id: item.id, outcome });
      });
    }
  }, [items]);

  // ── 4. Refresh the list below when a batch finishes ────────────────────
  const wasBusy = useRef(false);
  useEffect(() => {
    const busy = summary.inFlight > 0;
    if (wasBusy.current && !busy && summary.done > 0) router.refresh();
    wasBusy.current = busy;
  }, [summary.inFlight, summary.done, router]);

  // ── Warn before leaving while uploads are running ──────────────────────
  useEffect(() => {
    if (summary.inFlight === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [summary.inFlight]);

  // Free the preview URLs when leaving the page.
  useEffect(() => {
    const previews = previewsRef.current;
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    let files = Array.from(list);
    if (purposeRef.current === "cover") files = files.slice(0, 1); // one cover per event
    if (files.length === 0) return;

    // iPhone photos: convert to JPEG here, one at a time (each decode needs real memory).
    // A file that fails to convert stays as it is and is rejected by the normal pre-check.
    const heicCount = files.filter((f) => isHeicFile(f)).length;
    if (heicCount > 0) {
      setConverting((n) => n + heicCount);
      const converted: File[] = [];
      for (const file of files) {
        if (!isHeicFile(file)) {
          converted.push(file);
          continue;
        }
        try {
          converted.push(await convertHeicToJpeg(file));
        } catch {
          converted.push(file);
        } finally {
          setConverting((n) => n - 1);
        }
      }
      files = converted;
    }

    const built = files.map((file) => {
      const id = crypto.randomUUID();
      const item = buildQueueItem(id, { name: file.name, type: file.type, size: file.size }, purposeRef.current);
      if (item.state !== "error") {
        filesRef.current.set(id, file);
        if (item.kind === "image") previewsRef.current.set(id, URL.createObjectURL(file));
      }
      return item;
    });
    dispatch({ type: "add", items: built });
  }, []);

  const forget = (id: string) => {
    filesRef.current.delete(id);
    signedRef.current.delete(id);
    const url = previewsRef.current.get(id);
    if (url) URL.revokeObjectURL(url);
    previewsRef.current.delete(id);
    signingStarted.current.delete(id);
    uploadStarted.current.delete(id);
    completing.current.delete(id);
  };

  const retry = (item: QueueItem) => {
    // Starting over needs fresh guards; re-verifying keeps them.
    if (!(item.uploaded && item.mediaId)) {
      signingStarted.current.delete(item.id);
      uploadStarted.current.delete(item.id);
    }
    completing.current.delete(item.id);
    dispatch({ type: "retry", id: item.id });
  };

  const remove = (item: QueueItem) => {
    if (isBusy(item.state)) return;
    forget(item.id);
    dispatch({ type: "remove", id: item.id });
  };

  const clearFinished = () => {
    items.filter((i) => i.state === "live" || i.state === "processing").forEach((i) => forget(i.id));
    dispatch({ type: "clearFinished" });
  };

  return (
    <section aria-labelledby="upload-heading" className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="upload-heading" className="text-lg font-semibold">Upload</h2>
        <div role="group" aria-label="What are you uploading?" className="inline-flex rounded-xl border border-white/[0.08] p-0.5 text-xs">
          {(["gallery", "cover"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={purpose === p}
              disabled={hasUnfinished}
              onClick={() => setPurpose(p)}
              className={`rounded-[10px] px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                purpose === p ? "bg-[#6C63FF] text-white" : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              {p === "gallery" ? "Photos & videos" : "Event cover"}
            </button>
          ))}
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-[#6C63FF] ${
          dragging ? "border-[#6C63FF] bg-[#6C63FF]/10" : "border-white/[0.12] hover:border-white/25"
        }`}
      >
        <UploadCloud className="h-7 w-7 text-[#8B83FF]" aria-hidden="true" />
        <span className="text-sm font-medium">
          {purpose === "cover" ? "Choose one cover image" : "Drop files here, or click to browse"}
        </span>
        <span className="text-xs text-[#71717A]">
          JPEG, PNG, WebP, iPhone HEIC up to 25 MB{purpose === "gallery" ? " · MP4, WebM up to 500 MB" : ""}
        </span>
        <input
          type="file"
          className="sr-only"
          accept={purpose === "cover" ? IMAGE_ACCEPT : ACCEPT}
          multiple={purpose === "gallery"}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ""; // allow picking the same file again
          }}
        />
      </label>

      {converting > 0 && (
        <p role="status" className="flex items-center gap-2 text-xs text-[#A1A1AA]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Converting {converting} iPhone {converting === 1 ? "photo" : "photos"} to JPEG…
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-xs text-[#A1A1AA]">
              {summary.done} of {summary.total} done
              {summary.failed > 0 && <span className="text-red-400"> · {summary.failed} need attention</span>}
              {summary.inFlight > 0 && <span> · {summary.inFlight} in progress</span>}
            </p>
            {summary.done > 0 && (
              <button type="button" onClick={clearFinished} className="text-xs text-[#8B83FF] hover:underline">
                Clear finished
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {items.map((item) => (
              <UploadRow key={item.id} item={item} preview={previewsRef.current.get(item.id)} onRetry={() => retry(item)} onRemove={() => remove(item)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function UploadRow({
  item,
  preview,
  onRetry,
  onRemove,
}: {
  item: QueueItem;
  preview: string | undefined;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const uploading = item.state === "uploading";
  const done = item.state === "live" || item.state === "processing";
  const status =
    item.state === "error" ? item.error : uploading ? `Uploading… ${item.progress}%` : STATUS_LABEL[item.state];

  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-2.5">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.04]">
        {item.kind === "video" ? (
          <Film className="h-5 w-5 text-[#A1A1AA]" aria-hidden="true" />
        ) : (
          <ImageIcon className="h-5 w-5 text-[#A1A1AA]" aria-hidden="true" />
        )}
        {preview && (
          // The icon above shows through if the file is not a decodable image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="absolute inset-0 h-full w-full bg-[#0b0b10] object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${item.state === "error" ? "text-red-400" : done ? "text-emerald-400" : "text-[#A1A1AA]"}`}>
          {item.state === "error" && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          {done && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          {(item.state === "signing" || item.state === "verifying") && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
          <span>
            {formatBytes(item.size)} · {status}
          </span>
        </p>
        {uploading && (
          <div
            role="progressbar"
            aria-label={`Uploading ${item.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.progress}
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"
          >
            <div className="h-full rounded-full bg-[#6C63FF] transition-[width] duration-150" style={{ width: `${item.progress}%` }} />
          </div>
        )}
      </div>

      {item.state === "error" && item.retryable && (
        <button type="button" onClick={onRetry} aria-label={`Retry ${item.name}`} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 text-xs hover:bg-white/[0.06]">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </button>
      )}
      {!isBusy(item.state) && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.name} from the list`} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#71717A] hover:bg-white/[0.06] hover:text-white">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
