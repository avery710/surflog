"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpotPicker, recentSpotSlugs, usePendingRequests, type PendingRequest } from "@/components/spot-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BoardSelect } from "@/components/board-select";
import { GoalCheck } from "@/components/goal";
import { goalOptions } from "@/lib/goal";
import { DateField } from "@/components/date-field";
import { nearestSlotInZone, todayInZone } from "@/lib/format";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { useLang } from "@/lib/i18n";
import { useDefaultSpot } from "@/lib/default-spot";
import { useBrowserTimeZone } from "@/lib/use-browser-timezone";
import { preselectBoardId } from "@/lib/boards";
import { TIME_SLOTS } from "@/lib/time-slots";
import {
  MediaPicker,
  UploadProgress,
  type MediaPick,
  type PickStatus,
  type UploadProgressState,
} from "@/components/media-picker";
import { attachFiles } from "@/lib/upload-client";
import type { Board, Session } from "@/lib/types";

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
  /** The owner's current goal for next session — its points are the checkboxes. */
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
  const [achieved, setAchieved] = useState<string[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  // Photos/videos picked for this log. Nothing is uploaded until Save: the
  // attach route needs the session's id, which doesn't exist before then.
  const [media, setMedia] = useState<MediaPick[]>([]);
  // Which file is going up, while Save is past creating the session.
  const [progress, setProgress] = useState<UploadProgressState | null>(null);
  // Each picked file's state while they upload (same order as the picks); null when idle.
  const [statuses, setStatuses] = useState<(PickStatus | undefined)[] | null>(null);

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
          // only the ticked goal points are recorded
          ...(achieved.length ? { goalAchieved: achieved } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSave"));
      // The session exists from here on, so nothing below may throw it
      // away: a file that fails is counted and skipped.
      const created = body.session as Session;
      const attached = await attachFiles(
        created.id,
        media.map((m) => m.file),
        (n, total, fraction, phase) => setProgress({ n, total, fraction, phase }),
        (i, status) => setStatuses((prev) => Object.assign([...(prev ?? [])], { [i]: status }))
      );
      const session = attached.session ?? created;
      const failed = attached.failed;
      onCreated(session);
      setNotesHtml("");
      setAchieved([]);
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
      setStatuses(null);
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

      <div className="mt-4">
        <MediaPicker picks={media} onPicksChange={setMedia} statuses={statuses ?? undefined} disabled={saving} />
      </div>

      {goal && (
        <div className="mt-4">
          <GoalCheck options={goalOptions(goal)} value={achieved} onChange={setAchieved} />
        </div>
      )}

      {progress && (
        <div className="mt-5">
          <UploadProgress progress={progress} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? t("form.saving") : t("form.saveSession")}
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
