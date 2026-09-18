-- Ownership + metadata for objects in the "photos" Storage bucket.
--
-- Supabase Storage objects can carry custom metadata, but that support is
-- version-dependent on the client and awkward to query by. A plain Postgres
-- table is a pattern already proven working for `sessions` — the object's
-- bytes live in Storage (bucket "photos", object path = this row's id),
-- everything about who owns it and what it is lives here.
--
-- Same RLS stance as sessions: enabled, no policies — the app only ever
-- reads/writes this via the service_role-equivalent secret key server-side.

create table if not exists public.photo_blobs (
  id text primary key,
  owner_id text not null,
  session_id text not null references public.sessions (id) on delete cascade,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists photo_blobs_owner_id_idx
  on public.photo_blobs (owner_id);

create index if not exists photo_blobs_session_id_idx
  on public.photo_blobs (session_id);

alter table public.photo_blobs enable row level security;
