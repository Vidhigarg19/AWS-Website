"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

interface ImportRow {
  rowNumber: number;
  rank: string;
  fullName: string;
  email: string;
  rollNo: string;
  course: string;
  status: "ready" | "error" | "already_added";
  message: string;
}

interface ImportResult {
  rowNumber: number;
  status: "imported" | "already_added" | "error";
  message: string;
  fullName: string;
  email: string;
}

interface TopPerformerImportDialogProps {
  existingEmails: string[];
  onImported: () => Promise<void>;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 500;
const HEADER_ALIASES: Record<string, keyof Pick<ImportRow, "rank" | "fullName" | "email" | "rollNo" | "course">> = {
  rank: "rank",
  position: "rank",
  name: "fullName",
  "student name": "fullName",
  "full name": "fullName",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  "roll no": "rollNo",
  "roll no.": "rollNo",
  "roll number": "rollNo",
  "enrollment no": "rollNo",
  "enrolment no": "rollNo",
  course: "course",
  branch: "course",
  program: "course",
};

const FIELD_LABELS: Record<keyof Pick<ImportRow, "rank" | "fullName" | "email" | "rollNo" | "course">, string> = {
  rank: "Rank",
  fullName: "Name",
  email: "Email",
  rollNo: "Roll No",
  course: "Course",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(value: unknown, limit: number): string {
  return String(value ?? "").trim().slice(0, limit);
}

function validateRow(row: Omit<ImportRow, "status" | "message">, existingEmails: Set<string>, seenEmails: Set<string>): ImportRow {
  const email = row.email.toLowerCase();
  const validEmail = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (validEmail && seenEmails.has(email)) {
    return { ...row, status: "error", message: "Email is duplicated in this file." };
  }
  if (validEmail) seenEmails.add(email);

  const rankValue = row.rank.trim();
  const rank = Number(rankValue);
  if (!rankValue || !Number.isSafeInteger(rank) || rank < 1 || rank > 2147483647) {
    return { ...row, status: "error", message: "Rank must be a whole number >= 1." };
  }
  if (row.fullName.length < 2) {
    return { ...row, status: "error", message: "Name must be at least 2 characters." };
  }
  if (!validEmail) {
    return { ...row, status: "error", message: "Enter a valid email address." };
  }
  if (!row.rollNo) {
    return { ...row, status: "error", message: "Roll No is required." };
  }
  if (!row.course) {
    return { ...row, status: "error", message: "Course is required." };
  }
  if (existingEmails.has(email)) {
    return { ...row, status: "already_added", message: "Already added to this event." };
  }
  return { ...row, status: "ready", message: "" };
}

function parseMatrix(matrix: unknown[][], existingEmails: Set<string>): ImportRow[] {
  let headerIndex = -1;
  let columns: Partial<Record<keyof Pick<ImportRow, "rank" | "fullName" | "email" | "rollNo" | "course">, number>> = {};
  for (let i = 0; i < matrix.length; i += 1) {
    const mapped: typeof columns = {};
    (matrix[i] || []).forEach((value, columnIndex) => {
      const key = HEADER_ALIASES[normalizeHeader(value)];
      if (key && mapped[key] === undefined) mapped[key] = columnIndex;
    });
    if (["rank", "fullName", "email", "rollNo", "course"].every((key) => mapped[key as keyof typeof mapped] !== undefined)) {
      headerIndex = i;
      columns = mapped;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error("Could not find a header row. Include Rank, Name, Email, Roll No, and Course.");
  }

  const dataRows = matrix.slice(headerIndex + 1).filter((cells) => cells.some((value) => String(value ?? "").trim()));
  if (dataRows.length > MAX_ROWS) throw new Error(`The import is limited to ${MAX_ROWS} rows.`);

  const seenEmails = new Set<string>();
  return dataRows.map((cells, index) => {
    const getCell = (key: keyof typeof columns, maxLength: number) =>
      cellText(cells[columns[key] ?? -1], maxLength);
    const rawEmail = getCell("email", 254).toLowerCase();
    const row = {
      rowNumber: headerIndex + index + 2,
      rank: getCell("rank", 32),
      fullName: getCell("fullName", 100),
      email: rawEmail,
      rollNo: getCell("rollNo", 100),
      course: getCell("course", 100),
    };
    return validateRow(row, existingEmails, seenEmails);
  });
}

export function TopPerformerImportDialog({ existingEmails, onImported }: TopPerformerImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingEmailSet = useMemo(
    () => new Set(existingEmails.map((email) => email.trim().toLowerCase())),
    [existingEmails]
  );
  const readyCount = rows.filter((row) => row.status === "ready").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  const setMatrix = (matrix: unknown[][], sourceName: string) => {
    try {
      setRows(parseMatrix(matrix, existingEmailSet));
      setFileName(sourceName);
      setResults([]);
      setError("");
    } catch (parseError) {
      setRows([]);
      setFileName(sourceName);
      setError(parseError instanceof Error ? parseError.message : "Could not parse the provided data.");
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setResults([]);
    if (file.size > MAX_FILE_BYTES) {
      setRows([]);
      setError("The file must be 2 MB or smaller.");
      return;
    }
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setRows([]);
      setError("Choose an .xlsx or .csv file.");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
      if (!sheet) throw new Error("The selected file has no worksheets.");

      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
        for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
          const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          const cell = sheet[address];
          if (cell?.f) {
            const matrixRow = matrix[rowIndex - range.s.r];
            if (matrixRow) matrixRow[columnIndex - range.s.c] = `=${cell.f}`;
          }
        }
      }
      setMatrix(matrix, file.name);
    } catch (fileError) {
      setRows([]);
      setError(fileError instanceof Error ? fileError.message : "Could not read this file.");
    }
  };

  const handlePaste = () => {
    const lines = pasteText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > MAX_ROWS + 1) {
      setError(`The import is limited to ${MAX_ROWS} data rows.`);
      setRows([]);
      return;
    }
    setMatrix(lines.map((line) => line.split("\t")), "Pasted spreadsheet data");
  };

