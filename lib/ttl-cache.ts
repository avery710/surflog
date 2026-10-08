/**
 * A tiny in-memory cache with a size cap and an expiry, per server instance.
 * For work that is costly and safe to repeat, like shrinking the same photo
 * for every share-image request. Not shared between instances, not persisted.
 */
export function ttlCache<V>(max: number, ttlMs: number) {
  const entries = new Map<string, { value: V; at: number }>();
  return {
    get(key: string): V | undefined {
      const e = entries.get(key);
      if (!e) return undefined;
      if (Date.now() - e.at > ttlMs) {
        entries.delete(key);
        return undefined;
      }
      // refresh its place: Map keeps insertion order, the oldest goes first
      entries.delete(key);
      entries.set(key, e);
      return e.value;
    },
    set(key: string, value: V) {
      entries.delete(key);
      entries.set(key, { value, at: Date.now() });
      while (entries.size > max) entries.delete(entries.keys().next().value as string);
    },
  };
}
