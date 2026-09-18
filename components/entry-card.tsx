"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConditionTile } from "@/components/condition-tile";
import { EditPanel } from "@/components/edit-panel";
import { cn } from "cn";
import { spotBySlug } from "@/lib/spots";
import { toCompass } from "@/lib/openmeteo";
import { computeSessionFit } from "@/lib/session-fit";
import { fitDescriptions } from "@/lib/spot-fit-descriptions";
import { fmtWhen, spotLabel } from "@/lib/format";
import type { Session } from "@/lib/types";

export function EntryCard({
  session,
  onUpdated,
  onDeleted,
}: {
  session: Session;
  onUpdated: (s: Session) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    };
  }, []);

  const spot = spotBySlug(session.spot);
  const fit = computeSessionFit(spot, session);
  const badges = fit ? fitDescriptions(fit) : [];

  // Two-step confirm instead of window.confirm(): a native confirm() dialog
  // blocks the whole tab's render thread until dismissed — bad UX in
  // general, and it freezes browser automation tooling outright.
  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      confirmTimeout.current = setTimeout(() => setConfirmingDelete(false), 4000);
      return;
    }
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    void performDelete();
  }

  async function performDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't delete");
      onDeleted(session.id);
      toast.success("Session deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/sessions/${session.id}/photos`, {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      onUpdated(body.session as Session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto(photoId: string) {
    try {
      const res = await fetch(`/api/sessions/${session.id}/photos/${photoId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Couldn't remove photo");
      onUpdated(body.session as Session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove photo");
    }
  }

  const om = session.condOpenMeteo;
  const manual = session.cond;

  return (
    <article className="mt-3.5 overflow-hidden rounded-[var(--r-card)] border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-3 px-6 pt-5.5 pb-3.5">
        <span className="text-[21px] font-bold tracking-[-0.02em] leading-tight">
          {spotLabel(session.spot)}
        </span>
        <span className="rounded-full bg-secondary px-3 py-1 text-[13px] font-medium tabular-nums text-muted-foreground">
          {fmtWhen(session.when)}
        </span>
        {session.rating != null && <ReadOnlyStars value={session.rating} />}
        <span className="flex-1" />
        <span className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close" : "Edit"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "+ Media"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={handleUpload}
          />
          <Button
            variant={confirmingDelete ? "destructive" : "secondary"}
            size="sm"
            className="rounded-full text-muted-foreground hover:text-destructive"
            onClick={handleDeleteClick}
            onBlur={() => setConfirmingDelete(false)}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : confirmingDelete ? "Really delete?" : "Delete"}
          </Button>
        </span>
      </div>

      {om ? (
        <div className="flex gap-2.5 overflow-x-auto px-6 pb-1.5 [scrollbar-width:none]">
          <ConditionTile
            label="Swell (Open-Meteo)"
            value={om.swellHeightM}
            unit="m"
            sub={
              om.swellPeriodS != null || om.swellDirDeg != null
                ? `@ ${om.swellPeriodS ?? "—"} s from ${toCompass(om.swellDirDeg) ?? "—"}`
                : undefined
            }
          />
          {(om.secondarySwellHeightM != null || om.secondarySwellPeriodS != null) && (
            <ConditionTile
              label="2nd swell"
              value={om.secondarySwellHeightM}
              unit="m"
              sub={
                om.secondarySwellPeriodS != null
                  ? `@ ${om.secondarySwellPeriodS} s from ${toCompass(om.secondarySwellDirDeg) ?? "—"}`
                  : undefined
              }
            />
          )}
          <ConditionTile
            label="Wind waves"
            value={om.windWaveHeightM}
            unit="m"
            sub={om.windWavePeriodS != null ? `@ ${om.windWavePeriodS} s` : undefined}
          />
          <ConditionTile
            label="Wind"
            value={om.windSpeedMs}
            unit="m/s"
            sub={
              om.windDirDeg != null || om.windGustMs != null
                ? `${om.windDirDeg != null ? "from " + toCompass(om.windDirDeg) : ""}${
                    om.windGustMs != null ? ` · gust ${om.windGustMs}` : ""
                  }`
                : undefined
            }
          />
          <ConditionTile
            label="Temp"
            value={om.seaTempC}
            unit="° sea"
            sub={om.airTempC != null ? `${om.airTempC}° air` : undefined}
          />
        </div>
      ) : null}

      {manual ? (
        <div className="flex gap-2.5 overflow-x-auto px-6 pt-1 pb-1.5 [scrollbar-width:none]">
          <ConditionTile
            label="Swell (Swelleye)"
            value={manual.swellHeightM}
            unit="m"
            sub={
              manual.swellPeriodS != null || manual.swellDir
                ? `@ ${manual.swellPeriodS ?? "—"} s${manual.swellDir ? " from " + manual.swellDir : ""}`
                : undefined
            }
          />
          <ConditionTile
            label="Wind"
            value={manual.windSpeedMs}
            unit="m/s"
            sub={
              manual.windDir || manual.windGustMs != null
                ? `${manual.windDir ? "from " + manual.windDir : ""}${
                    manual.windGustMs != null ? ` · gust ${manual.windGustMs}` : ""
                  }`
                : undefined
            }
          />
          <ConditionTile label="Tide" value={manual.tideM} unit="m" sub={manual.tideNote} />
        </div>
      ) : !om ? (
        <div className="mx-6 mb-2 mt-1 flex flex-wrap items-center gap-3 rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4.5 py-4">
          <p className="min-w-[180px] flex-1 text-[14.5px] font-medium text-foreground">
            No coordinates yet for this spot — Open-Meteo can&#39;t fill in conditions
            automatically. Enter Swelleye&#39;s numbers by hand if you have them.
          </p>
          <Button size="sm" className="rounded-full" onClick={() => setEditing(true)}>
            Type them in
          </Button>
        </div>
      ) : (
        <div className="mx-6 mb-1 mt-1">
          <button
            onClick={() => setEditing(true)}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            + Add Swelleye&#39;s headline numbers
          </button>
        </div>
      )}

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-6 pb-1 pt-1.5">
          {badges.map((b) => (
            <Badge key={b} variant="secondary" className="font-normal text-muted-foreground">
              {b}
            </Badge>
          ))}
        </div>
      )}

      {session.notesHtml && (
        <div
          className="notes-html px-6 pt-2.5 pb-1.5 font-serif text-[17px] leading-[1.62]"
          dangerouslySetInnerHTML={{ __html: session.notesHtml }}
        />
      )}

      {session.photos.length > 0 && (
        <div className="flex flex-wrap gap-2.5 px-6 pt-3 pb-1.5">
          {session.photos.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group relative h-24",
                p.type.startsWith("video/") ? "w-[150px]" : "w-24"
              )}
            >
              {p.type.startsWith("video/") ? (
                <video
                  src={`/api/blob/${p.id}`}
                  controls
                  preload="metadata"
                  playsInline
                  className="h-full w-full rounded-[var(--r-tile)] bg-black object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/blob/${p.id}`}
                  alt={`Surf photo from ${fmtWhen(session.when)}`}
                  loading="lazy"
                  className="h-full w-full rounded-[var(--r-tile)] object-cover"
                />
              )}
              <button
                aria-label="Remove photo"
                onClick={() => handleRemovePhoto(p.id)}
                className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditPanel
          session={session}
          onSaved={(s) => {
            onUpdated(s);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 px-6 pt-2.5 pb-5">
        {session.example && (
          <span className="rounded-full bg-[var(--warm-soft)] px-3.5 py-1 text-[11.5px] font-semibold text-warm">
            Example — delete whenever
          </span>
        )}
        {om && (
          <span className="rounded-full bg-accent px-3.5 py-1 text-[11.5px] font-semibold text-primary">
            Open-Meteo · auto
          </span>
        )}
        {manual && (
          <span className="rounded-full bg-secondary px-3.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
            {manual.source === "swelleye" ? "Swelleye forecast" : "Entered by hand"}
          </span>
        )}
      </div>
    </article>
  );
}

function ReadOnlyStars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("size-3.5", n <= value ? "fill-warm text-warm" : "fill-transparent text-border")}
        />
      ))}
    </span>
  );
}
