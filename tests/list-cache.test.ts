import { describe, expect, it } from "vitest";
import { FILTER_CACHE_MS, takeFresh, type CacheEntry } from "@/lib/list-cache";

describe("takeFresh", () => {
  const entry = (at: number): CacheEntry<string[]> => ({ value: ["a"], at });

  it("returns an entry younger than the limit", () => {
    const cache = new Map([["k", entry(1_000)]]);
    expect(takeFresh(cache, "k", 1_000 + FILTER_CACHE_MS - 1)?.value).toEqual(["a"]);
    expect(cache.has("k")).toBe(true);
  });

  it("drops an entry at or past the limit", () => {
    const cache = new Map([["k", entry(1_000)]]);
    expect(takeFresh(cache, "k", 1_000 + FILTER_CACHE_MS)).toBeNull();
    expect(cache.has("k")).toBe(false);
  });

  it("is null for a key it never had", () => {
    expect(takeFresh(new Map(), "nope", 5)).toBeNull();
  });

  it("takes the limit as a parameter", () => {
    const cache = new Map([["k", entry(0)]]);
    expect(takeFresh(cache, "k", 50, 100)).not.toBeNull();
    expect(takeFresh(cache, "k", 100, 100)).toBeNull();
  });
});
