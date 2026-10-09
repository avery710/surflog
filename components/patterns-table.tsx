"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { SpotReviewsDialog } from "@/components/spot-reviews-dialog";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { useLang } from "@/lib/i18n";
import { INLINE_FIELD, INLINE_FIELD_IDLE } from "@/lib/inline-field";
import type { Spot } from "@/lib/spots";
import type { Session } from "@/lib/types";

const noop = () => {};

const MAX_DESCRIPTION = 500;

export function PatternsTable({
  sessions,
  spotNotes,
  onSaveSpotNote,
  readOnly = false,
}: {
  sessions: Session[];
  spotNotes: Record<string, string>;
  onSaveSpotNote: (spot: string, description: string) => Promise<boolean>;
  /** Static display (landing demo): notes are plain text, no edit button. */
  readOnly?: boolean;
}) {
  const { lang, t } = useLang();
  const catalog = useSpotCatalog();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // "Share as review": the spot's review window, started from the private note.
  const [sharing, setSharing] = useState<{ spot: Spot; note: string } | null>(null);
  // Esc unmounts the input, which can still fire a blur — don't save then.
  const cancelled = useRef(false);

  if (sessions.length < 2) return null;

  const bySpot = new Map<string, number>();
  for (const s of sessions) {
    bySpot.set(s.spot, (bySpot.get(s.spot) ?? 0) + 1);
  }

  const rows = [...bySpot.entries()]
    .map(([slug, n]) => ({ slug, n }))
    .sort((a, b) => b.n - a.n);

  function startEdit(slug: string) {
    cancelled.current = false;
    setDraft(spotNotes[slug] ?? "");
    setEditing(slug);
  }

  async function commit(slug: string) {
    if (cancelled.current || saving) return;
    const next = draft.trim();
    if (next === (spotNotes[slug] ?? "")) {
      setEditing(null);
      return;
    }
    setSaving(true);
    const ok = await onSaveSpotNote(slug, next);
    setSaving(false);
    if (ok) setEditing(null);
  }

  return (
    // Full width — this is its own row in journal.tsx now, not sharing one
    // with ActivityCalendar (moved to sit beside the goal card instead, see
    // journal.tsx). max-h caps how tall it can grow with many spots; past
    // that the row list scrolls internally rather than pushing the rest of
    // the page down. min-w-0 lets the table's own horizontal scroll
    // (min-w-[420px] on the <table>, overflow-auto below) handle anything
    // narrower than that, rather than forcing this section wider.
    <section className="w-full min-w-0">
      <div className="flex max-h-[320px] flex-col rounded-[var(--r-card)] border border-card-border bg-card p-2">
        <h2 className="shrink-0 px-3 pt-2 font-sans text-[13px] font-bold text-muted-foreground">
          {t("patterns.title")}
        </h2>
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[420px] border-separate [border-spacing:0_0]">
            <thead>
              <tr>
                {[t("form.spot"), t("patterns.sessions"), t("patterns.description")].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 pb-0.5 pt-2.5 text-left text-xs font-semibold text-[var(--faint)]"
                  >
                    {h}
                  </th>
                ))}
                {!readOnly && (
                  <th>
                    <span className="sr-only">{t("patterns.shareReview")}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const label = catalog.label(r.slug, lang);
                const note = spotNotes[r.slug];
                // Only catalogue spots have a row on /spots and reviews (not pending requests).
                const spot = readOnly ? undefined : catalog.bySlug(r.slug);
                return (
                  <tr key={r.slug}>
                    <td className="rounded-l-[var(--r-tile)] px-4 py-1 align-middle font-sans text-[15px] font-bold tracking-[-0.015em] whitespace-nowrap">
                      {spot ? (
                        <Link
                          href={`/spots/${encodeURIComponent(spot.slug)}`}
                          className="rounded-sm underline decoration-transparent underline-offset-4 outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-1 align-middle font-mono text-[13.5px] tabular-nums">
                      {r.n}
                    </td>
                    <td className={`w-full px-1 py-0.5 align-middle ${readOnly ? "rounded-r-[var(--r-tile)]" : ""}`}>
                      {readOnly ? (
                        note ? (
                          <p className="px-3.5 py-[2px] text-[14px] leading-5 whitespace-pre-wrap break-words">{note}</p>
                        ) : null
                      ) : editing === r.slug ? (
                        <textarea
                          autoFocus
                          rows={3}
                          value={draft}
                          maxLength={MAX_DESCRIPTION}
                          disabled={saving}
                          placeholder={t("patterns.descriptionPlaceholder")}
                          aria-label={t("patterns.editDescription", { spot: label })}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commit(r.slug)}
                          onKeyDown={(e) => {
                            // Enter starts a new line; Ctrl/Cmd+Enter saves. Enter during IME composition (注音/倉頡) is left alone.
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              void commit(r.slug);
                            } else if (e.key === "Escape") {
                              cancelled.current = true;
                              setEditing(null);
                            }
                          }}
                          className={`w-full resize-y text-[14px] leading-6 ${INLINE_FIELD}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(r.slug)}
                          aria-label={t("patterns.editDescription", { spot: label })}
                          className={
                            note
                              ? `w-full text-left text-[14px] whitespace-pre-wrap break-words ${INLINE_FIELD_IDLE}`
                              : `text-left text-[13px] font-medium text-[var(--faint)] hover:text-muted-foreground ${INLINE_FIELD_IDLE}`
                          }
                        >
                          {note || t("patterns.addDescription")}
                        </button>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="rounded-r-[var(--r-tile)] py-0.5 pr-2 align-middle">
                        {spot && note ? (
                          // Tooltip on hover and keyboard focus (the native title is slow and never shows on touch).
                          <span className="group relative inline-flex">
                            <button
                              type="button"
                              onClick={() => setSharing({ spot, note })}
                              aria-label={t("patterns.shareReviewLabel", { spot: label })}
                              aria-describedby={`share-tip-${spot.slug}`}
                              className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <Megaphone className="size-4" aria-hidden />
                            </button>
                            <span
                              role="tooltip"
                              id={`share-tip-${spot.slug}`}
                              className="pointer-events-none absolute top-full right-0 z-10 mt-1 rounded-md bg-foreground px-2 py-1 text-[12px] font-medium whitespace-nowrap text-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                            >
                              {t("patterns.shareReview")}
                            </span>
                          </span>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <SpotReviewsDialog
        spot={sharing?.spot ?? null}
        draftBody={sharing?.note}
        onOpenChange={(open) => !open && setSharing(null)}
        onSummary={noop}
      />
    </section>
  );
}
