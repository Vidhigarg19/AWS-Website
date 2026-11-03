"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import {
  ATTENDEE_FIELDS,
  ATTENDEE_FIELD_LABELS,
  ATTENDEE_IMPORT_MAX_FILE_BYTES,
  ATTENDEE_IMPORT_MAX_ROWS,
  parseAttendeeSheet,
  type ParsedAttendeeRow,
} from "@/lib/attendance/import";

/** Must not exceed the API's per-request limit (participants/import/route.ts). */
const BATCH_SIZE = 50;

type RowStatus = "ready" | "error" | "already_added" | "imported";

interface PreviewRow extends ParsedAttendeeRow {
  status: RowStatus;
  message: string;
}

interface ServerResult {
  rowNumber: number;
  status: "imported" | "already_added" | "error";
  message: string;
}

interface AttendeeImportDialogProps {
  eventId: string;
  eventName: string;
  /** Null when the event has no date yet: certificates need one, so import is blocked. */
  eventDate: string | null;
  /** Emails already in this event's attendee list (shown as "Already added" in the preview). */
  existingEmails: string[];
  onImported: () => Promise<void> | void;
}

function toPreview(rows: ParsedAttendeeRow[], existing: Set<string>): PreviewRow[] {
  return rows.map((row) => {
    if (!row.result.ok) return { ...row, status: "error", message: row.result.error };
    if (existing.has(row.result.value.email)) {
      return { ...row, status: "already_added", message: "Already an attendee of this event." };
    }
    return { ...row, status: "ready", message: "" };
  });
}

const STATUS_STYLE: Record<RowStatus, string> = {
  ready: "text-emerald-400",
  imported: "text-emerald-400",
  already_added: "text-amber-300",
  error: "text-red-400",
};

const STATUS_LABEL: Record<RowStatus, string> = {
  ready: "Ready",
  imported: "Imported",
  already_added: "Already added",
  error: "Error",
};

