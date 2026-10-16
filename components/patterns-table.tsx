"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { AnimatedHeight } from "@/components/animated-height";
import { SpotReviewsDialog } from "@/components/spot-reviews-dialog";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { useLang } from "@/lib/i18n";
import { INLINE_FIELD, INLINE_FIELD_IDLE } from "@/lib/inline-field";
import type { Spot } from "@/lib/spots";
import type { Session } from "@/lib/types";


// --- smooth size changes of the inline note field ---------------------------
// The field's own height eases (200-240 ms, like AnimatedHeight) when it opens
// from the read-view button, as lines are added/removed, and when it closes.
// While one of these runs the element carries `data-height-anim`;
// AnimatedHeight sees that and lets the card follow frame by frame instead of
// starting its own transition (which would ease the same change twice).
const GLIDE = "height 220ms cubic-bezier(0.22, 1, 0.36, 1)";
const MAX_FIELD_HEIGHT = 220;

function glide(el: HTMLElement, from: number, to: number, keep: boolean) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const settle = () => {
    el.removeAttribute("data-height-anim");
    el.style.transition = "";
    el.style.overflow = "";
    if (!keep) el.style.height = "";
    el.removeEventListener("transitionend", onEnd);
  };
  function onEnd(e: TransitionEvent) {
    if (e.target === el && e.propertyName === "height") settle();
  }
  if (reduce || Math.abs(from - to) < 0.5) {
    settle();
    if (keep) el.style.height = `${to}px`;
    return;
  }
  el.setAttribute("data-height-anim", "");
  el.style.transition = "none";
  el.style.overflow = "hidden";
  el.style.height = `${from}px`;
  void el.offsetHeight; // commit the start height before animating
  el.style.transition = GLIDE;
  el.style.height = `${to}px`;
  el.addEventListener("transitionend", onEnd);
}

type FieldHeights = { close: { slug: string; h: number } | null };

/** A textarea that grows to its text (min 3 rows, capped) with an eased height. */
function NoteField({
  slug,
  fromHeight,
  heights,
  ...props
}: React.ComponentProps<"textarea"> & { slug: string; fromHeight: number | null; heights: React.RefObject<FieldHeights> }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);

  // Only height styles are touched here, never the value: safe for IME composition.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = first.current && fromHeight != null ? fromHeight : el.offsetHeight;
    first.current = false;
    el.style.transition = "none";
    el.style.height = "auto";
    const natural = Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), MAX_FIELD_HEIGHT);
    glide(el, from, natural, true);
  }, [props.value, fromHeight]);

  // Remember how tall the field was so the read view can ease down from it.
  useLayoutEffect(() => {
    const el = ref.current;
    const h = heights;
    return () => {
      if (el) h.current.close = { slug, h: el.offsetHeight };
    };
  }, [slug, heights]);

  return <textarea ref={ref} {...props} />;
}

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
  const heights = useRef<FieldHeights>({ close: null });
  const [openFrom, setOpenFrom] = useState<number | null>(null);

  if (sessions.length < 2) return null;

  const bySpot = new Map<string, number>();
  for (const s of sessions) {
    bySpot.set(s.spot, (bySpot.get(s.spot) ?? 0) + 1);
  }

  const rows = [...bySpot.entries()]
    .map(([slug, n]) => ({ slug, n }))
    .sort((a, b) => b.n - a.n);

  function startEdit(slug: string, fromHeight: number) {
    setOpenFrom(fromHeight);
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
      <AnimatedHeight>
      <div className="flex max-h-[320px] flex-col rounded-[var(--r-card)] bg-card p-1.5">
        <h2 className="shrink-0 px-2.5 pt-1.5 font-sans text-[13px] font-bold text-muted-foreground">
          {t("patterns.title")}
        </h2>
        {/* relative: makes this scroller the containing block of absolutely
            positioned descendants (the share column's sr-only header), so
            it clips them. Without it that label escaped the scroller and
            widened the whole page on phones. */}
        <div className="relative flex-1 overflow-auto">
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
                        <NoteField
                          slug={r.slug}
                          fromHeight={openFrom}
                          heights={heights}
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
                          className={`w-full resize-none overflow-y-auto text-[14px] leading-6 ${INLINE_FIELD}`}
                        />
                      ) : (
                        <button
                          type="button"
                          data-slug={r.slug}
                          ref={(el) => {
                            // Closing: ease from the field's last height down to the read view's.
                            const c = heights.current.close;
                            if (el && c && c.slug === r.slug) {
                              heights.current.close = null;
                              glide(el, c.h, el.offsetHeight, false);
                            }
                          }}
                          onClick={(e) => startEdit(r.slug, e.currentTarget.offsetHeight)}
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
      </AnimatedHeight>
      <SpotReviewsDialog
        spot={sharing?.spot ?? null}
        draftBody={sharing?.note}
        onOpenChange={(open) => !open && setSharing(null)}
        onSummary={noop}
      />
    </section>
  );
}
