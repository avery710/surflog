/** Shared by the API routes and the UI — keep in step with the check
 *  constraints in supabase/migrations/20260928000000_create_goals.sql. */
export const MAX_GOAL = 200;

/** The goal is stored as a single `goals.text` column (see CLAUDE.md
 *  "Goal for next session") but shown as a bulleted list of points — one
 *  per line, no new column. Splitting/joining lives here so the card, the
 *  log form, the edit panel and the CSV agree on the format. */
export function goalPoints(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Inverse of goalPoints — trims each point, drops empty ones, and joins
 *  with "\n". The 200-char cap (MAX_GOAL) is on the joined total, checked
 *  where it's saved (app/api/goal/route.ts), not per point. */
export function joinGoalPoints(points: string[]): string {
  return points
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n");
}

export type GoalRename = { from: string; to: string };

/** Rewords lines of a session's stored goal text in place (exact-text match,
 *  applied simultaneously so swaps work), so a reworded goal keeps its
 *  history. Line order — and so any legacy per-point ticks indexed by it —
 *  is unchanged. Null if nothing changed. */
export function applyGoalRenames(text: string, renames: GoalRename[]): string | null {
  const map = new Map(renames.filter((r) => r.to.trim()).map((r) => [r.from.trim(), r.to.trim()]));
  const before = goalPoints(text);
  const after = before.map((p) => map.get(p) ?? p);
  return after.some((p, i) => p !== before[i]) ? joinGoalPoints(after) : null;
}

/**
 * What a session records about goals (since 2026-10-06): only the points
 * that were ticked as achieved on it, by their wording. There is no copy of
 * "the whole goal at log time" any more, so:
 *  - every session, old or new, can be ticked against the current goal;
 *  - removing a point from the goal leaves it on the sessions that ticked
 *    it and simply disappears everywhere else;
 *  - there is no "2 of 3" — nothing says how many points there were.
 *
 * Stored in the same three columns as before, no migration: `goal_text` =
 * the achieved points, one per line; `goal_points_met` = all true;
 * `goal_met` = true; all three null when nothing is ticked. Rows written
 * by the old snapshot model (the whole goal in `goal_text`, a true/false
 * per line, or only a whole-goal `goal_met`) read correctly through
 * sessionAchieved() — their unticked lines are just ignored — and the
 * build still on staging reads the new rows as "a goal, fully met".
 */
type GoalFields = {
  goalText?: string | null;
  goalMet?: boolean | null;
  goalPointsMet?: boolean[] | null;
};

/** The goal points ticked as achieved on this session, in stored order. */
export function sessionAchieved(s: GoalFields): string[] {
  const lines = goalPoints(s.goalText);
  const ticks =
    Array.isArray(s.goalPointsMet) && s.goalPointsMet.length === lines.length
      ? s.goalPointsMet
      : // before per-point ticks, one whole-goal answer stood for every line
        lines.map(() => s.goalMet === true);
  return [...new Set(lines.filter((_, i) => ticks[i]))];
}

/** The session columns for a list of achieved points (see above). */
export function achievedGoalFields(achieved: string[]): Required<GoalFields> {
  const text = joinGoalPoints(achieved);
  if (!text) return { goalText: null, goalMet: null, goalPointsMet: null };
  return { goalText: text, goalMet: true, goalPointsMet: goalPoints(text).map(() => true) };
}

/** A request body's `goalAchieved`, validated: an array of one-line
 *  strings, trimmed, blanks and repeats dropped. Null if it isn't that, or
 *  if the joined text is over MAX_GOAL (the `sessions.goal_text` check
 *  constraint — only reachable by ticking long-removed points on top of a
 *  full current goal). */
export function parseGoalAchieved(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && !v.includes("\n"))) return null;
  const achieved = [...new Set(goalPoints((value as string[]).join("\n")))];
  return joinGoalPoints(achieved).length <= MAX_GOAL ? achieved : null;
}

/** The checkboxes offered for a session: the current goal's points, then
 *  any point this session already has ticked that has since left the goal
 *  — still shown so it stays visible on the post and can be unticked. */
export function goalOptions(goal: string | null | undefined, achieved: string[] = []): string[] {
  return [...new Set([...goalPoints(goal), ...achieved])];
}

/** For the goal card: in how many sessions each point was ticked, matched
 *  by exact wording (never fuzzy — a wrong match would silently merge two
 *  different goals; rewording on purpose carries the history along through
 *  applyGoalRenames instead). */
export function achievedCounts(points: string[], sessions: GoalFields[]): number[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const p of sessionAchieved(s)) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return points.map((p) => counts.get(p.trim()) ?? 0);
}
