"use client";

import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { boardLabel, formatLength, formatVolume, sortBoards } from "@/lib/boards";
import { useLang } from "@/lib/i18n";
import type { Board } from "@/lib/types";

// Radix Select can't use "" as an item value, so "no board" gets a sentinel.
const NONE = "__none__";

// Shared row padding/sizing for every option, so "不指定" lines up with the
// boards below it. Rounded to the tile radius (not the select's own
// rounded-md) and roomier than the default dense list item — this picker
// shows a photo + two lines of text per board, not a one-line label.
const ITEM_CLASS = "items-center gap-0 rounded-[var(--r-tile)] py-2 pl-2 pr-8";

/** Small board photo, or a blank tile in its place — keeps every option's
 *  text starting at the same x position whether or not the board has a
 *  photo. Same source (`/api/blob/:id`) and alt text as the rack/session
 *  card's board chip (`components/entry-card.tsx`'s `BoardChip`). */
function BoardThumb({ board, small = false }: { board: Board; small?: boolean }) {
  const { t } = useLang();
  const size = small ? "size-5" : "size-9";
  const radius = small ? "rounded-[6px]" : "rounded-[10px]";
  if (!board.photoId) {
    return <span className={`${size} shrink-0 ${radius} bg-secondary`} aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/blob/${board.photoId}`}
      alt={t("board.photoAlt", { name: boardLabel(board) })}
      loading="lazy"
      className={`${size} shrink-0 ${radius} object-cover`}
    />
  );
}

/** Teal "✓ Go-to" badge, same look as the rack's — just not a button here
 *  (there's nothing to toggle from inside a picker). */
function FavoriteBadge() {
  const { t } = useLang();
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 text-[11px] font-semibold text-primary">
      <Check className="size-3" aria-hidden />
      {t("board.favorite")}
    </span>
  );
}

/** One board's row: thumbnail, name, a muted spec line (length · volume,
 *  whichever exist), and the 常用 badge. The name is just the brand (or the
 *  length, if there's no brand) rather than `boardLabel()`'s combined
 *  "brand length" — that string already appears in the spec line below it,
 *  so using it as the name too would repeat the length twice per row. */
function BoardOption({ board }: { board: Board }) {
  const name = board.brand.trim() || formatLength(board.lengthIn) || boardLabel(board);
  const specs = board.brand.trim()
    ? [formatLength(board.lengthIn), formatVolume(board.volumeL)]
    : [formatVolume(board.volumeL)];
  const specLine = specs.filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BoardThumb board={board} />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="min-w-0 max-w-full truncate text-[13.5px] font-medium">{name}</span>
        {specLine && (
          <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">{specLine}</span>
        )}
      </div>
      {board.isFavorite && <FavoriteBadge />}
    </div>
  );
}

/** Optional board picker for the log form and edit panel. Only the caller's
 *  own boards are ever listed; the server re-checks ownership regardless.
 *  Renders nothing when the rack is empty (and no board is attached). */
export function BoardSelect({
  boards,
  value,
  onChange,
  className,
}: {
  boards: Board[];
  value: string | null;
  onChange: (boardId: string | null) => void;
  className?: string;
}) {
  const { t } = useLang();
  if (boards.length === 0 && !value) return null;

  const sorted = sortBoards(boards);
  const favorites = sorted.filter((b) => b.isFavorite);
  const others = sorted.filter((b) => !b.isFavorite);
  const selected = value ? sorted.find((b) => b.id === value) ?? null : null;

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
        {t("form.boardOptional")}
      </span>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger className={className ?? "w-full"}>
          {/* Children override the trigger's auto-derived value, so it
              stays a compact thumbnail + name even though each option
              below also carries a spec line and a badge. */}
          <SelectValue>
            {selected ? (
              <>
                <BoardThumb board={selected} small />
                <span className="min-w-0 truncate">{boardLabel(selected)}</span>
              </>
            ) : (
              t("form.noBoard")
            )}
          </SelectValue>
        </SelectTrigger>
        {/* Wider and less cramped than the default select popup (it was
            only as wide as the narrow trigger, with 28px flush-to-edge
            rows) — these options carry a photo and two lines of text, so
            they need the room. Positioning/open behaviour is untouched
            (still the shared component's item-aligned default). */}
        <SelectContent className="min-w-[260px] max-w-[320px] p-1.5">
          <SelectItem value={NONE} className={ITEM_CLASS}>
            {t("form.noBoard")}
          </SelectItem>
          {sorted.length > 0 && <SelectSeparator />}
          {favorites.map((b) => (
            <SelectItem key={b.id} value={b.id} className={ITEM_CLASS}>
              <BoardOption board={b} />
            </SelectItem>
          ))}
          {favorites.length > 0 && others.length > 0 && <SelectSeparator />}
          {others.map((b) => (
            <SelectItem key={b.id} value={b.id} className={ITEM_CLASS}>
              <BoardOption board={b} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
