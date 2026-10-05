"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ImagePlus, Video, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-client";
import type { Photo } from "@/lib/types";

/** Most photos/videos one session can carry. They upload one after another
 *  while the form waits, so this also bounds how long Save can take. */
export const MAX_MEDIA = 10;
/** The photo types upload-client's shrinkImage() resizes — a file of one of
 *  these may be over the 15 MB limit when picked, since it's shrunk before it
 *  goes up. Everything else (video, GIF) is sent as it is. */
const SHRINKABLE = /^image\/(jpeg|png|webp|heic|heif)$/;

/** A file picked but not uploaded yet; `url` is an object URL for the preview. */
export type MediaPick = { key: number; file: File; url: string };

const tile = "h-full w-full rounded-[var(--r-tile)] object-cover";
const removeButton =
  "absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white outline-none focus-visible:ring-2 focus-visible:ring-white disabled:hidden";

/**
 * The photos/video section of the log form and the edit panel: a strip of
 * what's attached (`existing`, edit panel only) and what's been picked, each
 * with a remove button, plus an add tile. Nothing is uploaded or deleted
 * here — the form applies both on Save, so Cancel really cancels.
 */
export function MediaPicker({
  picks,
  onPicksChange,
  existing = [],
  onRemoveExisting,
  disabled = false,
}: {
  picks: MediaPick[];
  onPicksChange: (picks: MediaPick[]) => void;
  /** Already on the session, minus any the user has marked for removal. */
  existing?: Photo[];
  onRemoveExisting?: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const total = existing.length + picks.length;

  // Object URLs outlive the component unless revoked; on unmount free
  // whatever is still picked.
  const picksRef = useRef(picks);
  useEffect(() => {
    picksRef.current = picks;
  }, [picks]);
  useEffect(() => () => picksRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_MEDIA - total;
    const picked: MediaPick[] = [];
    let badType = false;
    let tooLarge = false;
    let tooMany = false;
    for (const file of files) {
      if (!/^(image|video)\//.test(file.type)) badType = true;
      else if (file.size > MAX_UPLOAD_BYTES && !SHRINKABLE.test(file.type)) tooLarge = true;
      else if (picked.length >= room) tooMany = true;
      else picked.push({ key: nextKey.current++, file, url: URL.createObjectURL(file) });
    }
    if (picked.length) onPicksChange([...picks, ...picked]);
    // one toast per reason, however many files hit it
    if (badType) toast.error(t("toast.notMedia"));
    if (tooLarge) toast.error(t("toast.fileTooLarge"));
    if (tooMany) toast.error(t("toast.tooManyMedia", { max: MAX_MEDIA }));
  }

  function removePick(key: number) {
    const gone = picks.find((m) => m.key === key);
    if (gone) URL.revokeObjectURL(gone.url);
    onPicksChange(picks.filter((m) => m.key !== key));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 pl-0.5 text-xs font-semibold text-muted-foreground">
        <span>{t("form.media")}</span>
        {total > 0 && (
          <span className="font-mono font-medium">
            {total}/{MAX_MEDIA}
          </span>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handlePick} />
      {total === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--r-tile)] border border-dashed border-primary/40 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <ImagePlus className="size-4" aria-hidden />
          {t("entry.addMedia")}
        </button>
      ) : (
        <ul className="flex flex-wrap gap-2.5">
          {existing.map((p) => (
            <li key={p.id} className="relative size-24">
              {p.type.startsWith("video/") ? (
                <>
                  <video
                    src={`/api/blob/${p.id}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className={`${tile} bg-black`}
                  />
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
                    <Video className="size-3.5" aria-hidden />
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/blob/${p.id}`} alt="" loading="lazy" className={tile} />
              )}
              {onRemoveExisting && (
                <button
                  type="button"
                  aria-label={t("entry.removePhoto")}
                  onClick={() => onRemoveExisting(p.id)}
                  disabled={disabled}
                  className={removeButton}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
          {picks.map((m) => (
            <li key={m.key} className="relative size-24">
              {m.file.type.startsWith("video/") ? (
                <>
                  <video src={m.url} muted playsInline preload="metadata" className={`${tile} bg-black`} />
                  {/* a first frame is often black, so always say it's a video */}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 rounded-b-[var(--r-tile)] bg-black/55 px-1.5 py-1 text-[11px] font-medium text-white">
                    <Video className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{m.file.name}</span>
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.file.name} className={tile} />
              )}
              <button
                type="button"
                aria-label={t("form.removeMedia", { name: m.file.name })}
                onClick={() => removePick(m.key)}
                disabled={disabled}
                className={removeButton}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {total < MAX_MEDIA && (
            <li className="size-24">
              <button
                type="button"
                aria-label={t("entry.addMedia")}
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
                className="flex h-full w-full items-center justify-center rounded-[var(--r-tile)] border border-dashed border-primary/40 text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <ImagePlus className="size-5" aria-hidden />
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
