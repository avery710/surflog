/**
 * How long a list you have switched away from is kept (lib/use-session-feed.ts).
 * Switching back to a filter within this time shows its cards at once, with no
 * request, and scrolling carries on from where it stopped. Past it, the list is
 * dropped and loaded fresh. Any create, edit or delete made here clears every
 * kept list at once, so this only covers changes made somewhere else (another
 * tab or device, an AI app over MCP).
 */
export const FILTER_CACHE_MS = 60_000;

export interface CacheEntry<T> {
  value: T;
  /** When the list was first loaded (ms since epoch). */
  at: number;
}

/** The entry for `key` if it is younger than `maxAgeMs`; an older one is deleted and null returned. */
export function takeFresh<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  now: number,
  maxAgeMs: number = FILTER_CACHE_MS
): CacheEntry<T> | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at >= maxAgeMs) {
    cache.delete(key);
    return null;
  }
  return hit;
}
