-- 常用 / "go-to" boards: any number per owner (replaces the single default
-- board from 20260928100000_add_board_default.sql as the app's concept).
--
-- The log form now pre-selects the board used in the owner's most recent
-- session instead of a marked default; favourites are listed first in the
-- board rack and the board picker.
--
-- Additive on purpose: the old is_default column and its one-per-owner
-- unique index are left in place so code already deployed on staging (which
-- reads is_default) keeps working until it's redeployed. Nothing reads
-- is_default after this change; it can be dropped in a later migration.

alter table public.boards
  add column if not exists is_favorite boolean not null default false;

-- Carry the current default over as the first favourite.
update public.boards set is_favorite = true where is_default;
