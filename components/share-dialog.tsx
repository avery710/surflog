"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Switch } from "radix-ui";
import { Copy, Download, Link2, Share2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang, type Lang } from "@/lib/i18n";
import type { ShareVariant } from "@/lib/share-image";

/**
 * The Share dialog behind the session card's ⋯ → Share: a preview of the
 * two generated images (Sticker / Card, in English or 繁體中文), buttons to
 * send them, and the switch for the public link.
 *
 * Sending, all feature-detected:
 * - Share: the phone's share sheet with the PNG as a file (Web Share API,
 *   `navigator.canShare({ files })`), which is how it reaches WhatsApp, LINE,
 *   Messages, Instagram's share target. Hidden where unsupported (most
 *   desktops).
 * - Copy image: `navigator.clipboard.write` with a ClipboardItem built
 *   SYNCHRONOUSLY in the click, holding a Promise for the blob — iOS Safari
 *   drops the user gesture if the item is created after an await.
 * - Save image: a plain download.
 * - Copy link: only when the link is on.
 * Instagram stories can't be opened from the web, hence the hint line:
 * copy/save, open Instagram, paste the sticker.
 *
 * Only the image language and style are local state; everything the link
 * points at lives on the server (/api/sessions/:id/share).
 */

type Variant = Exclude<ShareVariant, "og">;
type LinkLang = Lang | null;

interface ShareState {
  token: string;
  path: string;
  lang: LinkLang;
}

interface ImageState {
  key: string;
  blob?: Blob;
  url?: string;
  error?: boolean;
  /** navigator.canShare accepted this file. */
  canShare?: boolean;
}

const noopSubscribe = () => () => {};
const clipboardImageSupported = () =>
  typeof ClipboardItem !== "undefined" && typeof navigator !== "undefined" && !!navigator.clipboard?.write;
const webShareSupported = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export function ShareDialog({
  open,
  onOpenChange,
  sessionId,
  fileStem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  /** Used in the saved file's name, e.g. "2026-09-25". */
  fileStem: string;
}) {
  const { lang: appLang, t } = useLang();
  const [variant, setVariant] = useState<Variant>("sticker");
  const [imageLang, setImageLang] = useState<Lang>(appLang);
  const [image, setImage] = useState<ImageState | null>(null);
  const [attempt, setAttempt] = useState(0);

  const canCopyImage = useSyncExternalStore(noopSubscribe, clipboardImageSupported, () => false);
  const canWebShare = useSyncExternalStore(noopSubscribe, webShareSupported, () => false);

  const key = `${variant}|${imageLang}|${attempt}`;
  const blobPromise = useRef<Promise<Blob> | null>(null);

  // Fetch the PNG for the current style/language, once, and keep the blob:
  // preview, copy, share and save all use this one render. State is only set
  // from the promise callbacks (never synchronously in the effect).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    const p = fetch(`/api/sessions/${sessionId}/share-image?variant=${variant}&lang=${imageLang}`, { cache: "no-store" }).then(
      async (res) => {
        if (!res.ok) throw new Error("render failed");
        const blob = await res.blob();
        return blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
      }
    );
    blobPromise.current = p;
    p.then(
      (blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const file = new File([blob], "surflog.png", { type: "image/png" });
        const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
        setImage({ key, blob, url: objectUrl, canShare });
      },
      () => {
        if (!cancelled) setImage({ key, error: true });
      }
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, sessionId, variant, imageLang, key]);

  const current = image?.key === key ? image : null;
  const loading = open && !current;
  const fileName = `surflog-${variant}-${fileStem}.png`;

  function copyImage() {
    // Synchronous ClipboardItem with a Promise value: required by iOS Safari.
    const p = blobPromise.current;
    if (!p) return;
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": p })])
      .then(() => toast.success(t("share.toast.imageCopied")))
      .catch(() => toast.error(t("share.toast.copyFailed")));
  }

  async function shareImage() {
    if (!current?.blob) return;
    const file = new File([current.blob], fileName, { type: "image/png" });
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user closed the sheet
      toast.error(t("share.toast.shareFailed"));
    }
  }

  function saveImage() {
    if (!current?.url) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("entry.close")} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Segmented
            label={t("share.variant.label")}
            value={variant}
            onChange={setVariant}
            options={[
              { value: "sticker", label: t("share.variant.sticker") },
              { value: "card", label: t("share.variant.card") },
            ]}
          />
          <Segmented
            label={t("share.lang.label")}
            value={imageLang}
            onChange={setImageLang}
            options={[
              { value: "en", label: t("share.lang.en") },
              { value: "zh-TW", label: t("share.lang.zh") },
            ]}
          />
        </div>

        <div>
          <div
            className={cn(
              "relative flex min-h-40 items-center justify-center overflow-hidden rounded-[var(--r-tile)]",
              variant === "sticker" ? "bg-[length:20px_20px] [background-image:conic-gradient(#e5e7eb_25%,#f9fafb_0_50%,#e5e7eb_0_75%,#f9fafb_0)]" : "bg-secondary"
            )}
          >
            {current?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={t("share.preview.alt")} className="max-h-[42vh] w-auto max-w-full object-contain" />
            ) : current?.error ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                {t("share.preview.failed")}
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setAttempt((n) => n + 1)}>
                  {t("share.preview.retry")}
                </Button>
              </div>
            ) : (
              <span className="p-6 text-sm text-muted-foreground" role="status">
                {t("share.preview.loading")}
              </span>
            )}
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {t(variant === "sticker" ? "share.variant.stickerNote" : "share.variant.cardNote")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canWebShare && current?.canShare && (
            <Button className="rounded-full" onClick={() => void shareImage()}>
              <Share2 />
              {t("share.button.share")}
            </Button>
          )}
          {canCopyImage && (
            <Button variant="secondary" className="rounded-full" disabled={loading || !!current?.error} onClick={copyImage}>
              <Copy />
              {t("share.button.copyImage")}
            </Button>
          )}
          <Button variant="secondary" className="rounded-full" disabled={!current?.url} onClick={saveImage}>
            <Download />
            {t("share.button.saveImage")}
          </Button>
        </div>
        {!canCopyImage && <p className="-mt-2 text-[12.5px] text-muted-foreground">{t("share.noClipboard")}</p>}
        <p className="-mt-2 text-[12.5px] text-muted-foreground">{t("share.hint.story")}</p>

        <LinkSection sessionId={sessionId} open={open} />
      </DialogContent>
    </Dialog>
  );
}

function LinkSection({ sessionId, open }: { sessionId: string; open: boolean }) {
  const { t } = useLang();
  const [share, setShare] = useState<ShareState | null | undefined>(undefined); // undefined = loading
  const [pageLang, setPageLang] = useState<LinkLang>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = useCallback((s: { token: string; path: string; lang: LinkLang } | null) => {
    setShare(s);
    if (s) setPageLang(s.lang);
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

  async function request(method: "PUT" | "DELETE", lang?: LinkLang): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method,
        ...(method === "PUT" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: lang ?? null }) } : {}),
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
    const ok = await request(on ? "PUT" : "DELETE", on ? pageLang : undefined);
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

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          label={t("share.link.pageLang")}
          value={pageLang ?? "auto"}
          disabled={busy || share === undefined}
          onChange={(v) => {
            const next: LinkLang = v === "auto" ? null : v;
            setPageLang(next);
            if (on) void request("PUT", next);
          }}
          options={[
            { value: "auto", label: t("share.link.langAuto") },
            { value: "en", label: t("share.lang.en") },
            { value: "zh-TW", label: t("share.lang.zh") },
          ]}
        />
      </div>

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
