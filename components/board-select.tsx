"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { boardLabel } from "@/lib/boards";
import { useLang } from "@/lib/i18n";
import type { Board } from "@/lib/types";

// Radix Select can't use "" as an item value, so "no board" gets a sentinel.
const NONE = "__none__";

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

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="pl-0.5 text-xs font-semibold text-muted-foreground">
        {t("form.boardOptional")}
      </span>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger className={className ?? "w-full"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("form.noBoard")}</SelectItem>
          {boards.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {boardLabel(b)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
