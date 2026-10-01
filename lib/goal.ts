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

/** Rewords lines of a session's goal snapshot in place (exact-text match,
 *  applied simultaneously so swaps work). Line order — and so the
 *  per-point ticks indexed by it — is unchanged. Null if nothing changed. */
export function applyGoalRenames(text: string, renames: GoalRename[]): string | null {
  const map = new Map(renames.filter((r) => r.to.trim()).map((r) => [r.from.trim(), r.to.trim()]));
  const before = goalPoints(text);
  const after = before.map((p) => map.get(p) ?? p);
  return after.some((p, i) => p !== before[i]) ? joinGoalPoints(after) : null;
}

/** Validates a per-point "achieved" array against the goal it belongs to:
 *  exactly one boolean per point, else null. */
export function parsePointsMet(value: unknown, goalText: string | null | undefined): boolean[] | null {
  const n = goalPoints(goalText).length;
  if (!n || !Array.isArray(value) || value.length !== n) return null;
  return value.every((v) => typeof v === "boolean") ? (value as boolean[]) : null;
}

/** One achieved/not per point of the session's goal, or null if nothing
 *  was recorded. Sessions logged before per-point ticks existed only have
 *  the whole-goal `goalMet`, which then stands for every point. */
export function sessionPointsMet(s: {
  goalText?: string | null;
  goalMet?: boolean | null;
  goalPointsMet?: boolean[] | null;
}): boolean[] | null {
  const n = goalPoints(s.goalText).length;
  if (!n) return null;
  if (Array.isArray(s.goalPointsMet) && s.goalPointsMet.length === n) return s.goalPointsMet;
  if (s.goalMet != null) return Array(n).fill(s.goalMet);
  return null;
}

/** A session body's goal fields, validated. `goalText` null means "no goal
 *  was set when this was logged", and then the rest are null too.
 *  `goalMet` is derived from the per-point ticks ("all achieved") when
 *  they're sent; a bare boolean `goalMet` is still accepted. */
export function parseGoalFields(body: Record<string, unknown>): {
  goalText: string | null;
  goalMet: boolean | null;
  goalPointsMet: boolean[] | null;
} {
  const raw = typeof body.goalText === "string" ? body.goalText.trim() : "";
  const goalText = raw && raw.length <= MAX_GOAL ? raw : null;
  const goalPointsMet = parsePointsMet(body.goalPointsMet, goalText);
  const goalMet = goalPointsMet
    ? goalPointsMet.every(Boolean)
    : goalText && typeof body.goalMet === "boolean"
      ? body.goalMet
      : null;
  return { goalText, goalMet, goalPointsMet };
}

export type PointStat = {
  point: string;
  /** Sessions that ticked this point as achieved. */
  met: number;
  /** Sessions whose goal had this point and recorded ticks. */
  total: number;
};

/** Per-point history for the goal card. Each point is counted by its own
 *  text across every session, not by the whole goal text — otherwise
 *  adding, removing or rewording any one point would reset every point's
 *  count to 0, though the ticks are all still stored.
 *
 *  Matching is on exact wording (after goalPoints' trim), never fuzzy: a
 *  wrong fuzzy match would silently merge two different goals, while
 *  rewording a point on purpose starting it fresh is easy to understand.
 *  The tick is read at the point's index in *that session's own* goal
 *  (goal_points_met follows its own goal_text order); if the text appears
 *  twice there, the first occurrence wins. Sessions with no ticks at all
 *  (sessionPointsMet → null) are skipped, not counted as misses. */
export function pointStats(
  points: string[],
  sessions: {
    when: string;
    goalText?: string | null;
    goalMet?: boolean | null;
    goalPointsMet?: boolean[] | null;
  }[]
): PointStat[] {
  const stats = points.map((point) => ({ point, met: 0, total: 0 }));
  for (const s of sessions) {
    const own = goalPoints(s.goalText);
    if (!own.length) continue;
    const ticks = sessionPointsMet(s);
    if (!ticks) continue;
    for (const st of stats) {
      const i = own.indexOf(st.point.trim());
      if (i < 0) continue;
      st.total += 1;
      if (ticks[i]) st.met += 1;
    }
  }
  return stats;
}
