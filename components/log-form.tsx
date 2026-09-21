"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { spotLabel, taipeiNearestSlot, taipeiToday } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { TIME_SLOTS } from "@/lib/time-slots";
import type { Session } from "@/lib/types";

const REGIONS: Region[] = ["Northeast", "North", "East", "South", "West"];

export function LogForm({
  onCreated,
}: {
  onCreated: (s: Session) => void;
}) {
  const { lang, t } = useLang();
  const [spot, setSpot] = useState("waiao");
  const [date, setDate] = useState(taipeiToday);
  const [time, setTime] = useState(taipeiNearestSlot);
  const [notesHtml, setNotesHtml] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot, when: `${date}T${time}`, notesHtml, rating }),
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
        <Field label={t("form.spot")}>
          <Select value={spot} onValueChange={setSpot}>
            <SelectTrigger className="w-full">
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
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
