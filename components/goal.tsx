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
import { useRef, useState } from "react";
import { Check, Plus, Target, X } from "lucide-react";
import { cn } from "cn";
import { fmtDate } from "@/lib/format";
import { goalPoints, joinGoalPoints, MAX_GOAL, pointStats } from "@/lib/goal";
import { useLang } from "@/lib/i18n";
import type { Session } from "@/lib/types";

export function GoalCard({
  goal,
  sessions,
  onSave,
}: {
  goal: string | null;
  sessions: Session[];
  /** Resolves true if saved, so the card knows whether to leave edit mode. */
  onSave: (text: string) => Promise<boolean>;
}) {
  const { t, lang } = useLang();
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  const [newPoint, setNewPoint] = useState("");
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);

  // How it's gone so far, per point, matched by the point's own text in
  // every session (not the whole goal text) — see pointStats().
  const stats = pointStats(goalPoints(goal), sessions);
  const anyHistory = stats.some((st) => st.total > 0);
  // "since" only on points that started later than the oldest one: that's
  // what explains why their totals are smaller. On every bullet it would
  // just repeat the same date.
  const firstSince = stats.reduce<string | null>(
    (min, st) => (st.since && (!min || st.since < min) ? st.since : min),
    null
  );

  function startEdit() {
    cancelled.current = false;
    setPoints(goalPoints(goal));
    setNewPoint("");
    setEditing(true);
  }

  function addPoint() {
    const p = newPoint.trim();
    if (!p) return;
    setPoints((prev) => [...prev, p]);
    setNewPoint("");
  }

  function removePoint(i: number) {
    setPoints((prev) => prev.filter((_, idx) => idx !== i));
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
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setEditing(false);
  }

  const shownPoints = goalPoints(goal);
  const total = joinGoalPoints(newPoint.trim() ? [...points, newPoint] : points).length;

  return (
    // No mt here — this card sits inside journal.tsx's shared dashboard
    // panel now, which spaces its sections itself (gap-4).
    <section>
      <div className="flex items-start gap-3 rounded-[var(--r-card)] border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
        <Target className="mt-0.5 size-5 shrink-0 text-[#0E7C86]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="px-2 pb-1 font-sans text-[13px] font-bold text-muted-foreground">
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
                    className="min-w-0 flex-1 rounded-[10px] border border-ring bg-background px-2 py-1 text-[16px] outline-none ring-4 ring-ring/15 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={saving}
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
                  className="min-w-0 flex-1 rounded-[10px] border border-dashed border-ring bg-background px-2 py-1 text-[16px] outline-none ring-4 ring-ring/15 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={saving || !newPoint.trim()}
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
            <button
              type="button"
              onClick={startEdit}
              aria-label={t("goal.edit")}
              className={
                shownPoints.length
                  ? "w-full rounded-[10px] px-2 py-1 text-left hover:bg-secondary"
                  : "rounded-[10px] px-2 py-1 text-left text-[14px] font-medium text-[var(--faint)] hover:bg-secondary hover:text-muted-foreground"
              }
            >
              {shownPoints.length ? (
                <ul className="list-disc space-y-0.5 pl-4 text-[14.5px] font-bold leading-snug tracking-[-0.01em] break-words">
                  {shownPoints.map((p, i) => (
                    <li key={i}>
                      {p}
                      {stats[i]?.total ? (
                        <span className="ml-2 whitespace-nowrap text-[12px] font-semibold tabular-nums text-[#0E7C86]">
                          {t("goal.pointCount", { met: stats[i].met, n: stats[i].total })}
                        </span>
                      ) : null}
                      {stats[i]?.since && stats[i].since !== firstSince && (
                        <span className="ml-1.5 whitespace-nowrap text-[11px] font-medium text-[var(--faint)]">
                          {t("goal.pointSince", { date: fmtDate(stats[i].since.slice(0, 10), lang, false) })}
                        </span>
                      )}
                      {/* A point with no history yet, next to ones that have
                          some — quiet, so it doesn't read as 0/0. */}
                      {anyHistory && !stats[i]?.total && (
                        <span className="ml-2 whitespace-nowrap text-[11px] font-medium text-[var(--faint)]">
                          {t("goal.pointNew")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                t("goal.add")
              )}
            </button>
          )}
          {/* Only when no point has any history — once one does, the
              per-point counts say it all. */}
          {goal && !editing && !anyHistory && (
            <p className="px-2 pt-1 text-[12.5px] font-medium text-muted-foreground">
              {t("goal.notTriedYet")}
            </p>
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
  const compact = goalPoints(goal).join(" · ");
  const met = pointsMet?.filter(Boolean).length ?? 0;
  const n = pointsMet?.length ?? 0;
  return (
    <div className="flex min-w-0 px-6 pt-2.5 pb-0.5">
      <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-secondary py-1 pr-1 pl-3">
        <Target className="size-3.5 shrink-0 text-[#0E7C86]" aria-hidden />
        <span className="min-w-0 truncate text-[13.5px] font-bold tracking-[-0.01em]" title={goal}>
          {compact}
        </span>
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
