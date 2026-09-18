-- Surflog sessions table.
--
-- Mirrors lib/types.ts's Session interface closely — the flexible reading
-- blocks (photos, cond, condOpenMeteo) stay as jsonb rather than being
-- normalized into columns, since they're written/read as whole objects by
-- the app and their shape is still evolving (see CLAUDE.md "Entry schema").
--
-- `when` is a reserved-ish word to work around in SQL, so the column is
-- `session_when` — the app's lib/db.ts translates between the two names;
-- nothing above that layer needs to know.
--
-- Multi-user (see CLAUDE.md "Multi-user"): every row is scoped by
-- owner_id (a Google account's stable OIDC subject id). The app only ever
-- talks to this table with the service_role key from server-side code
-- (API routes), which bypasses RLS entirely and does its own ownership
-- checks — see app/api/sessions/**. RLS is still enabled with no policies
-- as defense-in-depth: if the publishable/anon key were ever used against
-- this table directly, that access is denied by default rather than open.

create table if not exists public.sessions (
  id text primary key,
  owner_id text not null,
  spot text not null,
  session_when text not null, -- "YYYY-MM-DDTHH:mm", Asia/Taipei local, no tz
  notes_html text not null default '',
  notes text not null default '',
  photos jsonb not null default '[]'::jsonb,
  cond jsonb,
  cond_open_meteo jsonb,
  rating smallint check (rating is null or (rating between 1 and 5)),
  created_at timestamptz not null default now(),
  example boolean
);

create index if not exists sessions_owner_id_idx
  on public.sessions (owner_id);

-- the common query: one owner's sessions, newest first
create index if not exists sessions_owner_when_idx
  on public.sessions (owner_id, session_when desc);

alter table public.sessions enable row level security;
