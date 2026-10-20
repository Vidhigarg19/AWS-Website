import { Film, Image as ImageIcon } from "lucide-react";
import { formatBytes } from "@/lib/media/upload-queue";

export interface MediaListItem {
  id: string;
  kind: "image" | "video";
  purpose: "cover" | "gallery";
  status: "processing" | "ready" | "hidden" | string;
  size_bytes: number;
  created_at: string;
  mine: boolean;
}

const STATUS: Record<string, { label: string; className: string }> = {
  ready: { label: "Live", className: "bg-emerald-500/10 text-emerald-400" },
  processing: { label: "Processing", className: "bg-amber-500/10 text-amber-400" },
  hidden: { label: "Hidden", className: "bg-white/[0.06] text-[#A1A1AA]" },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

export function MediaList({ items }: { items: MediaListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-[#A1A1AA]">
        Nothing uploaded for this event yet.
      </p>
    );
  }

  const live = items.filter((i) => i.status === "ready").length;

  return (
    <section aria-labelledby="uploaded-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="uploaded-heading" className="text-lg font-semibold">Uploaded</h2>
        <p className="text-xs text-[#A1A1AA]">
          {items.length} item{items.length === 1 ? "" : "s"} · {live} live
        </p>
      </div>
      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {items.map((item) => {
          const s = STATUS[item.status] ?? { label: item.status, className: "bg-white/[0.06] text-[#A1A1AA]" };
          const Icon = item.kind === "video" ? Film : ImageIcon;
          return (
            <li key={item.id} className="flex items-center gap-3 p-3.5">
              <Icon className="h-4 w-4 shrink-0 text-[#A1A1AA]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {item.kind === "video" ? "Video" : "Photo"}
                  {item.purpose === "cover" && (
                    <span className="ml-2 rounded-md bg-[#6C63FF]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#8B83FF]">
                      Cover
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[#71717A]">
                  {formatBytes(item.size_bytes)} · {formatWhen(item.created_at)}
                  {item.mine ? " · You" : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
