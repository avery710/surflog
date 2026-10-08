/**
 * Beaufort bands (m/s, upper bound exclusive), rated on the midpoint of
 * sustained speed and gust when gust > speed — gusty wind chops the surface
 * more than its average suggests. The midpoint rule is our own choice, not
 * an established scale.
 */
export const WIND_LEVELS = [
  { max: 1.5, key: "calm" },
  { max: 3.4, key: "light" },
  { max: 5.5, key: "gentle" },
  { max: 8, key: "moderate" },
  { max: 10.8, key: "fresh" },
  { max: 13.9, key: "strong" },
  { max: 17.2, key: "nearGale" },
  { max: Infinity, key: "gale" },
] as const;

/** The card's dot colours (components/wind-strength.tsx, Tailwind 400-900) as
 *  hex, for the share images where there is no Tailwind. Keep in step. */
export const WIND_DOT_HEX = {
  calm: "#34d399",
  light: "#10b981",
  gentle: "#84cc16",
  moderate: "#fbbf24",
  fresh: "#f97316",
  strong: "#ef4444",
  nearGale: "#b91c1c",
  gale: "#7f1d1d",
} as const;

export type WindLevelKey = (typeof WIND_LEVELS)[number]["key"];

/** Index into WIND_LEVELS (0 = calm … 7 = gale). */
export function windLevelIndex(speedMs: number, gustMs?: number | null): number {
  const effective = gustMs != null && gustMs > speedMs ? (speedMs + gustMs) / 2 : speedMs;
  const i = WIND_LEVELS.findIndex((l) => effective < l.max);
  return i === -1 ? WIND_LEVELS.length - 1 : i;
}
