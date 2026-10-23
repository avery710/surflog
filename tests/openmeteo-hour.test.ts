import { afterEach, describe, expect, it, vi } from "vitest";
import { getConditions } from "@/lib/openmeteo";

// Every hourly series answers with its own index (0 … 23), so the value read
// back says which hour getConditions picked.
const series = Array.from({ length: 24 }, (_, h) => h);
const hourly = new Proxy({} as Record<string, number[]>, { get: () => series, has: () => true });

afterEach(() => vi.unstubAllGlobals());

async function conditionsFor(when: string, durationMin?: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ latitude: 24.9, longitude: 121.8, hourly }) }))
  );
  return getConditions(24.87, 121.84, when, "Asia/Taipei", durationMin);
}
const hourFor = async (when: string) => (await conditionsFor(when)).swellHeightM;

describe("getConditions hour", () => {
  it("reads the hour itself on the hour, and rounds :30 up to the next", async () => {
    expect(await hourFor("2026-10-05T16:00")).toBe(16);
    expect(await hourFor("2026-10-05T16:30")).toBe(17);
    expect(await hourFor("2026-10-05T00:30")).toBe(1);
  });

  it("stays on the day's last reading at 23:30", async () => {
    expect(await hourFor("2026-10-05T23:30")).toBe(23);
  });
});

describe("getConditions over a session's duration", () => {
  it("reports the median swell height of the hours it covered", async () => {
    // the series is 0…23, so 16:00 + 2 h covers hours 16, 17, 18 → median 17
    const c = await conditionsFor("2026-10-05T16:00", 120);
    expect(c.swellHeightM).toBe(16); // still the start's reading
    expect(c.swellHeightMedianM).toBe(17);
  });

  it("averages the two middle hours when the count is even", async () => {
    // 16:00 + 1 h covers hours 16, 17 → median 16.5
    expect((await conditionsFor("2026-10-05T16:00", 60)).swellHeightMedianM).toBe(16.5);
  });

  it("runs from the start's nearest hour to the last whole hour inside the session", async () => {
    // 16:30–18:30: the start reads 17, and 17:00 and 18:00 lie inside it → median 17.5
    expect((await conditionsFor("2026-10-05T16:30", 120)).swellHeightMedianM).toBe(17.5);
  });

  it("has no median for a session inside one hour, or without a duration", async () => {
    expect((await conditionsFor("2026-10-05T16:00", 30)).swellHeightMedianM).toBeUndefined();
    expect((await conditionsFor("2026-10-05T16:00")).swellHeightMedianM).toBeUndefined();
  });
});
