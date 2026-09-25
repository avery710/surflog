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

export type WindLevelKey = (typeof WIND_LEVELS)[number]["key"];

/** Index into WIND_LEVELS (0 = calm … 7 = gale). */
export function windLevelIndex(speedMs: number, gustMs?: number | null): number {
  const effective = gustMs != null && gustMs > speedMs ? (speedMs + gustMs) / 2 : speedMs;
  const i = WIND_LEVELS.findIndex((l) => effective < l.max);
  return i === -1 ? WIND_LEVELS.length - 1 : i;
}
