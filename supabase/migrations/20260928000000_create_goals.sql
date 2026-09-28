-- "Goal for next session": one free-text technique goal per owner ("commit
-- earlier on the takeoff"), shown above the journal and edited inline.
--
-- Each session snapshots the goal that was current when it was logged
-- (sessions.goal_text) and whether the surfer says it was met
-- (sessions.goal_met: true / false / null = not assessed). The snapshot is
-- a copy, not a reference, so editing or clearing the goal later never
-- rewrites history.
--
-- Per owner, like everything else (see CLAUDE.md "Multi-user"). Same access
-- model as sessions / spot_notes / boards: RLS on with no policies, the app
-- talks to it only with the service-role key from API routes and does its
-- own ownership scoping.

create table if not exists public.goals (
  owner_id text primary key,
  text text not null check (char_length(text) between 1 and 200),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

alter table public.sessions
  add column if not exists goal_text text
    check (goal_text is null or char_length(goal_text) between 1 and 200),
  add column if not exists goal_met boolean;
