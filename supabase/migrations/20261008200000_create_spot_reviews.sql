-- Spot reviews: any signed-in user can rate a catalogue spot (1-5 stars) and
-- leave an optional comment. One review per user per spot; writing again
-- replaces it. Reviews are SHARED: every signed-in user reads every review on
-- /spots, with the author's display name (snapshotted, never the email or
-- Google sub). The spot admin (SPOT_ADMIN_EMAILS) can delete any review.
--
-- Same access model as every other table: RLS on, NO policies; the API
-- routes (app/api/spots/[slug]/reviews) do the checks.
--
-- NOT applied to the live project yet — waiting for Avery's go-ahead.

create table if not exists public.spot_reviews (
  id uuid primary key default gen_random_uuid(),
  spot_slug text not null references public.spots (slug) on delete cascade,
  owner_id text not null,         -- Google sub, like sessions.owner_id; never sent to other users
  author_name text,               -- display name snapshot, refreshed on every save
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, spot_slug)
);

create index if not exists spot_reviews_spot_idx on public.spot_reviews (spot_slug, updated_at desc);

alter table public.spot_reviews enable row level security;
