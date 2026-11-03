"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatDuration } from "@/lib/media/format";
import { isDriveUrl } from "@/lib/media/drive";

export interface LightboxItem {
  id: string;
  kind: "image" | "video";
  url: string;
  thumbUrl: string;
  posterUrl?: string;
  /** Google Drive player for a Drive video (an iframe, since Drive has no direct file url). */
  embedUrl?: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  durationS: number | null;
}

/** Grid of thumbnails for one event, opening a full-screen lightbox on click. */
export function MediaGrid({ items }: { items: LightboxItem[] }) {
  const [index, setIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={item.kind === "video" ? "Play video" : "View photo"}
              className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8B5CF6]"
            >
              <Image
                src={item.thumbUrl}
                alt={item.caption ?? ""}
                fill
                unoptimized={isDriveUrl(item.thumbUrl)}
                // Google answers 429 to Drive thumbnail requests that carry our Referer.
                referrerPolicy={isDriveUrl(item.thumbUrl) ? "no-referrer" : undefined}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {item.kind === "video" && (
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white">
                  {formatDuration(item.durationS)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {index !== null && (
        <LightboxOverlay
          items={items}
          index={index}
          onClose={() => setIndex(null)}
          onNavigate={setIndex}
        />
      )}
    </>
  );
}

function LightboxOverlay({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const item = items[index];
  const closeRef = useRef<HTMLButtonElement>(null);

  const next = useCallback(() => onNavigate((index + 1) % items.length), [index, items.length, onNavigate]);
  const prev = useCallback(() => onNavigate((index - 1 + items.length) % items.length), [index, items.length, onNavigate]);

  useEffect(() => {
    closeRef.current?.focus();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, next, prev]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption ?? (item.kind === "video" ? "Video" : "Photo")}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        </>
      )}

      <div className="relative flex max-h-[85vh] max-w-5xl flex-col items-center gap-3">
        {item.embedUrl ? (
          <iframe
            key={item.id}
            src={item.embedUrl}
            title={item.caption ?? "Video"}
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            className="aspect-video w-[min(90vw,64rem)] max-h-[75vh] rounded-lg border-0 bg-black"
          />
        ) : item.kind === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={item.id}
            src={item.url}
            poster={item.posterUrl}
            controls
            autoPlay
            className="max-h-[75vh] max-w-full rounded-lg"
          />
        ) : (
          <img
            key={item.id}
            src={item.url}
            alt={item.caption ?? ""}
            referrerPolicy="no-referrer"
            className="max-h-[75vh] max-w-full rounded-lg object-contain"
          />
        )}
        {item.caption && <p className="max-w-xl text-center text-sm text-white/80">{item.caption}</p>}
        {items.length > 1 && (
          <p className="text-xs font-mono text-white/50">
            {index + 1} / {items.length}
          </p>
        )}
      </div>
    </div>
  );
}
