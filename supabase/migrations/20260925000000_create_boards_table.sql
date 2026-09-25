-- A user's board rack ("Your board rack" on the main page), and which board
-- each session was surfed on.
--
-- Per owner, like everything else (see CLAUDE.md "Multi-user"). Same access
-- model as sessions / spot_notes: RLS on with no policies, the app talks to
-- these tables only with the service-role key from API routes and does its
-- own ownership checks (app/api/boards/**, and app/api/sessions/** refuses a
-- board_id the caller doesn't own).
--
-- Length is stored as total inches — the one deliberate exception to the
-- metric-only convention, because surfboards are sized 6'2" everywhere,
-- Taiwan included. The UI reads and writes it as ft'in. Volume is litres.

create table if not exists public.boards (
  id text primary key,
  owner_id text not null,
  brand text not null default '',
  length_in numeric check (length_in is null or (length_in > 0 and length_in <= 240)),
  volume_l numeric check (volume_l is null or (volume_l > 0 and volume_l <= 300)),
  rocker text check (rocker is null or rocker in ('low', 'medium', 'high')),
  note text not null default '',
  -- Board photo: reuses the existing photo pipeline (Storage bucket "photos"
  -- + photo_blobs for ownership), served by /api/blob/:id's owner check.
  photo_id text references public.photo_blobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_owner_id_idx
  on public.boards (owner_id);

alter table public.boards enable row level security;

-- Which board a session was surfed on. Deleting a board never deletes
-- sessions; the reference just goes back to "no board".
alter table public.sessions
  add column if not exists board_id text
    references public.boards (id) on delete set null;

create index if not exists sessions_board_id_idx
  on public.sessions (board_id);

-- photo_blobs was session-only (session_id not null). A blob now belongs to
-- exactly one session OR one board. Deleting a board cascades its blob row
-- (the app also removes the Storage object itself — see
-- app/api/boards/[id]/route.ts), same as sessions already do.
alter table public.photo_blobs
  alter column session_id drop not null;

alter table public.photo_blobs
  add column if not exists board_id text
    references public.boards (id) on delete cascade;

create index if not exists photo_blobs_board_id_idx
  on public.photo_blobs (board_id);

alter table public.photo_blobs
  add constraint photo_blobs_one_parent
    check ((session_id is null) <> (board_id is null));
