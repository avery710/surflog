-- A clip is a labelled stretch of a session video, not a new file.
-- start_ms / end_ms are offsets into photo_blobs (the source video).
-- Same privacy as sessions: owner_id on every row, RLS on with no
-- policies, and the server (service role) does the ownership check.
-- tagged_by is who chose the skill. model and confidence are set only
-- when an AI tagger wrote the row; a hand label leaves them null.

create table if not exists public.clips (
  id text primary key,
  owner_id text not null,
  session_id text not null references public.sessions (id) on delete cascade,
  media_id text not null references public.photo_blobs (id) on delete cascade,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  skill text not null check (skill in (
    'takeoff', 'bottom_turn', 'trim', 'cutback', 'other', 'not_a_ride'
  )),
  tagged_by text not null check (tagged_by in ('ai', 'user')),
  model text,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  confirmed boolean not null default false,
  reaction text check (reaction is null or reaction in (
    'nailed_it', 'late', 'fell', 'not_sure'
  )),
  created_at timestamptz not null default now()
);

create index if not exists clips_session_idx
  on public.clips (session_id, start_ms);

create index if not exists clips_owner_idx
  on public.clips (owner_id);

alter table public.clips enable row level security;
