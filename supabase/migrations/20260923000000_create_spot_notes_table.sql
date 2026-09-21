-- A user's own description of each spot they've surfed ("best at mid tide,
-- crowded on weekends") — shown in the "What you've surfed" table.
--
-- Per owner, like everything else (see CLAUDE.md "Multi-user"): one row per
-- (owner_id, spot), never shared across users. Same access model as
-- sessions: RLS on with no policies, the app talks to it only with the
-- service-role key from API routes and does its own ownership scoping.

create table if not exists public.spot_notes (
  owner_id text not null,
  spot text not null, -- Swelleye slug or "custom:…", same as sessions.spot
  description text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, spot)
);

alter table public.spot_notes enable row level security;
