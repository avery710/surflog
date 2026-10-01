-- Per-point "did you achieve it" for the goal-for-next-session checklist.
--
-- The goal is a list of points stored newline-separated in
-- sessions.goal_text (see CLAUDE.md "Goal for next session"). This holds
-- one boolean per point, in the same order as the points in that session's
-- own goal_text snapshot: [true, false, true] = points 1 and 3 achieved.
-- Null = not recorded (every session logged before this column existed —
-- the app then falls back to the whole-goal sessions.goal_met for every
-- point). goal_met is kept and still written, derived as "all points
-- achieved", so older readers and the CSV stay meaningful.

alter table public.sessions
  add column if not exists goal_points_met jsonb
    check (goal_points_met is null or jsonb_typeof(goal_points_met) = 'array');
