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
import { OVERSEAS_PRESETS } from "@/lib/overseas-presets";
import { TIME_SLOTS } from "@/lib/time-slots";
import type { Cond, Session } from "@/lib/types";

const REGIONS: Region[] = ["Northeast", "North", "East", "South", "West"];

const COND_FIELDS: { key: keyof Cond; label: string; placeholder: string }[] = [
  { key: "swellHeightM", label: "Swell m", placeholder: "1.2" },
  { key: "swellPeriodS", label: "Period s", placeholder: "6.8" },
  { key: "swellDir", label: "Swell from", placeholder: "NE" },
  { key: "windSpeedMs", label: "Wind m/s", placeholder: "6" },
  { key: "windGustMs", label: "Gust m/s", placeholder: "8" },
  { key: "windDir", label: "Wind from", placeholder: "NNE" },
  { key: "tideM", label: "Tide m", placeholder: "1.6" },
  { key: "tideNote", label: "Tide note", placeholder: "rising — high 09:46" },
  { key: "seaTempC", label: "Sea °C", placeholder: "29" },
  { key: "airTempC", label: "Air °C", placeholder: "26" },
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
    if (!res.ok) throw new Error(body?.error ?? "Couldn't save");
    return body.session as Session;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await save();
      onSaved(saved);
      toast.success("Changes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
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
        saved.condOpenMeteo != null ? "Conditions refreshed" : "Still no coordinates for this spot"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refresh");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-6 mb-5 flex flex-col gap-4.5 rounded-[var(--r-tile)] bg-secondary p-5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Field label="Spot">
          <Select value={spot} onValueChange={setSpot}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((region) => (
                <SelectGroup key={region}>
                  <SelectLabel>{region}</SelectLabel>
                  {SPOTS.filter((s) => s.region === region).map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              <SelectGroup>
                <SelectLabel>Elsewhere</SelectLabel>
                {OVERSEAS_PRESETS.map((name) => (
                  <SelectItem key={name} value={`custom:${name}`}>
                    {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date">
          <Input
            type="date"
            className="bg-background"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Time">
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
            Conditions (Swelleye, entered by hand)
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={handleRefreshConditions}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh Open-Meteo"}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COND_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
                {f.label}
              </span>
              <Input
                className="bg-background"
                placeholder={f.placeholder}
                value={(cond[f.key] as string | number | undefined | null) ?? ""}
                onChange={(e) => setCondField(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">Notes</span>
        <RichTextEditor
          defaultHtml={notesHtml}
          onChangeHtml={setNotesHtml}
          className="bg-background"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
          Rating (optional)
        </span>
        <RatingPicker value={rating} onChange={setRating} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="rounded-full px-6">
          Cancel
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
