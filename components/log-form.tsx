"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpotPicker, recentSpotSlugs, usePendingRequests, type PendingRequest } from "@/components/spot-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BoardSelect } from "@/components/board-select";
import { GoalCheck } from "@/components/goal";
import { goalPoints } from "@/lib/goal";
import { DateField } from "@/components/date-field";
import { nearestSlotInZone, todayInZone } from "@/lib/format";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { useLang } from "@/lib/i18n";
import { useDefaultSpot } from "@/lib/default-spot";
import { useBrowserTimeZone } from "@/lib/use-browser-timezone";
import { preselectBoardId } from "@/lib/boards";
import { TIME_SLOTS } from "@/lib/time-slots";
import { MAX_UPLOAD_BYTES, uploadFile } from "@/lib/upload-client";
import type { Board, Session } from "@/lib/types";

/** Most photos/videos one log can carry. They upload one after another
 *  while the dialog waits, so this also bounds how long Save can take. */
const MAX_MEDIA = 10;
/** The photo types upload-client's shrinkImage() resizes — a file of one of
 *  these may be over the 15 MB limit when picked, since it's shrunk before it
 *  goes up. Everything else (video, GIF) is sent as it is. */
const SHRINKABLE = /^image\/(jpeg|png|webp|heic|heif)$/;

/** A file picked but not uploaded yet; `url` is an object URL for the preview. */
type MediaPick = { key: number; file: File; url: string };

