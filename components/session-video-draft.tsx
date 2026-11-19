"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import { SpotPicker } from "@/components/spot-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { latestLoggableWhen, todayInZone } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { draftWhen } from "@/lib/session-draft";
import { TIME_SLOTS } from "@/lib/time-slots";
import { UploadError, uploadSessionVideo } from "@/lib/upload-client";
import { MAX_SESSION_VIDEO_BYTES, MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { readVideoMeta, videoMime } from "@/lib/video-meta";

type Draft = {
  file: File;
  createdAt: Date | null;
  spot: string;
  date: string;
  time: string;
  fromSpot: boolean;
  fromTime: boolean;
  timeTouched: boolean;
};

/**
 * Pick a video, read its time and GPS, and show a session draft. Nothing is
 * saved until "Save session": the upload goes straight to Storage only then,
 * and a failed upload deletes the session it just created.
 */
export function SessionVideoDraft({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const { t } = useLang();
  const catalog = useSpotCatalog();
  const router = useRouter();
  const inputId = useId();
  const spotId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [fraction, setFraction] = useState(0);

  const tz = catalog.bySlug(draft?.spot ?? "")?.timezone ?? "Asia/Taipei";
  const today = todayInZone(tz);
  const latest = latestLoggableWhen(tz);
  const slotAllowed = (slot: string) => !draft?.date || `${draft.date}T${slot}` <= latest;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!videoMime(file)) {
      toast.error(t("video.badType"));
      return;
    }
    if (file.size > MAX_SESSION_VIDEO_BYTES) {
      toast.error(t("video.tooLarge"));
      return;
    }
    setReading(true);
    setDraft(null);
    try {
      const meta = await readVideoMeta(file);
      let spot = "";
      let zone = "Asia/Taipei";
      let fromSpot = false;
      if (meta.location) {
        const res = await fetch("/api/spots/nearest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meta.location),
        });
        const body = await res.json().catch(() => null);
        if (res.ok && typeof body?.slug === "string") {
          spot = body.slug;
          zone = catalog.bySlug(spot)?.timezone ?? body.timezone ?? zone;
          fromSpot = true;
        }
      }
      const when = meta.createdAt ? draftWhen(meta.createdAt, zone) : null;
      setDraft({
        file,
        createdAt: meta.createdAt,
        spot,
        date: when ? when.slice(0, 10) : "",
        time: when ? when.slice(11, 16) : "",
        fromSpot,
        fromTime: when != null,
        timeTouched: false,
      });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function setSpot(slug: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      let date = prev.date;
      let time = prev.time;
      if (!prev.timeTouched && prev.createdAt) {
        const when = draftWhen(prev.createdAt, catalog.bySlug(slug)?.timezone ?? "Asia/Taipei");
        if (when) {
          date = when.slice(0, 10);
          time = when.slice(11, 16);
        }
      }
      return { ...prev, spot: slug, date, time };
    });
  }

  async function save() {
    if (!draft?.spot || !draft.date || !draft.time || saving) return;
    setSaving(true);
    setFraction(0);
    onBusyChange?.(true);
    let createdId: string | null = null;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot: draft.spot, when: `${draft.date}T${draft.time}` }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.session?.id) throw new Error(body?.error || t("toast.couldntSave"));
      createdId = body.session.id as string;
      const uploadId = await uploadSessionVideo(draft.file, setFraction);
      const attach = await fetch(`/api/sessions/${createdId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, kind: "session-video" }),
      });
      if (!attach.ok) {
        const failed = await attach.json().catch(() => null);
        throw new UploadError(failed?.code === "too_large" ? "too_large" : "failed");
      }
      router.push(`/sessions/${createdId}/clips`);
      router.refresh();
    } catch (e) {
      if (createdId) {
        await fetch(`/api/sessions/${createdId}`, { method: "DELETE" }).catch(() => null);
      }
      const code = e instanceof UploadError ? e.code : null;
      toast.error(
        code === "too_large" ? t("video.storageLimit") : code === "bad_type" ? t("video.badType") : e instanceof Error && code == null ? e.message : t("video.failed")
      );
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  const hint = !draft
    ? null
    : draft.fromSpot && draft.fromTime
      ? t("video.hintBoth")
      : draft.fromSpot
        ? t("video.hintTime")
        : draft.fromTime
          ? t("video.hintSpot")
          : t("video.hintNone");

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="video/*,.mov,.mp4,.m4v,.webm"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button type="button" variant="secondary" className="rounded-full" disabled={saving} onClick={() => inputRef.current?.click()}>
        {draft ? draft.file.name : reading ? t("video.reading") : t("video.choose")}
      </Button>

      {draft && draft.file.size > MAX_UPLOAD_BYTES && (
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{t("video.over50")}</p>
      )}

      {draft && (
        <>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{hint}</p>
          <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-3">
              <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("form.spot")}</span>
              <SpotPicker id={spotId} value={draft.spot} onChange={setSpot} placeholder={t("video.pickSpot")} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("form.date")}</span>
              <DatePicker
                value={draft.date}
                onChange={(date) => setDraft({ ...draft, date, timeTouched: true })}
                label={t("form.date")}
                clearable={false}
                today={today}
                max={today}
                placeholder={t("video.pickDate")}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("form.timeInWater")}</span>
              <Select
                value={draft.time || undefined}
                onValueChange={(time) => setDraft({ ...draft, time, timeTouched: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("video.pickTime")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot} disabled={!slotAllowed(slot)}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="rounded-full px-6"
              disabled={saving || !draft.spot || !draft.date || !draft.time}
              onClick={() => void save()}
            >
              {saving ? t("video.saving") : t("video.save")}
            </Button>
            {saving && (
              <span className="font-mono text-[13px] text-muted-foreground">
                {t("video.uploading", { n: Math.round(fraction * 100) })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
