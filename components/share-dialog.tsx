"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Switch } from "radix-ui";
import { Copy, Download, Link, Link2, Share2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang, type Lang } from "@/lib/i18n";
import type { ShareTone, ShareVariant } from "@/lib/share-element";
import { INSTAGRAM_STORY_URL, canInstagramStory, detectMobileOS, sharePayload } from "@/lib/share-targets";
import { ALL_PARTS, SHARE_PARTS, noParts, serializeShareParts, type ShareParts } from "@/lib/share-parts";

/**
 * The Share dialog behind the session card's ⋯ → Share: a gallery of ALL three
 * generated images (Strip / Column / Card), each an Instagram-story frame
 * (1080x1920) with the style centred in it (a snap scroller on phones),
 * driven by shared controls (image language, color mode, photo background
 * when the session has an image, four part switches). Tapping a preview selects it; Share / Copy / Save act on the
 * selected one. Control changes are debounced and stale renders aborted.
 *
 * Sending, laid out like Strava's share sheet, all feature-detected (helpers in
 * lib/share-targets.ts). The web can't hand an image to another app except via
 * the OS share sheet or the clipboard:
 * - Instagram Story (phones only): copies the sticker, then opens
 *   `instagram://story-camera`; the user taps "Add sticker" to paste. An
 *   unofficial best effort: there is no web API for Stories.
 * - Copy image: ClipboardItem built SYNCHRONOUSLY in the click, holding a Promise
 *   for the blob (iOS Safari drops the gesture otherwise). Save: a download.
 * - Copy link / WhatsApp / LINE: only with the public link ALREADY on; this
 *   dialog never turns sharing on by itself. WhatsApp/LINE carry the link, not the image.
 * - More: navigator.share with the PNG file, else the link, else hidden.
 *
 * Only the image language and style are local state; everything the link
 * points at lives on the server (/api/sessions/:id/share).
 */

type Variant = Exclude<ShareVariant, "og">;

interface ShareState {
  token: string;
  path: string;
}

/** A small WebP preview on screen (size=preview), per style. */
interface ImageState {
  key: string;
  url?: string;
  error?: boolean;
}

/** The full-size PNG of one style, fetched only for the style in use (Save,
 *  Copy, Share act on it). */
interface FullState {
  key: string;
  blob?: Blob;
  error?: boolean;
}

const noopSubscribe = () => () => {};
const clipboardImageSupported = () =>
  typeof ClipboardItem !== "undefined" && typeof navigator !== "undefined" && !!navigator.clipboard?.write;
const webShareSupported = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
// "ios" | "android" | "" (desktop). A string so useSyncExternalStore's snapshot is stable.
const mobileOS = () => (typeof navigator === "undefined" ? "" : (detectMobileOS(navigator.userAgent, navigator.maxTouchPoints ?? 0) ?? ""));

const KINDS: Variant[] = ["strip", "column", "card"];
const DEBOUNCE_MS = 250;

