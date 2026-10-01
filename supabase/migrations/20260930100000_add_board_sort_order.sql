-- Manual drag-and-drop ordering for the board rack (CLAUDE.md "Board rack",
-- 2026-09-30). sort_order is a flat per-owner integer; grouping by 常用/
-- go-to status still happens in application code (sortBoards() in
-- lib/boards.ts, unchanged) — this column only orders boards *within*
-- whichever group they're in, the same job created_at did on its own
-- before this migration. New boards get sort_order = max(sort_order) + 1
-- for their owner, computed in lib/db.ts's createBoard, not a DB default,
-- so "goes to the end of its group" falls out of the existing
-- favourites-first comparator without extra logic.
alter table public.boards
  add column if not exists sort_order integer;

-- Backfilled to match the order every board already rendered in (go-to
-- boards first, then the rest, both by created_at) so applying this
-- migration doesn't visibly reorder anyone's rack.
with ranked as (
  select id, row_number() over (
    partition by owner_id
    order by is_favorite desc, created_at asc
  ) as rn
  from public.boards
)
update public.boards
set sort_order = ranked.rn
from ranked
where public.boards.id = ranked.id;
