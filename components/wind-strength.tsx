"use client";

import { useLang } from "@/lib/i18n";
import { WIND_LEVELS, windLevelIndex, type WindLevelKey } from "@/lib/wind-strength";

const DOT: Record<WindLevelKey, string> = {
  calm: "bg-emerald-400",
  light: "bg-emerald-500",
  gentle: "bg-lime-500",
  moderate: "bg-amber-400",
  fresh: "bg-orange-500",
  strong: "bg-red-500",
  nearGale: "bg-red-700",
  gale: "bg-red-900",
};

/** Beaufort-style wind strength: a coloured dot plus a plain-language word. */
export function WindStrength({ speedMs, gustMs }: { speedMs: number; gustMs?: number | null }) {
  const { t } = useLang();
  const { key } = WIND_LEVELS[windLevelIndex(speedMs, gustMs)];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2 rounded-full ${DOT[key]}`} />
      {t(`wind.strength.${key}`)}
    </span>
  );
}
