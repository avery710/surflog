-- Spot edit suggestions: any signed-in user can propose a change to an
-- existing spot (name, Chinese name, country, area, location, facing, best
-- swell / wind / tide). The spot admin (SPOT_ADMIN_EMAILS) approves — which
-- applies `changes` to the `spots` row — or declines.
--
-- Same access model as spot_requests: RLS on, NO policies. A user reads only
-- their own suggestions (without the requester snapshot); the full list with
-- requester name/email is admin-only. Checks live in the API routes
-- (app/api/spots/[slug]/edit-requests, app/api/spot-edit-requests/**).
--
-- NOT applied to the live project yet — waiting for Avery's go-ahead.

create table if not exists public.spot_edit_requests (
  id uuid primary key default gen_random_uuid(),
  spot_slug text not null references public.spots (slug) on delete cascade,
  requester_id text not null,   -- Google sub, like sessions.owner_id
  requester_name text,          -- snapshot at suggestion time, for the admin's eyes only
  requester_email text,         -- likewise
  -- Only the fields that differ, camelCase keys as in lib/spot-edit.ts:
  -- name, nameZh, country, area, lat, lng, facing, bestSwellDir, bestWindDir, bestTide.
  -- "" / [] means "clear it".
  changes jsonb not null check (jsonb_typeof(changes) = 'object' and changes <> '{}'::jsonb),
  -- What those fields held when the suggestion was made, so the admin can see
  -- the spot has changed since (stale). Same keys as `changes`.
  base jsonb not null default '{}'::jsonb,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by text,              -- admin's Google sub
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- One pending suggestion per user per spot (a second one replaces the first).
create unique index if not exists spot_edit_requests_one_pending_idx
  on public.spot_edit_requests (requester_id, spot_slug) where status = 'pending';
create index if not exists spot_edit_requests_status_idx on public.spot_edit_requests (status, created_at desc);
create index if not exists spot_edit_requests_requester_idx on public.spot_edit_requests (requester_id, created_at desc);
create index if not exists spot_edit_requests_spot_idx on public.spot_edit_requests (spot_slug);

alter table public.spot_edit_requests enable row level security;