export function AttendeeImportDialog({ eventId, eventName, eventDate, existingEmails, onImported }: AttendeeImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(
    () => new Set(existingEmails.map((e) => e.trim().toLowerCase())),
    [existingEmails]
  );
  const count = (s: RowStatus) => rows.filter((r) => r.status === s).length;
  const readyCount = count("ready");

  const loadMatrix = (matrix: unknown[][], name: string) => {
    setSourceName(name);
    setFinished(false);
    setProgress(null);
    try {
      setRows(toPreview(parseAttendeeSheet(matrix), existing));
      setError("");
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Could not read the attendee data.");
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.size > ATTENDEE_IMPORT_MAX_FILE_BYTES) {
      setRows([]);
      setError("The file must be 2 MB or smaller.");
      return;
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setRows([]);
      setError("Choose an .xlsx, .xls or .csv file.");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error("The file has no worksheets.");
      // raw: true keeps College IDs as numbers, so long IDs are not shown as 2.02E+08.
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: false });
      loadMatrix(matrix, file.name);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
  };

  const handlePaste = () => {
    const lines = pasteText.split(/\r?\n/).filter((line) => line.trim() !== "");
    loadMatrix(lines.map((line) => line.split("\t")), "Pasted cells");
  };

  const downloadSample = async () => {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      ATTENDEE_FIELDS.map((f) => ATTENDEE_FIELD_LABELS[f]),
      ["Piyush Rawat", "piyush@tulas.edu.in", "202609018", "B.Tech"],
      ["Diya Sen", "diya@tulas.edu.in", "202609019", "BCA"],
    ]);
    sheet["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 18 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendees");
    XLSX.writeFile(book, "attendees-sample.xlsx");
  };

  const runImport = async () => {
    const ready = rows.filter((r) => r.status === "ready" && r.result.ok);
    if (ready.length === 0 || importing) return;
    setImporting(true);
    setError("");
    setProgress({ done: 0, total: ready.length });

    const byRow = new Map<number, ServerResult>();
    try {
      for (let i = 0; i < ready.length; i += BATCH_SIZE) {
        const batch = ready.slice(i, i + BATCH_SIZE);
        const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/participants/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: batch.map((r) => (r.result.ok ? { rowNumber: r.rowNumber, ...r.result.value } : null)),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(typeof json?.error === "string" ? json.error : "The import failed. Nothing more was sent.");
        }
        for (const r of (json.data?.results ?? []) as ServerResult[]) byRow.set(r.rowNumber, r);
        setProgress({ done: Math.min(i + batch.length, ready.length), total: ready.length });
        setRows((prev) =>
          prev.map((row) => {
            const r = byRow.get(row.rowNumber);
            return r ? { ...row, status: r.status, message: r.message } : row;
          })
        );
      }
      setFinished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setImporting(false);
      if (byRow.size > 0) await onImported();
    }
  };

  const close = () => {
    if (importing) return;
    setOpen(false);
    setRows([]);
    setPasteText("");
    setSourceName("");
    setError("");
    setProgress(null);
    setFinished(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] flex items-center gap-2 transition-all cursor-pointer"
        title="Add attendees to this event from an Excel / CSV sheet"
      >
        <Upload className="w-4 h-4 text-amber-400" />
        <span className="hidden sm:inline">Import Excel</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/75 p-2 backdrop-blur-sm sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendee-import-title"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
            className="my-auto flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0F0F16] shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-4 sm:p-5">
              <div className="min-w-0">
                <h2 id="attendee-import-title" className="text-lg font-bold text-white">Import attendees</h2>
                <p className="mt-1 truncate text-xs text-[#A1A1AA]">
                  Event: <span className="font-medium text-white">{eventName}</span>
                </p>
                <p className="mt-1 text-xs text-[#71717A]">
                  Columns: Full Name, Email, College ID (numbers only), Course. Each new attendee gets a participation
                  certificate, the same as submitting the attendance form. Upload .xlsx, .xls or .csv (max 2 MB,{" "}
                  {ATTENDEE_IMPORT_MAX_ROWS} rows), or paste cells copied from Excel / Google Sheets.
                </p>
              </div>
              <button type="button" onClick={close} disabled={importing} aria-label="Close import dialog" className="rounded-lg p-2 text-[#A1A1AA] hover:bg-white/[0.06] hover:text-white disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
              {!eventDate ? (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This event has no date yet. Set the date (Edit Event) before importing: certificates show the event date.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void downloadSample()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] px-3 text-xs font-medium text-[#D4D4D8] hover:bg-white/[0.05]">
                      <Download className="h-3.5 w-3.5" /> Download sample sheet
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing} className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Choose Excel / CSV
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        void handleFile(e.target.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                    {sourceName && <span className="text-xs text-[#71717A]">{sourceName}</span>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="attendee-paste" className="block text-xs font-semibold text-[#D4D4D8]">Or paste cells (header row included)</label>
                    <textarea
                      id="attendee-paste"
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={3}
                      disabled={importing}
                      placeholder={ATTENDEE_FIELDS.map((f) => ATTENDEE_FIELD_LABELS[f]).join("\t")}
                      className="w-full rounded-xl border border-white/[0.1] bg-[#09090E] p-3 font-mono text-xs text-white placeholder:text-[#52525B] focus:border-amber-500 focus:outline-none"
                    />
                    <button type="button" onClick={handlePaste} disabled={!pasteText.trim() || importing} className="h-8 rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-[#D4D4D8] hover:bg-white/[0.05] disabled:opacity-40">
                      Preview pasted rows
                    </button>
                  </div>
                </>
              )}

              {error && (
                <p role="alert" className="flex items-start gap-2 text-xs text-red-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}

              {rows.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#A1A1AA]">
                      {finished
                        ? `${count("imported")} imported, ${count("already_added")} already added, ${count("error")} errors`
                        : `${readyCount} ready, ${count("already_added")} already added, ${count("error")} errors`}
                    </p>
                    <button
                      type="button"
                      onClick={() => void runImport()}
                      disabled={readyCount === 0 || importing || finished}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {importing && progress
                        ? `Importing ${progress.done} / ${progress.total}…`
                        : finished
                        ? "Import complete"
                        : `Import ${readyCount} ${readyCount === 1 ? "attendee" : "attendees"}`}
                    </button>
                  </div>

                  <div className="max-w-full overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[#71717A]">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          {ATTENDEE_FIELDS.map((f) => (
                            <th key={f} className="px-3 py-2">{ATTENDEE_FIELD_LABELS[f]}</th>
                          ))}
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {rows.map((row) => {
                          const shown = row.result.ok ? row.result.value : row.cells;
                          return (
                            <tr key={row.rowNumber} className="text-[#D4D4D8]">
                              <td className="px-3 py-2 text-[#71717A]">{row.rowNumber}</td>
                              <td className="px-3 py-2">{shown.fullName}</td>
                              <td className="px-3 py-2">{shown.email}</td>
                              <td className="px-3 py-2 font-mono">{shown.collegeId}</td>
                              <td className="px-3 py-2">{shown.course}</td>
                              <td className={`px-3 py-2 ${STATUS_STYLE[row.status]}`}>
                                {STATUS_LABEL[row.status]}
                                {row.message ? `: ${row.message}` : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