export function LogForm({
  onCreated,
  ownerId,
  recentSpot,
  boards = [],
  sessions = [],
  goal = null,
  onRequestSpot,
  pendingRequests: givenPending,
  onBusyChange,
}: {
  onCreated: (s: Session) => void;
  ownerId?: string;
  /** Spot of the user's most recent session — fallback when no default is set. */
  recentSpot?: string;
  boards?: Board[];
  /** The owner's sessions — only used to pre-select the last-used board. */
  sessions?: Session[];
  /** The owner's current goal for next session — snapshotted onto the session. */
  goal?: string | null;
  /** Passed straight to SpotPicker — see its props. */
  onRequestSpot?: (query: string) => void;
  pendingRequests?: PendingRequest[];
  /** True from Save until the session and all its media are done — the host
   *  dialog uses it to refuse closing mid-upload. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { lang, t } = useLang();
  const [defaultSpot, setDefaultSpot] = useDefaultSpot(ownerId);
  // Only set once the user picks a spot; until then, derive it:
  // saved default → most recent session's spot → Wai'ao.
  const [pickedSpot, setSpot] = useState<string | null>(null);
  // any spot in the catalogue, or one of the user's own pending requests
  const { bySlug } = useSpotCatalog();
  const pendingRequests = usePendingRequests(givenPending);
  const isOption = (v: string | null | undefined): v is string =>
    !!v && (bySlug(v) != null || pendingRequests.some((p) => p.value === v));
  const spot =
    pickedSpot ??
    (isOption(defaultSpot) ? defaultSpot : isOption(recentSpot) ? recentSpot : "waiao");
  const isDefault = spot === defaultSpot;
  const spotId = useId();
  // Date and slot default to "now" at the selected spot (each spot has its
  // own timezone) and keep following it until the user picks one themselves.
  const catalog = useSpotCatalog();
  const spotTimezone = catalog.bySlug(spot)?.timezone ?? "Asia/Taipei";
  const [pickedDate, setDate] = useState<string | null>(null);
  const [pickedTime, setTime] = useState<string | null>(null);
  const date = pickedDate ?? todayInZone(spotTimezone);
  const time = pickedTime ?? nearestSlotInZone(spotTimezone);
  // Only worth saying when the spot's clock isn't the one on the user's wall.
  const browserTimezone = useBrowserTimeZone();
  const showTimeNote = browserTimezone != null && browserTimezone !== spotTimezone;
  const [notesHtml, setNotesHtml] = useState("");
  // undefined = not picked yet, so follow the last-used board.
  const [pickedBoardId, setBoardId] = useState<string | null | undefined>(undefined);
  const boardId = pickedBoardId === undefined ? preselectBoardId(boards, sessions) : pickedBoardId;
  const [pointsMet, setPointsMet] = useState<boolean[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  // Photos/videos picked for this log. Nothing is uploaded until Save: the
  // attach route needs the session's id, which doesn't exist before then.
  const [media, setMedia] = useState<MediaPick[]>([]);
  // Which file is going up, while Save is past creating the session.
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  // Object URLs outlive the component unless revoked; on unmount (the dialog
  // closing) free whatever is still picked.
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_MEDIA - media.length;
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
    if (picked.length) setMedia((prev) => [...prev, ...picked]);
    // one toast per reason, however many files hit it
    if (badType) toast.error(t("toast.notMedia"));
    if (tooLarge) toast.error(t("toast.fileTooLarge"));
    if (tooMany) toast.error(t("toast.tooManyMedia", { max: MAX_MEDIA }));
  }

  function removeMedia(key: number) {
    const gone = media.find((m) => m.key === key);
    if (gone) URL.revokeObjectURL(gone.url);
    setMedia((prev) => prev.filter((m) => m.key !== key));
  }

  async function handleSave() {
    setSaving(true);
    onBusyChange?.(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spot,
          when: `${date}T${time}`,
          notesHtml,
          boardId,
          // unticked points count as not achieved; pad to one per point
          ...(goal ? { goalText: goal, goalPointsMet: goalPoints(goal).map((_, i) => pointsMet[i] ?? false) } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSave"));
      // The session exists from here on, so nothing below may throw it
      // away: a file that fails is counted and skipped. One file at a time —
      // the attach route reads the session's photo list and writes it back,
      // so two attaches at once would overwrite each other.
      let session = body.session as Session;
      let failed = 0;
      for (let i = 0; i < media.length; i++) {
        setProgress({ n: i + 1, total: media.length });
        try {
          const uploadId = await uploadFile(media[i].file);
          const attach = await fetch(`/api/sessions/${session.id}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId }),
          });
          const attached = await attach.json().catch(() => null);
          if (!attach.ok || !attached?.session) throw new Error("attach failed");
          session = attached.session as Session;
        } catch {
          failed++;
        }
      }
      onCreated(session);
      setNotesHtml("");
      setPointsMet([]);
      setEditorKey((k) => k + 1);
      media.forEach((m) => URL.revokeObjectURL(m.url));
      setMedia([]);
      if (failed) {
        // stays up longer than a normal toast: it says where to go next
        toast.warning(t("toast.savedMediaFailed", { n: failed, total: media.length }), { duration: 10000 });
      } else {
        toast.success(session.condOpenMeteo != null ? t("toast.savedFilled") : t("toast.saved"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSave"));
    } finally {
      setSaving(false);
      setProgress(null);
      onBusyChange?.(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Field
          label={t("form.spot")}
          htmlFor={spotId}
          aside={
            <button
              type="button"
              onClick={() => setDefaultSpot(isDefault ? null : spot)}
              aria-pressed={isDefault}
              aria-label={t("form.setDefaultSpot")}
              title={isDefault ? t("form.clearDefaultSpot") : t("form.setDefaultSpot")}
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors " +
                (isDefault
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {isDefault && <Check className="size-3" aria-hidden />}
              {isDefault ? t("form.defaultSpot") : t("form.setAsDefault")}
            </button>
          }
        >
          <SpotPicker
            id={spotId}
            value={spot}
            onChange={setSpot}
            recent={recentSpotSlugs(sessions)}
            onRequestSpot={onRequestSpot}
            pendingRequests={pendingRequests}
          />
        </Field>
        <Field label={t("form.date")}>
          <DateField value={date} onChange={setDate} />
        </Field>
        <Field label={t("form.timeInWater")}>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {showTimeNote && (
        <p className="mt-2 pl-0.5 text-xs font-medium text-muted-foreground">
          {t("form.spotTimeNote", {
            place:
              catalog.bySlug(spot)?.area ??
              pendingRequests.find((p) => p.value === spot)?.name ??
              catalog.label(spot, lang),
            tz: spotTimezone,
          })}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("form.notes")}</span>
        <RichTextEditor
          key={editorKey}
          defaultHtml=""
          placeholder={t("form.notesPlaceholder")}
          onChangeHtml={setNotesHtml}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <BoardSelect boards={boards} value={boardId} onChange={setBoardId} className="w-full min-w-[180px]" />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 pl-0.5 text-xs font-semibold text-muted-foreground">
          <span>{t("form.media")}</span>
          {media.length > 0 && (
            <span className="font-mono font-medium">
              {media.length}/{MAX_MEDIA}
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handlePick}
        />
        {media.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--r-tile)] border border-dashed border-primary/40 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <ImagePlus className="size-4" aria-hidden />
            {t("entry.addMedia")}
          </button>
        ) : (
          <ul className="flex flex-wrap gap-2.5">
            {media.map((m) => (
              <li key={m.key} className="relative size-24">
                {m.file.type.startsWith("video/") ? (
                  <>
                    <video
                      src={m.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full rounded-[var(--r-tile)] bg-black object-cover"
                    />
                    {/* a first frame is often black, so always say it's a video */}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 rounded-b-[var(--r-tile)] bg-black/55 px-1.5 py-1 text-[11px] font-medium text-white">
                      <Video className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{m.file.name}</span>
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.file.name}
                    className="h-full w-full rounded-[var(--r-tile)] object-cover"
                  />
                )}
                <button
                  type="button"
                  aria-label={t("form.removeMedia", { name: m.file.name })}
                  onClick={() => removeMedia(m.key)}
                  disabled={saving}
                  className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white outline-none focus-visible:ring-2 focus-visible:ring-white disabled:hidden"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
            {media.length < MAX_MEDIA && (
              <li className="size-24">
                <button
                  type="button"
                  aria-label={t("entry.addMedia")}
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                  className="flex h-full w-full items-center justify-center rounded-[var(--r-tile)] border border-dashed border-primary/40 text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <ImagePlus className="size-5" aria-hidden />
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {goal && (
        <div className="mt-4">
          <GoalCheck goal={goal} value={pointsMet} onChange={setPointsMet} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {progress
            ? t("form.uploadingMedia", { n: progress.n, total: progress.total })
            : saving
              ? t("form.saving")
              : t("form.saveSession")}
        </Button>
        <span className="text-[13px] font-medium text-muted-foreground">
          {progress ? t("form.uploadingHint") : t("form.autoFillHint")}
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  aside,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** Optional control shown on the label row (outside the <label>, so clicks don't hit the input). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!aside) {
    return (
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{label}</span>
        {children}
      </label>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="pl-0.5 text-xs font-semibold text-muted-foreground">
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}
