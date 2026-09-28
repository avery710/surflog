/** Shared by the API routes and the UI — keep in step with the check
 *  constraints in supabase/migrations/20260928000000_create_goals.sql. */
export const MAX_GOAL = 200;

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
