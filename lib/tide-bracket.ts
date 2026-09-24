/**
 * Shared "pick the bracketing pair around a target time" walk. Both
 * lib/cwa-tide.ts and lib/openmeteo.ts reduce a list of discrete tide
 * events (CWA's forecast events; Open-Meteo's refined sea-level extrema) to
 * the previous/next pair around a session's time — this is that one
 * implementation instead of two near-identical copies.
 */
export function pickBracket<T>(
  sortedByTime: T[],
  targetMs: number,
  timeOfMs: (item: T) => number
): { prev: T | null; next: T | null } {
  let prev: T | null = null;
  let next: T | null = null;
  for (const item of sortedByTime) {
    const ms = timeOfMs(item);
    if (ms <= targetMs) {
      if (!prev || ms > timeOfMs(prev)) prev = item;
    } else if (!next) {
      next = item;
    }
  }
  return { prev, next };
}
