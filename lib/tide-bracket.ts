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

/** Half-width of the window of tide events stored around a session. */
export const TIDE_WINDOW_MS = 14 * 3600000;

/**
 * Every event within +/-14 h of the target, plus the bracket (last at/before,
 * first after) even when it falls outside 14 h — mixed tides can have 17 h
 * gaps. Input must be sorted by time; output keeps that order.
 */
export function windowAround<T>(
  sortedByTime: T[],
  targetMs: number,
  timeOfMs: (item: T) => number
): T[] {
  const { prev, next } = pickBracket(sortedByTime, targetMs, timeOfMs);
  return sortedByTime.filter((item) => {
    const ms = timeOfMs(item);
    return (
      item === prev ||
      item === next ||
      (ms >= targetMs - TIDE_WINDOW_MS && ms <= targetMs + TIDE_WINDOW_MS)
    );
  });
}
