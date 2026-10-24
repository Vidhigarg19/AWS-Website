"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Link2, Loader2 } from "lucide-react";

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

export function DriveImport({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || link.trim() === "") return;
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
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#8B5CF6] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || link.trim() === ""}
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
    </section>
  );
}
