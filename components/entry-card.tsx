"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConditionTile, Figure } from "@/components/condition-tile";
import { EditPanel } from "@/components/edit-panel";
import { cn } from "cn";
import { spotBySlug } from "@/lib/spots";
import { toCompass } from "@/lib/openmeteo";
import { computeSessionFit } from "@/lib/session-fit";
import { compassLabel, fmt1, fmtWhen, spotLabel } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { TideEventsSub, tideTrend } from "@/components/tide-events";
import { TideChart } from "@/components/tide-chart";
import { DirectionArrow } from "@/components/direction-arrow";
import { WindStrength } from "@/components/wind-strength";
import { WindShoreBadge } from "@/components/wind-shore-badge";
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
  const { lang, t } = useLang();
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
      if (!res.ok) throw new Error(t("toast.couldntDelete"));
      onDeleted(session.id);
      toast.success(t("toast.sessionDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntDelete"));
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
      if (!res.ok) throw new Error(body?.error ?? t("toast.uploadFailed"));
      onUpdated(body.session as Session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.uploadFailed"));
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
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntRemovePhoto"));
      onUpdated(body.session as Session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.couldntRemovePhoto"));
    }
  }

  const om = session.condOpenMeteo;
  const manual = session.cond;
  const hasShore = !!fit && !fit.missing.includes("windDirDeg") && !fit.missing.includes("spot.facing");
  const omEvents = om?.tideEvents ?? [];
  const omTrend = tideTrend(omEvents, session.when) ?? om?.seaLevelTrend ?? null;
  const trendHeadline = (trend: "rising" | "falling" | null) =>
    trend ? (
      <span className="text-[20px] leading-tight capitalize">{t(trend === "rising" ? "tide.rising" : "tide.falling")}</span>
    ) : null;

  const cardClass =
    "mt-3.5 overflow-hidden rounded-[var(--r-card)] border border-border bg-card shadow-[var(--shadow-card)]";

  if (editing) {
    return (
      <article className={cardClass}>
        <EditPanel
          session={session}
          onSaved={(s) => {
            onUpdated(s);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </article>
    );
  }

  return (
    <article className={cardClass}>
      <div className="flex flex-wrap items-center gap-3 px-6 pt-5.5 pb-3.5">
        <span className="text-[21px] font-bold tracking-[-0.02em] leading-tight">
          {spotLabel(session.spot, lang)}
        </span>
        <span className="rounded-full bg-secondary px-3 py-1 text-[13px] font-medium tabular-nums text-muted-foreground">
          {fmtWhen(session.when, lang)}
        </span>
        {session.rating != null && (
          <ReadOnlyStars value={session.rating} label={t("entry.stars", { n: session.rating })} />
        )}
        <span className="flex-1" />
        <span className="flex flex-wrap gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => setEditing(true)}
          >
            {t("entry.edit")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? t("entry.uploading") : t("entry.addMedia")}
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
            className="rounded-full text-muted-foreground hover:bg-destructive hover:text-white"
            onClick={handleDeleteClick}
            onBlur={() => setConfirmingDelete(false)}
            disabled={deleting}
          >
            {deleting
              ? t("entry.deleting")
              : confirmingDelete
                ? t("entry.reallyDelete")
                : t("entry.delete")}
          </Button>
        </span>
      </div>

      {om ? (
        <div className="flex gap-2.5 overflow-x-auto px-6 pb-1.5 [scrollbar-width:none]">
          {om && (
            <>
              <ConditionTile
                label={t("tile.swellOpenMeteo")}
                value={<Figure value={fmt1(om.swellHeightM)} unit="m" />}
                sub={<DirSub deg={om.swellDirDeg} compass={compassLabel(toCompass(om.swellDirDeg), lang)} />}
              />
              {om.swellPeriodS != null && (
                <ConditionTile
                  label={t("tile.period")}
                  value={
                    <Figure value={fmt1(om.swellPeriodS)} unit="s" />
                  }
                />
              )}
              <ConditionTile
                label={t("tile.wind")}
                value={
                  <span className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-2">
                      <Figure value={fmt1(om.windSpeedMs)} unit="m/s" />
                      {om.windSpeedMs != null && (
                        <span className="font-sans text-[12px] font-medium tracking-normal text-muted-foreground">
                          <WindStrength speedMs={om.windSpeedMs} gustMs={om.windGustMs} />
                        </span>
                      )}
                    </span>
                    {(hasShore || om.windDirDeg != null) && (
                      <span className="inline-flex items-baseline gap-2">
                        <DirSub deg={om.windDirDeg} compass={compassLabel(toCompass(om.windDirDeg), lang)} />
                        {hasShore && (
                          <span className="font-sans text-[12px] font-medium tracking-normal text-muted-foreground">
                            <WindShoreBadge mode={fit.windMode} />
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                }
              />
            </>
          )}
          {/* Open-Meteo is the only tide source shown. CWA's tide stays stored
              (condCwaTide), just not displayed, and so does the manual
              Swelleye tide. */}
          {omEvents.length > 0 && (
            <ConditionTile
              label={t("tile.tideOpenMeteo")}
              value={trendHeadline(omTrend)}
              sub={
                omEvents.length >= 2 ? (
                  <TideChart events={omEvents} sessionWhen={session.when} />
                ) : (
                  <TideEventsSub events={omEvents} sessionWhen={session.when} />
                )
              }
            />
          )}
        </div>
      ) : null}

      {/* Open-Meteo wins where both exist: the typed Swelleye swell/wind
          duplicates its tiles, so it's stored but not shown (and only
          shown when Open-Meteo has nothing for the session). */}
      {manual && om ? null : manual ? (
        <div className="flex gap-2.5 overflow-x-auto px-6 pt-1 pb-1.5 [scrollbar-width:none]">
          <ConditionTile
            label={t("tile.swellSwelleye")}
            value={fmt1(manual.swellHeightM)}
            unit="m"
            sub={
              manual.swellPeriodS != null || manual.swellDir
                ? manual.swellDir
                  ? t("cond.swellSub", {
                      p: fmt1(manual.swellPeriodS) ?? "—",
                      dir: compassLabel(manual.swellDir, lang) ?? "",
                    })
                  : t("cond.periodOnly", { p: fmt1(manual.swellPeriodS) ?? "—" })
                : undefined
            }
          />
          <ConditionTile
            label={t("tile.wind")}
            value={fmt1(manual.windSpeedMs)}
            unit="m/s"
            sub={
              manual.windDir || manual.windGustMs != null
                ? [
                    manual.windDir
                      ? t("cond.windFrom", { dir: compassLabel(manual.windDir, lang) ?? "" })
                      : null,
                    manual.windGustMs != null ? t("cond.gust", { g: fmt1(manual.windGustMs) ?? "" }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
          />
        </div>
      ) : !om ? (
        <div className="mx-6 mb-2 mt-1 flex flex-wrap items-center gap-3 rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4.5 py-4">
          <p className="min-w-[180px] flex-1 text-[14.5px] font-medium text-foreground">
            {t("entry.noCoords")}
          </p>
          <Button size="sm" className="rounded-full" onClick={() => setEditing(true)}>
            {t("entry.typeThemIn")}
          </Button>
        </div>
      ) : null}

      {session.notesHtml && (
        <div
          className="notes-html px-6 pt-2.5 pb-1.5 font-sans text-[15px] leading-[1.65]"
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
                  alt={t("entry.photoAlt", { when: fmtWhen(session.when, lang) })}
                  loading="lazy"
                  className="h-full w-full rounded-[var(--r-tile)] object-cover"
                />
              )}
              <button
                aria-label={t("entry.removePhoto")}
                onClick={() => handleRemovePhoto(p.id)}
                className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {session.example || (manual && !om) ? (
        <div className="flex flex-wrap items-center gap-2 px-6 pt-2.5 pb-5">
        {session.example && (
          <span className="rounded-full bg-[var(--warm-soft)] px-3.5 py-1 text-[11.5px] font-semibold text-warm">
            {t("entry.example")}
          </span>
        )}
        {manual && !om && (
          <span className="rounded-full bg-secondary px-3.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
            {manual.source === "swelleye" ? t("badge.swelleyeForecast") : t("badge.enteredByHand")}
          </span>
        )}
        </div>
      ) : (
        <div className="h-4" />
      )}
    </article>
  );
}

function ReadOnlyStars({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("size-3.5", n <= value ? "fill-warm text-warm" : "fill-transparent text-border")}
        />
      ))}
    </span>
  );
}

/** Direction arrow and compass point, arrow sitting low on the baseline. */
function DirSub({ deg, compass }: { deg: number | null | undefined; compass: string | null | undefined }) {
  if (deg == null) return null;
  return (
    <span className="inline-flex items-baseline gap-1 font-sans text-[12px] font-bold text-primary">
      <DirectionArrow deg={deg} className="relative top-[2px] size-3" strokeWidth={3.5} />
      {compass}
    </span>
  );
}
