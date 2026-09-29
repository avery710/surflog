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

/** A session body's goal fields, validated. `goalText` null means "no goal
 *  was set when this was logged", and then `goalMet` is always null too. */
export function parseGoalFields(body: Record<string, unknown>): {
  goalText: string | null;
  goalMet: boolean | null;
} {
  const raw = typeof body.goalText === "string" ? body.goalText.trim() : "";
  const goalText = raw && raw.length <= MAX_GOAL ? raw : null;
  const goalMet = goalText && typeof body.goalMet === "boolean" ? body.goalMet : null;
  return { goalText, goalMet };
}
