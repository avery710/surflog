"use client";

/**
 * "Goal for next session": a short bulleted list of technique points per
 * owner, stored as one `goals.text` column — points are newline-separated
 * lines in that single string, not a new table (see CLAUDE.md "Goal for
 * next session"). The card sits above the journal and is edited inline
 * (same click-to-edit / blur-to-save shape as the spot descriptions in
 * patterns-table.tsx, extended to a row per point). Each logged session
 * snapshots the whole joined text and one met / not-yet verdict for the
 * list as a whole — see supabase/migrations/20260928000000_create_goals.sql.
 */
import { useRef, useState } from "react";
import { Check, Plus, Target, X } from "lucide-react";
import { cn } from "cn";
import { goalPoints, joinGoalPoints, MAX_GOAL } from "@/lib/goal";
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
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  const [newPoint, setNewPoint] = useState("");
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);

  // How it's gone so far: sessions logged against this exact goal text
  // (the whole list, joined — one met/not-yet verdict per session, not
  // per point).
  const tried = goal ? sessions.filter((s) => s.goalText === goal) : [];
  const assessed = tried.filter((s) => s.goalMet != null);
  const met = assessed.filter((s) => s.goalMet).length;

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
                    onKeyDown={(e) => {
                      // Enter confirms an IME candidate (注音/倉頡) — only act on a real Enter
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void commit();
                      } else if (e.key === "Escape") {
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addPoint();
                    } else if (e.key === "Escape") {
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
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : (
                t("goal.add")
              )}
            </button>
          )}
          {goal && !editing && (
            <p className="px-2 pt-1 text-[12.5px] font-medium text-muted-foreground">
              {tried.length === 0
                ? t("goal.notTriedYet")
                : assessed.length === 0
                  ? t("goal.triedUnchecked", { n: tried.length })
                  : t("goal.progress", { met, n: assessed.length })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Met / Not yet toggle. Clicking the selected option clears it (null =
 *  not assessed). */
export function GoalMetPicker({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const { t } = useLang();
  const options: { v: boolean; label: string; Icon: typeof Check }[] = [
    { v: true, label: t("goal.met"), Icon: Check },
    { v: false, label: t("goal.notYet"), Icon: X },
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("goal.didYouMeetIt")}>
      {options.map(({ v, label, Icon }) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(value === v ? null : v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors",
            value === v
              ? v
                ? "border-[#0E7C86] bg-[#0E7C86] text-white"
                : "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/** The goal box in the log form / edit panel: the goal text plus the
 *  met / not-yet toggle. */
export function GoalCheck({
  goal,
  value,
  onChange,
}: {
  goal: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const { t } = useLang();
  const points = goalPoints(goal);
  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-tile)] bg-secondary px-4 py-3">
      <div className="flex items-start gap-2">
        <Target className="mt-0.5 size-4 shrink-0 text-[#0E7C86]" aria-hidden />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">{t("goal.didYouMeetIt")}</div>
          <ul className="list-disc space-y-0.5 pl-4 text-[14.5px] font-bold leading-snug break-words">
            {points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
      <GoalMetPicker value={value} onChange={onChange} />
    </div>
  );
}

/** Session card: the goal this session was logged against, and the verdict.
 *  Points join onto one line here (the chip has no room for a list). */
export function GoalChip({ goal, met }: { goal: string; met: boolean | null }) {
  const { t } = useLang();
  const compact = goalPoints(goal).join(" · ");
  return (
    <div className="flex min-w-0 px-6 pt-2.5 pb-0.5">
      <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-secondary py-1 pr-1 pl-3">
        <Target className="size-3.5 shrink-0 text-[#0E7C86]" aria-hidden />
        <span className="min-w-0 truncate text-[13.5px] font-bold tracking-[-0.01em]" title={goal}>
          {compact}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
            met === true
              ? "bg-[#0E7C86] text-white"
              : met === false
                ? "bg-foreground text-background"
                : "text-muted-foreground"
          )}
        >
          {met === true ? t("goal.met") : met === false ? t("goal.notYet") : t("goal.notAssessed")}
        </span>
      </span>
    </div>
  );
}
