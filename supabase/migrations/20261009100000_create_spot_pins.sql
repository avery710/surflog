-- Pinned spots: each user can pin their favourite catalogue spots; /spots
-- lists them in a "Pinned" section at the top. Private per user, like
-- spot_notes. Same access model as every other table: RLS on, NO policies;
-- the API route (app/api/spots/[slug]/pin) checks the caller.
create table if not exists public.spot_pins (
  owner_id text not null,         -- Google sub, like sessions.owner_id
  spot_slug text not null references public.spots (slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, spot_slug)
);

alter table public.spot_pins enable row level security;
