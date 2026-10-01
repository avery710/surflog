"use client";

/**
 * "Goal for next session": a short bulleted list of technique points per
 * owner, stored as one `goals.text` column — points are newline-separated
 * lines in that single string, not a new table (see CLAUDE.md "Goal for
 * next session"). The card sits above the journal and is edited inline
 * (same click-to-edit / blur-to-save shape as the spot descriptions in
 * patterns-table.tsx, extended to a row per point). Each logged session
 * snapshots the whole joined text plus one achieved/not tick per point
 * (`goal_points_met`; older sessions only have the whole-goal `goal_met`,
 * read through `sessionPointsMet()`). The card counts each point by its
 * own wording across all sessions (`pointStats()`), so editing one point
 * doesn't reset the others.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Plus, Target, X } from "lucide-react";
import { cn } from "cn";
import { CALENDAR_CARD_HEIGHT_PX } from "@/components/activity-calendar";
import { goalPoints, joinGoalPoints, MAX_GOAL, pointStats, type GoalRename } from "@/lib/goal";
import { useLang } from "@/lib/i18n";
import type { Session } from "@/lib/types";

/** Shared type style for a goal point's text — the display bullet list and
 *  the edit-mode inputs both use this, so toggling into/out of edit mode
 *  doesn't change the point text's size, weight, line-height or tracking
 *  (2026-10-01, on request: the inputs used to be a plain 16px). Below
 *  16px, so focusing one of these inputs zooms the viewport on iOS
 *  Safari — accepted here, since matching the display text mattered more
 *  than avoiding that; not worked around in this change. */
const POINT_TEXT_CLASS = "text-[14.5px] font-bold leading-snug tracking-[-0.01em]";

