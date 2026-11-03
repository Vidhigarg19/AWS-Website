// ============================================================
// Small display helpers shared by the public media pages — PURE
// ============================================================

/** "1 November 2026", or a fallback for an event with no date yet. */
export function formatEventDate(iso: string | null, fallback = "Date to be announced"): string {
  if (!iso) return fallback;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** "1:45" for a 105-second clip. Falls back to "Video" when the duration isn't known yet. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "Video";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
