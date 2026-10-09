"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Pencil, Pin, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Reviews } from "@/components/spot-reviews-dialog";
import { SuggestSpotEditDialog } from "@/components/suggest-spot-edit-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { compassLabel, fmt1, fmtDate, fmtWhen } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import { facingPoints, tideBandKey } from "@/lib/spot-browse";
import type { OwnEditRequest } from "@/lib/spot-edit-requests";
import type { Spot } from "@/lib/spots";

/** One line of the viewer's own history at this spot (built server-side, headline numbers only). */
export interface SpotSession {
  id: string;
  when: string;
  swellM: number | null;
  periodS: number | null;
  windMs: number | null;
  notes: string;
}

const MAX_NOTE = 500;
const noop = () => {};

/** /spots/<slug>: the spot's header (pin, log here), what the shared catalogue
 *  says, the viewer's own history and private note, and everyone's reviews. */
export function SpotDetail({
  spot,
  history,
  note: initialNote,
  pinned: initialPinned,
  pendingEdit,
  canManage,
}: {
  spot: Spot;
  history: SpotSession[];
  note: string;
  pinned: boolean;
  pendingEdit: OwnEditRequest | null;
  /** The spot admin edits on /admin instead of suggesting. */
  canManage: boolean;
}) {
  const { lang, t } = useLang();
  const name = lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name;
  const other = spot.nameZh && spot.nameZh !== spot.name ? (lang === "zh-TW" ? spot.name : spot.nameZh) : null;
  const place = spot.region ? `${t("picker.taiwan")} · ${t(`region.${spot.region}`)}` : [spot.country, spot.area].filter(Boolean).join(" · ");
  const points = (list: string[]) => list.map((p) => compassLabel(p, lang) ?? p).join(lang === "zh-TW" ? "、" : ", ");
  const tideKey = spot.bestTide ? tideBandKey(spot.bestTide) : null;

  const facts: { label: string; value: string }[] = [];
  if (spot.facing) facts.push({ label: t("spots.faces"), value: points(facingPoints(spot.facing)) });
  if (spot.bestSwellDir?.length) facts.push({ label: t("spots.bestSwell"), value: points(spot.bestSwellDir) });
  if (spot.bestWindDir?.length) facts.push({ label: t("spots.bestWind"), value: points(spot.bestWindDir) });
  if (spot.bestTide) facts.push({ label: t("spots.bestTide"), value: tideKey ? t(tideKey) : spot.bestTide });

  // --- pin (optimistic, undone on failure)
  const [pinned, setPinned] = useState(initialPinned);
  async function togglePin() {
    const on = !pinned;
    setPinned(on);
    try {
      const res = await fetch(`/api/spots/${encodeURIComponent(spot.slug)}/pin`, { method: on ? "PUT" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setPinned(!on);
      toast.error(t("spots.pinFailed"));
    }
  }

  // --- the private note
  const [note, setNote] = useState(initialNote);
  const [draft, setDraft] = useState(initialNote);
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  async function saveNote() {
    const next = draft.trim();
    if (next === note) {
      setEditingNote(false);
      return;
    }
    setSavingNote(true);
    try {
      const res = await fetch("/api/spot-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot: spot.slug, description: next }),
      });
      if (!res.ok) throw new Error();
      setNote(next);
      setEditingNote(false);
    } catch {
      toast.error(t("toast.couldntSaveDescription"));
    } finally {
      setSavingNote(false);
    }
  }

  // --- suggest an edit
  const [suggesting, setSuggesting] = useState(false);
  const [edit, setEdit] = useState(pendingEdit);

  const days = history.map((h) => h.when.slice(0, 10)).sort();
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <div className={`${PAGE_COLUMN} min-w-0 flex-1 pb-18 pt-6`}>
      <Link
        href="/spots"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("spotPage.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{name}</h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {[other, place].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void togglePin()}
            aria-pressed={pinned}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-full border border-input px-4 text-[13.5px] font-semibold outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
              pinned ? "text-primary" : "text-foreground"
            )}
          >
            <Pin className={cn("size-4", pinned && "fill-current")} aria-hidden />
            {t(pinned ? "spotPage.pinned" : "spotPage.pin")}
          </button>
          <Button asChild className="h-10 rounded-full px-4">
            <Link href={`/?log=1&spot=${encodeURIComponent(spot.slug)}`}>
              <Plus aria-hidden />
              {t("spotPage.logHere")}
            </Link>
          </Button>
        </div>
      </div>

      <section className="mt-6 rounded-[var(--r-card)] border border-card-border bg-card px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-bold text-muted-foreground">{t("spotPage.about")}</h2>
          {!canManage && (
            <button
              type="button"
              onClick={() => setSuggesting(true)}
              className="-my-1 flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Pencil className="size-3.5" aria-hidden />
              {t("spotEdit.button")}
            </button>
          )}
        </div>
        {edit && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">{t("spotEdit.pendingBadge")}</p>
        )}
        {facts.length > 0 ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[11.5px] font-semibold text-muted-foreground">{f.label}</dt>
                <dd className="mt-0.5 font-mono text-[14px] break-words">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-[13.5px] text-muted-foreground">{t("spotPage.noInfo")}</p>
        )}
        <div className="mt-5 border-t border-card-border pt-4">
          <h2 className="mb-1 text-[13px] font-bold text-muted-foreground">{t("spotPage.reviews")}</h2>
          <p className="mb-3 text-[12.5px] text-muted-foreground">{t("review.intro")}</p>
          <Reviews spot={spot} onSummary={noop} />
        </div>
      </section>

      <section className="mt-4 rounded-[var(--r-card)] border border-card-border bg-card px-5 py-4">
        <h2 className="text-[13px] font-bold text-muted-foreground">{t("spotPage.history")}</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-muted-foreground">{t("spotPage.noSessions")}</p>
        ) : (
          <p className="mt-2 text-[13.5px]">
            <span className="font-mono font-semibold">{history.length}</span> {t("spotPage.sessions")}
            {first && last && (
              <span className="text-muted-foreground">
                {" · "}
                {first === last
                  ? fmtDate(first, lang, false)
                  : t("spotPage.range", { from: fmtDate(first, lang, false), to: fmtDate(last, lang, false) })}
              </span>
            )}
          </p>
        )}

        <h3 className="mt-4 text-[12px] font-semibold text-muted-foreground">{t("patterns.description")}</h3>
        {editingNote ? (
          <div className="mt-1.5 flex flex-col gap-2">
            <Textarea
              autoFocus
              value={draft}
              maxLength={MAX_NOTE}
              rows={3}
              disabled={savingNote}
              placeholder={t("patterns.descriptionPlaceholder")}
              aria-label={t("patterns.editDescription", { spot: name })}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" className="rounded-full px-4" disabled={savingNote} onClick={() => void saveNote()}>
                {t("review.update")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                disabled={savingNote}
                onClick={() => (setDraft(note), setEditingNote(false))}
              >
                {t("review.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (setDraft(note), setEditingNote(true))}
            aria-label={t("patterns.editDescription", { spot: name })}
            className={cn(
              "mt-1 w-full rounded-xl px-2 py-1.5 text-left outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
              note ? "text-[14px] whitespace-pre-wrap break-words" : "text-[13px] font-medium text-[var(--faint)]"
            )}
          >
            {note || t("patterns.addDescription")}
          </button>
        )}

        {history.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-card-border rounded-[var(--r-tile)] border border-card-border">
            {history.map((h) => (
              <li key={h.id} className="px-3.5 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-[13.5px] font-semibold tabular-nums">{fmtWhen(h.when, lang)}</span>
                  <span className="font-mono text-[12.5px] text-muted-foreground">
                    {[
                      h.swellM != null ? `${fmt1(h.swellM)} m` : null,
                      h.periodS != null ? `${fmt1(h.periodS)} s` : null,
                      h.windMs != null ? `${fmt1(h.windMs)} m/s` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                {h.notes && <p className="mt-1 text-[13px] leading-relaxed break-words text-muted-foreground">{h.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>


      <SuggestSpotEditDialog
        spot={suggesting ? spot : null}
        pending={edit}
        onOpenChange={(open) => !open && setSuggesting(false)}
        onSent={(r) => setEdit(r)}
        onWithdrawn={() => setEdit(null)}
      />
    </div>
  );
}
