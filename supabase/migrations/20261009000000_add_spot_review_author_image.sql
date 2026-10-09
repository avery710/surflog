-- Spot reviews show the author's avatar next to their name: the Google
-- profile picture URL, snapshotted (https only, like session_shares.owner_image)
-- and refreshed on every save, like author_name. Never the email or sub.
-- The app saves without it until this is applied (lib/spot-reviews.ts).
alter table public.spot_reviews add column if not exists author_image text
  check (author_image is null or (author_image like 'https://%' and char_length(author_image) <= 500));