export function ShareDialog({
  open,
  onOpenChange,
  sessionId,
  fileStem,
  available,
  hasPhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  /** Used in the saved file's name, e.g. "2026-09-25". */
  fileStem: string;
  /** Which parts the session has; a switch for a missing one is hidden. */
  available: ShareParts;
  /** The session has an image to use as the background (the switch is hidden otherwise). */
  hasPhoto: boolean;
}) {
  const { lang: appLang, t } = useLang();
  const [selected, setSelected] = useState<Variant>("strip");
  const [imageLang, setImageLang] = useState<Lang>(appLang);
  // Color mode of all three images. Light = white / light ink (dark photos), Dark = near-black.
  const [tone, setTone] = useState<ShareTone>("light");
  const [chosen, setChosen] = useState<ShareParts>({ ...ALL_PARTS });
  // What is actually drawn: the switch AND the session having it.
  const parts: ShareParts = {
    datetime: chosen.datetime && available.datetime,
    waves: chosen.waves && available.waves,
    board: chosen.board && available.board,
    log: chosen.log && available.log,
  };
  const partsKey = serializeShareParts(parts);
  const nothing = noParts(parts);
  // Every image is an Instagram-story frame (1080x1920); this puts the session's first image behind it.
  const [photoChoice, setPhotoChoice] = useState(false);
  const photoBg = hasPhoto && photoChoice;
  const liveKey = `${imageLang}|${tone}|${partsKey}|${photoBg ? "photo" : "clear"}`;

  // Control changes settle for 250 ms before three renders are requested.
  const [settled, setSettled] = useState({ key: liveKey, lang: imageLang, tone, partsKey, photoBg });
  useEffect(() => {
    const id = setTimeout(() => setSettled({ key: liveKey, lang: imageLang, tone, partsKey, photoBg }), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [liveKey, imageLang, tone, partsKey, photoBg]);

  const [images, setImages] = useState<Partial<Record<Variant, ImageState>>>({});
  const imagesRef = useRef(images);
  // Every preview drawn while the dialog is open, by style + settings (small WebPs).
  const seen = useRef(new Map<string, string>());
  const [full, setFull] = useState<Partial<Record<Variant, FullState>>>({});
  // The full PNG requests by style, with the settings they were made for.
  const promises = useRef<Partial<Record<Variant, { key: string; promise: Promise<Blob> }>>>({});
  const selectedRef = useRef(selected);
  const settledRef = useRef(settled);
  useEffect(() => {
    selectedRef.current = selected;
    settledRef.current = settled;
  }, [selected, settled]);
  const [attempt, setAttempt] = useState(0);

  const canCopyImage = useSyncExternalStore(noopSubscribe, clipboardImageSupported, () => false);
  const canWebShare = useSyncExternalStore(noopSubscribe, webShareSupported, () => false);
  const os = useSyncExternalStore(noopSubscribe, mobileOS, () => "");
  const showStory = canInstagramStory(os === "" ? null : (os as "ios" | "android"), canCopyImage);
  // The public link, once it is on (owned by LinkSection, which does the switching).
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const imageUrl = useCallback(
    (v: Variant, s: typeof settled, preview: boolean) =>
      `/api/sessions/${sessionId}/share-image?variant=${v}&lang=${s.lang}&tone=${s.tone}&parts=${s.partsKey}${s.photoBg ? "&bg=photo" : ""}${preview ? "&size=preview" : ""}`,
    [sessionId]
  );

  // The full PNG of one style for the settled controls, requested once per
  // settings key and reused (Copy hands the promise to the clipboard at once).
  const ensureFull = useCallback(
    (v: Variant): Promise<Blob> | null => {
      const s = settledRef.current;
      if (!s.partsKey) return null;
      const have = promises.current[v];
      if (have && have.key === s.key) return have.promise;
      const promise = fetch(imageUrl(v, s, false)).then(async (res) => {
        if (!res.ok) throw new Error("render failed");
        const blob = await res.blob();
        return blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
      });
      promises.current[v] = { key: s.key, promise };
      promise.then(
        (blob) => promises.current[v]?.promise === promise && setFull((f) => ({ ...f, [v]: { key: s.key, blob } })),
        () => {
          if (promises.current[v]?.promise !== promise) return;
          delete promises.current[v]; // a later tap tries again
          setFull((f) => ({ ...f, [v]: { key: s.key, error: true } }));
        }
      );
      return promise;
    },
    [imageUrl]
  );

  // Previews: the three small WebPs for the settled controls, the selected one
  // first. A newer settle aborts the older requests; the previous preview of
  // each kind stays on screen until its replacement arrives.
  useEffect(() => {
    if (!open || !settled.partsKey) return;
    const ac = new AbortController();
    let cancelled = false;
    const load = async (v: Variant) => {
      // A preview already drawn for these exact settings (toggled back) shows at once.
      const memo = `${v}|${settled.key}`;
      const known = seen.current.get(memo);
      if (known) {
        imagesRef.current = { ...imagesRef.current, [v]: { key: settled.key, url: known } };
        setImages(imagesRef.current);
        return;
      }
      try {
        const res = await fetch(imageUrl(v, settled, true), { signal: ac.signal });
        if (!res.ok) throw new Error("render failed");
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        seen.current.set(memo, url);
        imagesRef.current = { ...imagesRef.current, [v]: { key: settled.key, url } };
        setImages(imagesRef.current);
      } catch {
        if (cancelled) return;
        imagesRef.current = { ...imagesRef.current, [v]: { ...imagesRef.current[v], key: settled.key, error: true } };
        setImages(imagesRef.current);
      }
    };
    void (async () => {
      const first = selectedRef.current;
      await load(first);
      if (cancelled) return;
      await Promise.all(KINDS.filter((k) => k !== first).map(load));
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, imageUrl, settled, attempt]);

  // Then the full PNG of the style in use, in the background, so Save / Share
  // are ready by the time they're tapped.
  const selectedPreviewKey = images[selected]?.url ? images[selected]?.key : undefined;
  useEffect(() => {
    if (open && selectedPreviewKey === settled.key) void ensureFull(selected)?.catch(() => {});
  }, [open, selected, selectedPreviewKey, settled.key, ensureFull]);

  // Free the blob URLs when the dialog goes away.
  useEffect(
    () => () => {
      for (const url of seen.current.values()) URL.revokeObjectURL(url);
    },
    []
  );

  const current = images[selected];
  // Up to date = drawn for exactly what the controls show right now.
  const currentReady = !nothing && !!current?.url && current.key === liveKey && !current.error;
  const currentFull = full[selected];
  const fullBlob = !nothing && currentFull?.key === liveKey ? currentFull.blob : undefined;
  const fileName = `surflog-${selected}-${fileStem}.png`;
  // The full image's object URL, for Save (a download link).
  const fullUrl = useMemo(() => (fullBlob ? URL.createObjectURL(fullBlob) : null), [fullBlob]);
  useEffect(() => () => {
    if (fullUrl) URL.revokeObjectURL(fullUrl);
  }, [fullUrl]);

  function copyImage() {
    // Synchronous ClipboardItem with a Promise value: required by iOS Safari.
    const p = ensureFull(selected);
    if (!p) return;
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": p })])
      .then(() => toast.success(t("share.toast.imageCopied")))
      .catch(() => toast.error(t("share.toast.copyFailed")));
  }

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success(t("share.toast.linkCopied"));
    } catch {
      toast.error(t("share.toast.copyFailed"));
    }
  }

  // Instagram's web hand-off: copy the sticker, then open the story camera. The
  // user taps "Add sticker" there. Instagram can't be sent an image from the web.
  function sendToInstagramStory() {
    const p = ensureFull(selected);
    if (!p) return;
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": p })])
      .then(() => {
        toast.success(t("share.toast.storyCopied"));
        window.location.href = INSTAGRAM_STORY_URL;
      })
      .catch(() => toast.error(t("share.toast.copyFailed")));
  }

  // "More": the image with an invite and a link (the public link when it's on,
  // else Surflog itself) through the OS share sheet, to any chat app.
  const shareFile = useMemo(() => (fullBlob ? new File([fullBlob], fileName, { type: "image/png" }) : null), [fullBlob, fileName]);
  const payload = sharePayload({
    hasShare: canWebShare,
    file: shareFile,
    text: t("share.more.text"),
    url: linkUrl ?? (typeof window === "undefined" ? "" : window.location.origin),
    canShare: (d) => typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare(d),
  });

  async function shareMore() {
    if (!payload) return;
    try {
      await navigator.share(payload);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user closed the sheet
      toast.error(t("share.toast.shareFailed"));
    }
  }

  function saveImage() {
    if (!fullUrl) return;
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const label = (v: Variant) => t(`share.variant.${v}`);

  // Radiogroup keyboard: arrows move the selection (and the scroller follows).
  function onKey(e: React.KeyboardEvent) {
    const i = KINDS.indexOf(selected);
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? KINDS[(i + 1) % KINDS.length] : e.key === "ArrowLeft" || e.key === "ArrowUp" ? KINDS[(i + KINDS.length - 1) % KINDS.length] : null;
    if (!next) return;
    e.preventDefault();
    setSelected(next);
    document.getElementById(`share-kind-${next}`)?.focus();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("entry.close")} className="max-w-xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-center">
          <Segmented
            label={t("share.lang.label")}
            value={imageLang}
            onChange={setImageLang}
            options={[
              { value: "en", label: t("share.lang.en") },
              { value: "zh-TW", label: t("share.lang.zh") },
            ]}
          />
          <Segmented
            label={t("share.tone.label")}
            value={tone}
            onChange={setTone}
            options={[
              { value: "light", label: t("share.tone.light") },
              { value: "dark", label: t("share.tone.dark") },
            ]}
          />
        </div>

        {hasPhoto && (
          <div className="flex lg:justify-center">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold">
              <Switch.Root
                checked={photoChoice}
                onCheckedChange={setPhotoChoice}
                className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-[#c9ced6] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:bg-primary"
              >
                <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
              </Switch.Root>
              {t("share.bg.photo")}
            </label>
          </div>
        )}

        <div role="group" aria-label={t("share.parts.label")} className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-center">
          <span className="text-[12.5px] font-semibold text-muted-foreground">{t("share.parts.label")}</span>
          {SHARE_PARTS.filter((k) => available[k]).map((k) => (
            <label key={k} className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold">
              <Switch.Root
                checked={chosen[k]}
                onCheckedChange={(v) => setChosen((p) => ({ ...p, [k]: v }))}
                className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-[#c9ced6] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:bg-primary"
              >
                <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
              </Switch.Root>
              {t(`share.part.${k}`)}
            </label>
          ))}
        </div>

        {/* The gallery: all three styles at once, each an Instagram-story frame,
            so every tile is the same fixed 9:16 box. A snap scroller on phones
            (the next preview peeks), centred from lg. */}
        <div>
          <div
            role="radiogroup"
            aria-label={t("share.variant.label")}
            onKeyDown={onKey}
            className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-1 pb-2 [justify-content:safe_center] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {KINDS.map((v) => {
              const img = images[v];
              const isSel = selected === v;
              const stale = !nothing && !!img && img.key !== liveKey && !img.error;
              const loading = !nothing && (!img?.url ? !img?.error : stale);
              return (
                <div key={v} className="shrink-0 snap-center">
                  <button
                    type="button"
                    id={`share-kind-${v}`}
                    role="radio"
                    aria-checked={isSel}
                    aria-label={label(v)}
                    tabIndex={isSel ? 0 : -1}
                    onClick={() => {
                      setSelected(v);
                      document.getElementById(`share-kind-${v}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                    }}
                    className={cn(
                      // one fixed 9:16 box per style; the grid shows through wherever the frame is transparent
                      "relative flex aspect-[9/16] h-80 items-center justify-center overflow-hidden rounded-[var(--r-tile)] bg-[length:32px_32px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring lg:h-[400px]",
                      tone === "light"
                        ? "[background-image:conic-gradient(#2a2d32_25%,#33373c_0_50%,#2a2d32_0_75%,#33373c_0)]"
                        : "[background-image:conic-gradient(#d5d9de_25%,#e6e9ed_0_50%,#d5d9de_0_75%,#e6e9ed_0)]",
                      isSel ? "ring-2 ring-primary ring-offset-2" : "opacity-90 hover:opacity-100"
                    )}
                  >
                    {nothing ? (
                      <span className="p-4 text-sm text-muted-foreground">{t("share.parts.none")}</span>
                    ) : img?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt={t("share.preview.alt")} className={cn("size-full object-contain transition-opacity", stale && "opacity-60")} />
                    ) : null}
                    {loading && (
                      <span role="status" className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-xs font-medium text-white">
                        {t("share.preview.loading")}
                      </span>
                    )}
                    {img?.error && !loading && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-3 text-center text-sm text-white">
                        {t("share.preview.failed")}
                        <span
                          role="button"
                          tabIndex={0}
                          className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-black"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttempt((n) => n + 1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setAttempt((n) => n + 1);
                            }
                          }}
                        >
                          {t("share.preview.retry")}
                        </span>
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <section aria-label={t("share.act.label")} className="flex flex-col gap-3">
          {showStory && (
            <button
              type="button"
              disabled={!currentReady}
              onClick={sendToInstagramStory}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-secondary text-[15px] font-semibold outline-none transition-colors hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <InstagramGlyph />
              {t("share.act.instagram")}
            </button>
          )}
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-3 sm:justify-start sm:gap-x-4 lg:justify-center">
            {canCopyImage && <ActionButton label={t("share.button.copyImage")} disabled={!currentReady} onClick={copyImage} icon={<Copy />} />}
            <ActionButton label={t("share.button.saveImage")} disabled={!fullUrl} onClick={saveImage} icon={<Download />} />
            <ActionButton label={t("share.button.copyLink")} disabled={!linkUrl} onClick={() => void copyLink()} icon={<Link />} />
            {canWebShare && <ActionButton label={t("share.act.more")} disabled={!shareFile || !payload} onClick={() => void shareMore()} icon={<Share2 />} />}
          </div>
          {!linkUrl && <p className="text-[12.5px] text-muted-foreground lg:text-center">{t("share.act.linkOff")}</p>}
        </section>
        {!canCopyImage && <p className="-mt-2 text-[12.5px] text-muted-foreground lg:text-center">{t("share.noClipboard")}</p>}

        <LinkSection sessionId={sessionId} open={open} onUrl={setLinkUrl} />
      </DialogContent>
    </Dialog>
  );
}

function LinkSection({ sessionId, open, onUrl }: { sessionId: string; open: boolean; onUrl: (url: string | null) => void }) {
  const { t } = useLang();
  const [share, setShare] = useState<ShareState | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = useCallback((s: ShareState | null) => {
    setShare(s);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/sessions/${sessionId}/share`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("status"))))
      .then((j: { share: ShareState | null }) => {
        if (!cancelled) apply(j.share);
      })
      .catch(() => {
        if (!cancelled) setShare(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, apply]);

  async function request(method: "PUT" | "DELETE"): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method,
      });
      if (!res.ok) throw new Error("share");
      const j = (await res.json()) as { share: ShareState | null };
      apply(j.share);
      return true;
    } catch {
      toast.error(t("share.link.failed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(on: boolean) {
    const ok = await request(on ? "PUT" : "DELETE");
    if (ok) toast.success(t(on ? "share.link.turnedOn" : "share.link.turnedOff"));
  }

  const url = share && typeof window !== "undefined" ? `${window.location.origin}${share.path}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.toast.linkCopied"));
    } catch {
      // No async clipboard (older WebView, insecure origin): select + execCommand.
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
        if (document.execCommand("copy")) {
          toast.success(t("share.toast.linkCopied"));
          return;
        }
      }
      toast.error(t("share.toast.copyFailed"));
    }
  }

  useEffect(() => {
    onUrl(url || null);
  }, [url, onUrl]);

  const on = !!share;
  return (
    <section className="rounded-[var(--r-tile)] bg-secondary p-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="share-link-switch" className="flex items-center gap-2 text-[15px] font-semibold">
          <Link2 className="size-4" aria-hidden />
          {t("share.link.title")}
        </label>
        <Switch.Root
          id="share-link-switch"
          checked={on}
          disabled={share === undefined || busy}
          onCheckedChange={(v) => void toggle(v)}
          className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-[#c9ced6] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:bg-primary"
        >
          <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
        </Switch.Root>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        {share === undefined ? t("share.link.loading") : t(on ? "share.link.onDescription" : "share.link.offDescription")}
      </p>

      {on && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={inputRef}
            readOnly
            value={url}
            aria-label={t("share.link.readonlyLabel")}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 basis-48 rounded-full border border-card-border bg-card px-3.5 font-mono text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="sm" className="h-9 rounded-full" onClick={() => void copyLink()}>
            <Copy />
            {t("share.button.copyLink")}
          </Button>
        </div>
      )}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-2">
      <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
      <div className="inline-flex rounded-full bg-card p-0.5 ring-1 ring-card-border">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
              value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ label, icon, onClick, disabled, bare }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; bare?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-16 flex-col items-center gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full transition-colors [&_svg]:size-5",
          bare ? "" : "bg-secondary group-enabled:group-hover:bg-secondary/70"
        )}
      >
        {icon}
      </span>
      <span className="text-center text-[12px] font-semibold leading-tight">{label}</span>
    </button>
  );
}

/** A flat camera-in-a-rounded-square: brand-neutral, not Instagram's artwork. */
function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <defs>
        <linearGradient id="share-ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f9a03f" />
          <stop offset="0.5" stopColor="#e1306c" />
          <stop offset="1" stopColor="#7b3fe4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#share-ig)" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.1" cy="7.9" r="0.9" fill="#fff" />
    </svg>
  );
}

/** A coloured rounded square with a plain speech bubble (WhatsApp / LINE stand-in). */