export function GoalCard({
  goal,
  sessions,
  onSave,
}: {
  goal: string | null;
  sessions: Session[];
  /** Resolves true if saved, so the card knows whether to leave edit mode. */
  onSave: (text: string, renames: GoalRename[]) => Promise<boolean>;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  // Each row's text when editing began (null = added this edit), so a
  // changed row can be sent as a rename for past sessions.
  const [origins, setOrigins] = useState<(string | null)[]>([]);
  const [newPoint, setNewPoint] = useState("");
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);
  const newPointRef = useRef<HTMLInputElement>(null);

  // The scrollable points list (display mode only — see the height-cap
  // comment on the card wrapper below) and its bottom fade hint. Managed by
  // direct DOM reads/writes (no React state), same convention as
  // activity-calendar.tsx's updateArrowState — this file avoids
  // setState-in-effect, see CLAUDE.md "Conventions".
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);

  // How it's gone so far, per point, matched by the point's own text in
  // every session (not the whole goal text) — see pointStats().
  const stats = pointStats(goalPoints(goal), sessions);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    const fade = fadeRef.current;
    if (!el || !fade) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    fade.style.opacity = overflowing && !atBottom ? "1" : "0";
    // tabIndex/aria-label toggle with overflow too, so the list is only a
    // keyboard scroll stop (and only announces itself as scrollable) when
    // there's actually something to scroll to.
    if (overflowing) {
      el.tabIndex = 0;
      el.setAttribute("aria-label", t("goal.scrollHint"));
    } else {
      el.removeAttribute("tabindex");
      el.removeAttribute("aria-label");
    }
  }, [t]);

  // Re-check after every render that could change the list's content height
  // (new/removed points, counts filling in, language switch re-wrapping
  // text) — a plain effect with no deps array, like activity-preview's own
  // per-render DOM sync, so nothing has to be exhaustively listed and nothing
  // sets React state here.
  useLayoutEffect(() => {
    updateFade();
  });

  // Also re-check on the element's own size changes — covers the `sm`
  // breakpoint turning the height cap on/off, and the window resizing,
  // neither of which re-renders this component by itself. Re-subscribes
  // whenever `editing` flips, since the scrollable node only exists in
  // display mode (unmounted while editing).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateFade());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateFade, editing]);

  function startEdit() {
    cancelled.current = false;
    setPoints(goalPoints(goal));
    setOrigins(goalPoints(goal));
    setNewPoint("");
    setEditing(true);
  }

  function addPoint() {
    const p = newPoint.trim();
    if (!p) return;
    setPoints((prev) => [...prev, p]);
    setOrigins((prev) => [...prev, null]);
    setNewPoint("");
  }

  function removePoint(i: number) {
    setPoints((prev) => prev.filter((_, idx) => idx !== i));
    setOrigins((prev) => prev.filter((_, idx) => idx !== i));
    newPointRef.current?.focus();
  }

  function updatePoint(i: number, value: string) {
    setPoints((prev) => prev.map((p, idx) => (idx === i ? value : p)));
  }

  async function commit() {
    if (cancelled.current || saving) return;
    // Anything still sitting in the "add a point" box counts too, so
    // tabbing/clicking away doesn't silently drop it.
    const next = joinGoalPoints(newPoint.trim() ? [...points, newPoint] : points);
    if (next === (goal ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const renames = points.flatMap((p, i) => {
      const from = origins[i];
      return from != null && p.trim() && p.trim() !== from ? [{ from, to: p.trim() }] : [];
    });
    const ok = await onSave(next, renames);
    setSaving(false);
    if (ok) setEditing(false);
  }

  const shownPoints = goalPoints(goal);
  const total = joinGoalPoints(newPoint.trim() ? [...points, newPoint] : points).length;

  return (
    // No mt here — this card sits inside journal.tsx's shared dashboard
    // panel now, which spaces its sections itself (gap-4).
    //
    // Height match with the activity calendar (2026-10-01, on request —
    // the calendar is now a fixed 4-week window, so it has a constant
    // height Avery wanted this card to line up with): on `sm+`, in display
    // mode only, the card's height is pinned to the calendar's own
    // (CALENDAR_CARD_HEIGHT_PX, exported from activity-calendar.tsx so
    // this doesn't hand-duplicate its geometry — see that file's own
    // comment for the arithmetic) via a CSS custom property, and the
    // points list becomes the part that scrolls past that height, with a
    // bottom fade hint when it does. Below `sm`, and whenever editing,
    // there's no cap — editing always shows every input row in full, and
    // below `sm` the two cards stack full-width anyway. The calendar
    // itself never stretches to match this card either way (see its own
    // sm:self-start) — only this card adapts to the pairing.
    <section>
      <div
        className={cn(
          "flex items-stretch gap-3 rounded-[var(--r-card)] border border-border bg-card px-5 py-3.5 shadow-[var(--shadow-card)]",
          !editing && "sm:h-[var(--goal-card-h)]"
        )}
        style={{ "--goal-card-h": `${CALENDAR_CARD_HEIGHT_PX}px` } as React.CSSProperties}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          {/* No horizontal padding here (unlike the px-2 used by the body
              rows below, for their own hover/input backgrounds) — the card's
              own px-5 already matches the 20px left edge every other
              dashboard-panel title sits at (patterns-table.tsx's p-2+px-3,
              board-rack.tsx's p-2+pl-3); the old px-2 pushed this one 8px
              further in than the others. */}
          <h2 className="shrink-0 pb-0.5 font-sans text-[13px] font-bold text-muted-foreground">
            {t("goal.title")}
          </h2>
          {editing ? (
            <div
              className="flex flex-col gap-1.5 px-2 py-1"
              // Commit when focus leaves the whole editing block, not on
              // every blur between its own rows (tabbing/clicking between
              // point inputs shouldn't save early).
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit();
              }}
            >
              {points.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    autoFocus={i === 0}
                    value={p}
                    disabled={saving}
                    aria-label={t("goal.editPoint", { n: i + 1 })}
                    onChange={(e) => updatePoint(i, e.target.value)}
                    // No Enter shortcut on purpose: it clashed with Chinese
                    // input methods (注音/倉頡 confirm candidates with Enter).
                    // Saving happens when focus leaves the card; Escape cancels.
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        cancelled.current = true;
                        setEditing(false);
                      }
                    }}
                    className={cn(
                      "min-w-0 flex-1 rounded-[10px] border border-ring bg-background px-2 py-1.5 outline-none ring-4 ring-ring/15 disabled:opacity-60",
                      POINT_TEXT_CLASS
                    )}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    // Safari doesn't focus buttons on click, so without this the
                    // input blurs to <body> and the blur-to-save never fires.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => removePoint(i)}
                    aria-label={t("goal.removePoint", { point: p })}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-60"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  ref={newPointRef}
                  autoFocus={points.length === 0}
                  value={newPoint}
                  disabled={saving}
                  placeholder={t("goal.placeholder")}
                  aria-label={t("goal.addPoint")}
                  onChange={(e) => setNewPoint(e.target.value)}
                  // No Enter shortcut here either (see above) — add with the + button.
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      cancelled.current = true;
                      setEditing(false);
                    }
                  }}
                  className={cn(
                    "min-w-0 flex-1 rounded-[10px] border border-dashed border-ring bg-background px-2 py-1.5 outline-none ring-4 ring-ring/15 disabled:opacity-60",
                    POINT_TEXT_CLASS
                  )}
                />
                <button
                  type="button"
                  disabled={saving || !newPoint.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addPoint}
                  aria-label={t("goal.addPoint")}
                  className="shrink-0 rounded-full p-1.5 text-[#0E7C86] hover:bg-secondary disabled:opacity-40"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
              <p className="px-2 pt-0.5 text-[11px] font-medium text-[var(--faint)]">
                {t("goal.charsLeft", { n: MAX_GOAL - total })}
              </p>
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={scrollRef}
                onScroll={updateFade}
                // Native scrollbar hidden, same as the activity calendar's
                // own week list — there's nothing else here standing in for
                // it (no rail), just the bottom fade below and, once it
                // overflows, keyboard scrolling via the tabIndex updateFade
                // sets above.
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  // No points yet: centre the "add a goal" prompt in
                  // whatever height this got matched to, instead of letting
                  // it sit pinned to the top of a mostly-empty card.
                  !shownPoints.length && "flex flex-col justify-center"
                )}
              >
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label={t("goal.edit")}
                  className={
                    shownPoints.length
                      ? "w-full rounded-[10px] px-2 py-1 text-left hover:bg-secondary"
                      : "w-full rounded-[10px] px-2 py-1 text-left text-[14px] font-medium text-[var(--faint)] hover:bg-secondary hover:text-muted-foreground"
                  }
                >
                  {shownPoints.length ? (
                    <ul className={cn("list-disc space-y-0.5 pl-4 break-words", POINT_TEXT_CLASS)}>
                      {shownPoints.map((p, i) => (
                        <li key={i}>
                          {p}
                          {stats[i]?.total ? (
                            <span className="ml-2 whitespace-nowrap text-[12px] font-semibold tabular-nums text-[#0E7C86]">
                              {t("goal.pointCount", { met: stats[i].met, n: stats[i].total })}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    t("goal.add")
                  )}
                </button>
              </div>
              {/* Bottom fade — visibility toggled by updateFade() above,
                  not Tailwind state classes, since it depends on a DOM
                  measurement rather than anything React already tracks. */}
              <div
                ref={fadeRef}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-[10px] bg-gradient-to-t from-card to-transparent opacity-0 transition-opacity"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** The goal box in the log form / edit panel: one checkbox per point —
 *  ticked = achieved this session, unticked = not. */
export function GoalCheck({
  goal,
  value,
  onChange,
}: {
  goal: string;
  value: boolean[];
  onChange: (v: boolean[]) => void;
}) {
  const { t } = useLang();
  const points = goalPoints(goal);
  return (
    <fieldset className="flex flex-col gap-2 rounded-[var(--r-tile)] bg-secondary px-4 py-3">
      <legend className="sr-only">{t("goal.whichDidYouAchieve")}</legend>
      <div className="flex items-center gap-2">
        <Target className="size-4 shrink-0 text-[#0E7C86]" aria-hidden />
        <span className="text-xs font-semibold text-muted-foreground">{t("goal.whichDidYouAchieve")}</span>
      </div>
      <div className="flex flex-col gap-1">
        {points.map((p, i) => {
          const checked = value[i] ?? false;
          return (
            <label
              key={i}
              className="flex cursor-pointer items-start gap-2.5 rounded-[10px] px-1 py-1 hover:bg-background/60"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(points.map((_, j) => (j === i ? e.target.checked : (value[j] ?? false))))}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-ring/30",
                  checked ? "border-[#0E7C86] bg-[#0E7C86] text-white" : "border-border bg-background"
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              <span className="min-w-0 text-[14.5px] font-bold leading-snug break-words">{p}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Session card: the goal this session was logged against, and how many of
 *  its points were achieved. Points join onto one line here (the chip has
 *  no room for a list). */
export function GoalChip({ goal, pointsMet }: { goal: string; pointsMet: boolean[] | null }) {
  const { t } = useLang();
  const points = goalPoints(goal);
  const compact = (pointsMet ? points.filter((_, i) => pointsMet[i]) : points).join(" · ");
  const met = pointsMet?.filter(Boolean).length ?? 0;
  const n = pointsMet?.length ?? 0;
  return (
    <div className="flex min-w-0 px-6 pt-2.5 pb-0.5">
      {/* No icon here (removed on request, 2026-10-01) — it was decorative
          (aria-hidden), so dropping it doesn't change what a screen reader
          announces; the chip's meaning is carried entirely by its text. */}
      <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-secondary py-1 pr-1 pl-3">
        {compact && (
          <span className="min-w-0 truncate text-[13.5px] font-bold tracking-[-0.01em]" title={goal}>
            {compact}
          </span>
        )}
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums",
            !pointsMet
              ? "text-muted-foreground"
              : met === n
                ? "bg-[#0E7C86] text-white"
                : met > 0
                  ? "bg-[#0E7C86]/15 text-[#0E7C86]"
                  : "bg-foreground text-background"
          )}
        >
          {!pointsMet ? t("goal.notAssessed") : t("goal.chipCount", { met, n })}
        </span>
      </span>
    </div>
  );
}
