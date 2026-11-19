-- A queue for the clip worker (worker/). Not a Vercel function: a long
-- video would time out there. The Next app only inserts a pending row
-- when a session video is attached. The worker claims it, runs ffmpeg
-- and the tagger, and writes clips.
--
-- Same privacy stance as sessions: RLS on, no policies. The service-role
-- key is the only client. owner_id is the session's owner so a job can
-- never be read as someone else's work from this table by the app.

create table if not exists public.clip_jobs (
  id text primary key,
  owner_id text not null,
  session_id text not null references public.sessions (id) on delete cascade,
  media_id text not null references public.photo_blobs (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- One open job per video. A retry after `failed` is allowed.
create unique index if not exists clip_jobs_open_media_idx
  on public.clip_jobs (media_id)
  where status in ('pending', 'running');

create index if not exists clip_jobs_pending_idx
  on public.clip_jobs (created_at)
  where status = 'pending';

alter table public.clip_jobs enable row level security;
