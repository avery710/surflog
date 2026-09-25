"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { RatingPicker } from "@/components/rating-picker";
import { BoardSelect } from "@/components/board-select";
import { SPOTS, type Region } from "@/lib/spots";
import { DateField } from "@/components/date-field";
import { spotLabel, taipeiNearestSlot, taipeiToday } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useDefaultSpot } from "@/lib/default-spot";
import { TIME_SLOTS } from "@/lib/time-slots";
import type { Board, Session } from "@/lib/types";

const REGIONS: Region[] = ["Northeast", "North", "East", "South", "West"];
const isOption = (v: string | null | undefined): v is string =>
  !!v && SPOTS.some((s) => s.slug === v);

export function LogForm({
  onCreated,
  ownerId,
  recentSpot,
  boards = [],
}: {
  onCreated: (s: Session) => void;
  ownerId?: string;
  /** Spot of the user's most recent session — fallback when no default is set. */
  recentSpot?: string;
  boards?: Board[];
}) {
  const { lang, t } = useLang();
  const [defaultSpot, setDefaultSpot] = useDefaultSpot(ownerId);
  // Only set once the user picks a spot; until then, derive it:
  // saved default → most recent session's spot → Wai'ao.
  const [pickedSpot, setSpot] = useState<string | null>(null);
  const spot =
    pickedSpot ??
    (isOption(defaultSpot) ? defaultSpot : isOption(recentSpot) ? recentSpot : "waiao");
  const isDefault = spot === defaultSpot;
  const spotId = useId();
  const [date, setDate] = useState(taipeiToday);
  const [time, setTime] = useState(taipeiNearestSlot);
  const [notesHtml, setNotesHtml] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot, when: `${date}T${time}`, notesHtml, rating, boardId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSave"));
      onCreated(body.session as Session);
      setNotesHtml("");
      setRating(null);
      setEditorKey((k) => k + 1);
      const filled = body.session?.condOpenMeteo != null;
      toast.success(filled ? t("toast.savedFilled") : t("toast.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSave"));
    } finally {
      setSaving(false);
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
                  ? "bg-[#0E7C86]/10 text-[#0E7C86]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {isDefault && <Check className="size-3" aria-hidden />}
              {isDefault ? t("form.defaultSpot") : t("form.setAsDefault")}
            </button>
          }
        >
          <Select value={spot} onValueChange={setSpot}>
            <SelectTrigger id={spotId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((region) => (
                <SelectGroup key={region}>
                  <SelectLabel>{t(`region.${region}`)}</SelectLabel>
                  {SPOTS.filter((s) => s.region === region).map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {spotLabel(s.slug, lang)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
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
        <div className="flex flex-col gap-1.5">
          <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
            {t("form.ratingOptional")}
          </span>
          <RatingPicker value={rating} onChange={setRating} />
        </div>
        <BoardSelect boards={boards} value={boardId} onChange={setBoardId} className="w-full min-w-[180px]" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? t("form.saving") : t("form.saveSession")}
        </Button>
        <span className="text-[13px] font-medium text-muted-foreground">
          {t("form.autoFillHint")}
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
