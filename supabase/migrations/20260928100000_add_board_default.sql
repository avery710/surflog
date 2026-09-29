-- Default board: the one the log form pre-selects. At most one per owner,
-- enforced by the partial unique index. When an owner has exactly one board
-- and none is marked, the app treats that one as the default (computed, not
-- stored — see defaultBoardId() in lib/boards.ts).

alter table public.boards
  add column if not exists is_default boolean not null default false;

create unique index if not exists boards_one_default_per_owner
  on public.boards (owner_id) where is_default;
