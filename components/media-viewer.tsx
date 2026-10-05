"use client";

import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { Photo } from "@/lib/types";

const roundButton =
  "flex size-11 items-center justify-center rounded-full bg-white/15 text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white";

/**
 * Full-screen view of a session's photos and videos, opened from a card's
 * thumbnails. `index` is which one is showing (null = closed); ←/→ and the
 * side buttons step through, Escape or the backdrop closes. A video plays
 * here with its controls — the card only shows a still.
 */
export function MediaViewer({
  photos,
  index,
  onIndexChange,
  alt,
}: {
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Alt text for a photo (the session's spot and time). */
  alt: string;
}) {
  const { t } = useLang();
  const open = index !== null && index < photos.length;
  const count = photos.length;

  useEffect(() => {
    if (!open || count < 2) return;
    function onKey(e: KeyboardEvent) {
      if (index === null) return;
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + count) % count);
      if (e.key === "ArrowRight") onIndexChange((index + 1) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, count, onIndexChange]);

  const current = open ? photos[index] : null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 outline-none sm:p-8"
          // a click on the dark area around the picture closes, like the overlay would
          onClick={(e) => e.target === e.currentTarget && onIndexChange(null)}
        >
          <DialogPrimitive.Title className="sr-only">{t("viewer.title")}</DialogPrimitive.Title>
          {current &&
            (current.type.startsWith("video/") ? (
              <video
                key={current.id}
                src={`/api/blob/${current.id}`}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full rounded-lg bg-black"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={current.id}
                src={`/api/blob/${current.id}`}
                alt={alt}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ))}

          <DialogPrimitive.Close className={`${roundButton} absolute top-3 right-3 sm:top-5 sm:right-5`}>
            <X className="size-5" aria-hidden />
            <span className="sr-only">{t("entry.close")}</span>
          </DialogPrimitive.Close>

          {count > 1 && index !== null && (
            <>
              <button
                type="button"
                aria-label={t("viewer.prev")}
                onClick={() => onIndexChange((index - 1 + count) % count)}
                className={`${roundButton} absolute top-1/2 left-3 -translate-y-1/2 sm:left-5`}
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("viewer.next")}
                onClick={() => onIndexChange((index + 1) % count)}
                className={`${roundButton} absolute top-1/2 right-3 -translate-y-1/2 sm:right-5`}
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 font-mono text-xs text-white">
                {index + 1} / {count}
              </span>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
