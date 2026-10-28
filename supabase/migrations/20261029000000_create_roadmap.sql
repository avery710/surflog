-- Goal roadmap (SURFLOG-38): each user's own roadmap of levels → skills →
-- steps. The starter roadmap lives in code (lib/goal-roadmap.ts); the first
-- time a user picks a level, every starter block is copied into these tables
-- for them, and from then on the blocks are theirs to add to, rename (their
-- own only), reorder, move and remove.
--
-- Which steps are on "next session" is NOT stored here: the existing goal
-- (goals.text) is that list, linked to a step by its wording (lib/roadmap.ts).
--
-- Same access model as every other table: RLS on, NO policies; the server
-- uses the secret key and checks the owner (lib/roadmap-service.ts).

create table if not exists public.roadmap_profile (
  owner_id text primary key,      -- Google sub, like sessions.owner_id
  level smallint not null check (level between 0 and 3),
  track text check (track in ('long', 'short')),
  updated_at timestamptz not null default now()
);

create table if not exists public.roadmap_skills (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  level_key text not null check (level_key in ('0', '1', '2', '3:long', '3:short')),
  grp text not null check (grp in ('ocean', 'ride', 'lineup')),
  template_key text,              -- starter block it came from; null = the user's own
  name text check (name is null or char_length(name) between 1 and 60),
  working boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (template_key is not null or name is not null)
);

create table if not exists public.roadmap_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  skill_id uuid not null references public.roadmap_skills (id) on delete cascade,
  template_key text,              -- starter step it came from; null = the user's own
  text text check (text is null or char_length(text) between 1 and 80),
  sort_order integer not null default 0,
  done_at timestamptz,            -- the user said "learned"
  snooze_from integer,            -- ticked-session count when they said "not yet"
  created_at timestamptz not null default now(),
  check (template_key is not null or text is not null)
);

create index if not exists roadmap_skills_owner_idx on public.roadmap_skills (owner_id);
create index if not exists roadmap_steps_owner_idx on public.roadmap_steps (owner_id);
create index if not exists roadmap_steps_skill_idx on public.roadmap_steps (skill_id);

alter table public.roadmap_profile enable row level security;
alter table public.roadmap_skills enable row level security;
alter table public.roadmap_steps enable row level security;
