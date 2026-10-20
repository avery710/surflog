import { afterEach, describe, expect, it, vi } from "vitest";
import { getConditions } from "@/lib/openmeteo";

// Every hourly series answers with its own index (0 … 23), so the value read
// back says which hour getConditions picked.
const series = Array.from({ length: 24 }, (_, h) => h);
const hourly = new Proxy({} as Record<string, number[]>, { get: () => series, has: () => true });

afterEach(() => vi.unstubAllGlobals());

async function hourFor(when: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ latitude: 24.9, longitude: 121.8, hourly }) }))
  );
  return (await getConditions(24.87, 121.84, when, "Asia/Taipei")).swellHeightM;
}

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
