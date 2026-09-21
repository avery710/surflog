"use client";

/**
 * Optional 1-5 rating. This is the one field CLAUDE.md flags as load-bearing
 * for everything spot-fit does — "the fix is one field" — so it's deliberately
 * lightweight and always skippable, never required.
 */
import { Star } from "lucide-react";
import { cn } from "cn";
import { useLang } from "@/lib/i18n";

export function RatingPicker({
  value,
  onChange,
  size = "default",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: "default" | "sm";
}) {
  const { t } = useLang();
  const starClass = size === "sm" ? "size-4" : "size-5";
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={t("rating.aria")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t(n > 1 ? "rating.stars" : "rating.star", { n })}
          // clicking the currently-set star clears the rating
          onClick={() => onChange(value === n ? null : n)}
          className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-warm"
        >
          <Star
            className={cn(
              starClass,
              value != null && n <= value ? "fill-warm text-warm" : "fill-transparent"
            )}
          />
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("rating.clear")}
        </button>
      )}
    </div>
  );
}