  const downloadSample = () => {
    const sample = [
      ["Rank", "Name", "Email", "Roll No", "Course"],
      ["1", "Aarav Sharma", "aarav@example.com", "23CS001", "B.Tech CSE"],
      ["2", "Diya Patel", "diya@example.com", "23CS002", "B.Tech CSE"],
    ].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([sample], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "top-performers-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importRows = async () => {
    const ready = rows.filter((row) => row.status === "ready");
    if (ready.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/top-performers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: ready.map((row) => ({
            rowNumber: row.rowNumber,
            rank: Number(row.rank),
            fullName: row.fullName,
            email: row.email,
            rollNo: row.rollNo,
            course: row.course,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not import top performers.");
      setResults(json.data?.results || []);
      await onImported();
      const summary = json.data?.summary;
      if (summary) {
        setError("");
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import top performers.");
    } finally {
      setImporting(false);
    }
  };

  const close = () => {
    if (importing) return;
    setOpen(false);
    setRows([]);
    setPasteText("");
    setFileName("");
    setError("");
    setResults([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 text-xs font-semibold text-[#D4D4D8] hover:bg-white/[0.07]"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Import from Excel / Sheet
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/75 p-2 backdrop-blur-sm sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="top-performer-import-title"
            data-lenis-prevent
            onWheel={(event) => event.stopPropagation()}
            className="my-auto flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0F0F16] shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-4 sm:p-5">
              <div>
                <h2 id="top-performer-import-title" className="text-lg font-bold text-white">Import Top Performers</h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">Upload .xlsx or .csv (max 2 MB, 500 rows), or paste tab-separated cells.</p>
                <p className="mt-1 text-xs text-[#71717A]">From Google Sheets: File -&gt; Download -&gt; Excel/CSV, or copy the cells and paste</p>
              </div>
              <button type="button" onClick={close} aria-label="Close import dialog" className="rounded-lg p-2 text-[#A1A1AA] hover:bg-white/[0.06] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadSample} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] px-3 text-xs font-medium text-[#D4D4D8] hover:bg-white/[0.05]">
                  <Download className="h-3.5 w-3.5" /> Download sample file
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-500">
                  <Upload className="h-3.5 w-3.5" /> Choose Excel / CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(event) => {
                    void handleFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                {fileName && <span className="self-center text-xs text-[#71717A]">{fileName}</span>}
              </div>

              <div className="space-y-2">
                <label htmlFor="top-performer-paste" className="block text-xs font-semibold text-[#D4D4D8]">Paste spreadsheet cells</label>
                <textarea
                  id="top-performer-paste"
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  rows={4}
                  placeholder={"Rank\tName\tEmail\tRoll No\tCourse"}
                  className="w-full rounded-xl border border-white/[0.1] bg-[#09090E] p-3 font-mono text-xs text-white placeholder:text-[#52525B] focus:border-amber-500 focus:outline-none"
                />
                <button type="button" onClick={handlePaste} disabled={!pasteText.trim()} className="h-8 rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-[#D4D4D8] hover:bg-white/[0.05] disabled:opacity-40">
                  Preview pasted rows
                </button>
              </div>

              {error && <p role="alert" className="flex items-start gap-2 text-xs text-red-400"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}

              {rows.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#A1A1AA]">{readyCount} ready, {errorCount} errors, {rows.filter((row) => row.status === "already_added").length} already added</p>
                    <button type="button" onClick={() => void importRows()} disabled={readyCount === 0 || importing || results.length > 0} className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45">
                      {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {importing ? "Importing…" : results.length > 0 ? "Import complete" : `Import ${readyCount} valid rows`}
                    </button>
                  </div>
                  <div className="max-w-full overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[#71717A]">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          {(["rank", "fullName", "email", "rollNo", "course"] as const).map((key) => <th key={key} className="px-3 py-2">{FIELD_LABELS[key]}</th>)}
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {rows.map((row) => {
                          const result = results.find((item) => item.rowNumber === row.rowNumber);
                          const status = result?.status || row.status;
                          const message = result?.message || row.message;
                          return (
                            <tr key={row.rowNumber} className="text-[#D4D4D8]">
                              <td className="px-3 py-2 text-[#71717A]">{row.rowNumber}</td>
                              <td className="px-3 py-2">{row.rank}</td>
                              <td className="px-3 py-2">{row.fullName}</td>
                              <td className="px-3 py-2">{row.email}</td>
                              <td className="px-3 py-2">{row.rollNo}</td>
                              <td className="px-3 py-2">{row.course}</td>
                              <td className={`px-3 py-2 ${status === "ready" || status === "imported" ? "text-emerald-400" : status === "already_added" ? "text-amber-300" : "text-red-400"}`}>
                                {status === "ready" ? "Ready" : status === "imported" ? "Imported" : status === "already_added" ? "Already added" : "Error"}{message ? `: ${message}` : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {results.length > 0 && (
                    <p role="status" className="text-xs text-emerald-400">
                      Imported {results.filter((result) => result.status === "imported").length}; skipped {results.filter((result) => result.status !== "imported").length}.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
