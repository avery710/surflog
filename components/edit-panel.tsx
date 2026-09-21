"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SPOTS, type Region } from "@/lib/spots";
import { spotLabel } from "@/lib/format";
import { useLang, type TKey } from "@/lib/i18n";
import { TIME_SLOTS } from "@/lib/time-slots";
import type { Cond, Session } from "@/lib/types";

const REGIONS: Region[] = ["Northeast", "North", "East", "South", "West"];

type CondFieldKey = Exclude<keyof Cond, "sky" | "source" | "filledAt">;

// placeholder: a literal example value, or a translation key for prose
const COND_FIELDS: { key: CondFieldKey; placeholder: string | TKey }[] = [
  { key: "swellHeightM", placeholder: "1.2" },
  { key: "swellPeriodS", placeholder: "6.8" },
  { key: "swellDir", placeholder: "NE" },
  { key: "windSpeedMs", placeholder: "6" },
  { key: "windGustMs", placeholder: "8" },
  { key: "windDir", placeholder: "NNE" },
  { key: "tideM", placeholder: "1.6" },
  { key: "tideNote", placeholder: "cond.tideNotePlaceholder" },
  { key: "seaTempC", placeholder: "29" },
  { key: "airTempC", placeholder: "26" },
];

export function EditPanel({
  session,
  onSaved,
  onCancel,
}: {
  session: Session;
  onSaved: (s: Session) => void;
  onCancel: () => void;
}) {
  const { lang, t } = useLang();
  const [spot, setSpot] = useState(session.spot);
  const [date, setDate] = useState(session.when.slice(0, 10));
  const [time, setTime] = useState(session.when.slice(11, 16));
  const [cond, setCond] = useState<Partial<Cond>>(session.cond ?? {});
  const [notesHtml, setNotesHtml] = useState(session.notesHtml);
  const [rating, setRating] = useState<number | null>(session.rating);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function setCondField(key: keyof Cond, value: string) {
    setCond((c) => ({ ...c, [key]: value }));
  }

  async function save(extra?: Record<string, unknown>) {
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spot,
        when: `${date}T${time}`,
        notesHtml,
        rating,
        cond: hasAnyCond(cond) ? cond : null,
        ...extra,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSave"));
    return body.session as Session;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await save();
      onSaved(saved);
      toast.success(t("toast.changesSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshConditions() {
    setRefreshing(true);
    try {
      const saved = await save({ refreshConditions: true });
      onSaved(saved);
      toast.success(
        saved.condOpenMeteo != null ? t("toast.conditionsRefreshed") : t("toast.stillNoCoords")
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntRefresh"));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4.5 p-6">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Field label={t("form.spot")}>
          <Select value={spot} onValueChange={setSpot}>
            <SelectTrigger className="w-full bg-background">
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
              {session.spot.startsWith("custom:") && (
                <SelectGroup>
                  <SelectItem value={session.spot}>{spotLabel(session.spot, lang)}</SelectItem>
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("form.date")}>
          <Input
            type="date"
            className="bg-background"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={t("form.time")}>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger className="w-full bg-background">
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

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
            {t("edit.conditionsHeader")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={handleRefreshConditions}
            disabled={refreshing}
          >
            {refreshing ? t("edit.refreshing") : t("edit.refreshOpenMeteo")}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COND_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
                {t(`cond.${f.key}`)}
              </span>
              <Input
                className="bg-background"
                placeholder={f.placeholder.startsWith("cond.") ? t(f.placeholder as TKey) : f.placeholder}
                value={(cond[f.key] as string | number | undefined | null) ?? ""}
                onChange={(e) => setCondField(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("form.notes")}</span>
        <RichTextEditor
          defaultHtml={notesHtml}
          onChangeHtml={setNotesHtml}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
          {t("form.ratingOptional")}
        </span>
        <RatingPicker value={rating} onChange={setRating} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? t("form.saving") : t("edit.saveChanges")}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="rounded-full px-6">
          {t("edit.cancel")}
        </Button>
      </div>
    </div>
  );
}

function hasAnyCond(c: Partial<Cond>): boolean {
  return Object.entries(c).some(
    ([k, v]) => k !== "source" && k !== "filledAt" && v !== "" && v != null
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Label className="flex min-w-0 flex-col items-start gap-1.5">
      <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </Label>
  );
}
