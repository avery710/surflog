"use client";

import { useLang } from "@/lib/i18n";

const LEVELS = [
  { max: 1.5, key: "calm", dot: "bg-emerald-400" },
  { max: 3.4, key: "light", dot: "bg-emerald-500" },
  { max: 5.5, key: "gentle", dot: "bg-lime-500" },
  { max: 8, key: "moderate", dot: "bg-amber-400" },
  { max: 10.8, key: "fresh", dot: "bg-orange-500" },
  { max: 13.9, key: "strong", dot: "bg-red-500" },
  { max: 17.2, key: "nearGale", dot: "bg-red-700" },
  { max: Infinity, key: "gale", dot: "bg-red-900" },
] as const;

/**
 * Beaufort-style wind strength: a coloured dot plus a plain-language word.
 * Rated on the midpoint of sustained speed and gust, since gusty wind chops
 * the surface more than its average suggests.
 */
export function WindStrength({ speedMs, gustMs }: { speedMs: number; gustMs?: number | null }) {
  const { t } = useLang();
  const effective = gustMs != null && gustMs > speedMs ? (speedMs + gustMs) / 2 : speedMs;
  const level = LEVELS.find((l) => effective < l.max) ?? LEVELS[LEVELS.length - 1];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2 rounded-full ${level.dot}`} />
      {t(`wind.strength.${level.key}`)}
    </span>
  );
}
