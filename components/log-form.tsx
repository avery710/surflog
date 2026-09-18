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
import { OVERSEAS_PRESETS } from "@/lib/overseas-presets";
import { downloadCsv } from "@/lib/csv";
import { taipeiNearestSlot, taipeiToday } from "@/lib/format";
import { TIME_SLOTS } from "@/lib/time-slots";
import type { Session } from "@/lib/types";

const REGIONS: Region[] = ["Northeast", "North", "East", "South", "West"];

export function LogForm({
  sessions,
  onCreated,
}: {
  sessions: Session[];
  onCreated: (s: Session) => void;
}) {
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
      if (!res.ok) throw new Error(body?.error ?? "Couldn't save");
      onCreated(body.session as Session);
      setNotesHtml("");
      setRating(null);
      setEditorKey((k) => k + 1);
      const filled = body.session?.condOpenMeteo != null;
      toast.success(filled ? "Session saved — conditions filled in" : "Session saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    if (!sessions.length) {
      toast.info("Nothing to export yet");
      return;
    }
    downloadCsv(sessions);
  }

  return (
    <div className="rounded-[var(--r-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Field label="Spot">
          <Select value={spot} onValueChange={setSpot}>
            <SelectTrigger className="w-full">
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
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time in the water">
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger className="w-full">
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

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">Notes</span>
        <RichTextEditor
          key={editorKey}
          defaultHtml=""
          placeholder='How it felt. What worked, what didn&#39;t. Type "- " for a bullet.'
          onChangeHtml={setNotesHtml}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
            Rating (optional)
          </span>
          <RatingPicker value={rating} onChange={setRating} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? "Saving…" : "Save session"}
        </Button>
        <span className="text-[13px] font-medium text-muted-foreground">
          Conditions fill in automatically from Open-Meteo once saved
        </span>
        <span className="flex-1" />
        <Button variant="secondary" onClick={handleExport} className="rounded-full px-5">
          Export CSV
        </Button>
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
