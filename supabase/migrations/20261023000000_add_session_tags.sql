-- Tags on a session (SURFLOG-11): short labels such as "Glassy", "Chest-high" or
-- "With Ming". Starter tags are stored by their English key, custom ones as
-- typed (lib/tags.ts). Optional: sessions logged before this have none, and a
-- session may leave it out. At most 8 per session (the app also caps each tag
-- at 24 characters). Filtering is "has any of these tags" (&&), so the GIN
-- index serves it.
alter table public.sessions
  add column if not exists tags text[]
  check (tags is null or cardinality(tags) <= 8);

create index if not exists sessions_tags_idx on public.sessions using gin (tags);
