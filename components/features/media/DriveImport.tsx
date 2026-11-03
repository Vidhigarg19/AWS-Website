"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Link2, Loader2, Trash2 } from "lucide-react";

interface ImportResult {
  added: number;
  duplicates: number;
  unsupported: number;
  overLimit: number;
  truncated: boolean;
}

/** Summary line shown after an import. Pure, so the wording is easy to check. */
export function describeImport(r: ImportResult): string {
  if (r.added === 0 && r.duplicates > 0) return "Nothing new: those files were already linked.";
  if (r.added === 0) return "No photos or videos found in that link.";
  const parts = [`Linked ${r.added} ${r.added === 1 ? "file" : "files"} from Drive.`];
  if (r.duplicates > 0) parts.push(`${r.duplicates} already linked.`);
  if (r.unsupported > 0) parts.push(`${r.unsupported} skipped (not a photo/video, or a subfolder).`);
  if (r.overLimit > 0 || r.truncated) parts.push("Folder is large: import again to add the rest.");
  return parts.join(" ");
}

function filesLabel(n: number): string {
  return `${n} ${n === 1 ? "file" : "files"}`;
}

export function DriveImport({
  eventId,
  removableCount = 0,
  ownOnly = false,
}: {
  eventId: string;
  /** Drive items on this event the signed-in user may remove. */
  removableCount?: number;
  /** True for media members: they can only remove the Drive items they imported. */
  ownOnly?: boolean;
}) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const removeAll = async () => {
    if (busy || removing) return;
    setRemoving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/media/drive/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        const removed = Number(json.data?.removed ?? 0);
        setMessage(
          removed > 0
            ? `Removed ${filesLabel(removed)} from the site. They are still in your Google Drive.`
            : "There were no Drive files to remove."
        );
        setConfirmingRemove(false);
        router.refresh();
      } else {
        setError(typeof json?.error === "string" ? json.error : "Something went wrong.");
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setRemoving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || removing || link.trim() === "") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/media/drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, link }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setMessage(describeImport(json.data as ImportResult));
        setLink("");
        router.refresh();
      } else {
        setError(typeof json?.error === "string" ? json.error : "Something went wrong.");
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="drive-heading" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 id="drive-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Link2 className="h-4 w-4 text-[#8B5CF6]" aria-hidden="true" /> Add from a Google Drive link
      </h3>
      <p className="mt-1 text-xs text-[#A1A1AA]">
        Nothing is uploaded: the site shows the files straight from Drive. Set the folder to
        &ldquo;Anyone with the link&rdquo; (Viewer) first. If you remove or unshare a file in Drive, it disappears from the site.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="drive-link" className="sr-only">Google Drive link</label>
        <input
          id="drive-link"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          disabled={busy || removing}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#8B5CF6] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || removing || link.trim() === ""}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Importing…" : "Import"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 flex items-start gap-2 text-xs text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {message}
        </p>
      )}

      {removableCount > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#A1A1AA]">
            {filesLabel(removableCount)} linked from Drive{ownOnly ? " by you" : ""} on this event.
          </p>
          {confirmingRemove ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-red-300">
                Remove {removableCount === 1 ? "it" : `all ${removableCount}`} from the site? Your Google Drive is not changed.
              </span>
              <button
                type="button"
                onClick={removeAll}
                disabled={busy || removing}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/90 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {removing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {removing ? "Removing…" : "Remove all"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                disabled={removing}
                className="rounded-lg px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setError(null);
                setConfirmingRemove(true);
              }}
              disabled={busy || removing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove all Drive files
            </button>
          )}
        </div>
      )}
    </section>
  );
}
