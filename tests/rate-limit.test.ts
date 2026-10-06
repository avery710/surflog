import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

beforeEach(resetRateLimits);

describe("rateLimit", () => {
  it("allows up to the limit, then refuses with a retry time", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("a", 3, 60_000, 1000).ok).toBe(true);
    expect(rateLimit("a", 3, 60_000, 31_000)).toEqual({ ok: false, retryAfterS: 30 });
  });

  it("starts a fresh window once the old one has passed", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 60_000, 1000);
    expect(rateLimit("a", 3, 60_000, 60_999).ok).toBe(false);
    expect(rateLimit("a", 3, 60_000, 61_000).ok).toBe(true);
  });

  it("counts each key on its own", () => {
    expect(rateLimit("a", 1, 60_000, 0).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000, 1).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, 1).ok).toBe(true);
  });

  it("a refused call doesn't extend the window", () => {
    rateLimit("a", 1, 10_000, 0);
    for (let t = 1; t < 10; t++) rateLimit("a", 1, 10_000, t * 1000);
    expect(rateLimit("a", 1, 10_000, 10_000).ok).toBe(true);
  });
});
