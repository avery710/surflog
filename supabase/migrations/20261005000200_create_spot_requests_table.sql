-- Spot requests: any signed-in user can ask the admin to add a spot they
-- surf that the catalogue lacks. They can log sessions against the request
-- straight away (sessions.spot = 'req:<id>'); on approval the admin creates
-- the spot and those sessions move to it (lib/spot-approval.ts).
--
-- A user only ever reads their own requests (and only the id, name, status
-- and resulting slug); the full list, including the requester's display
-- name/email snapshot below, is admin-only (SPOT_ADMIN_EMAILS). Same access
-- model as every other table: RLS on, NO policies, checks live in the API
-- routes (app/api/spot-requests/**).

create table if not exists public.spot_requests (
  id text primary key,
  owner_id text not null,
  requester_name text,        -- snapshot at request time, for the admin's eyes only
  requester_email text,       -- likewise
  name text not null,
  location_text text,         -- raw pasted text (map link / coordinates), as typed
  lat double precision,       -- parsed from location_text when possible
  lng double precision,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  spot_slug text,             -- the spot it became, once approved
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists spot_requests_owner_idx on public.spot_requests (owner_id, created_at desc);
create index if not exists spot_requests_status_idx on public.spot_requests (status, created_at desc);

alter table public.spot_requests enable row level security;
