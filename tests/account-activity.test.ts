import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ from: () => ({ upsert }) }),
}));

import { recordActivity, taipeiDay } from "@/lib/account-activity";

beforeEach(() => {
  upsert.mockReset();
  upsert.mockResolvedValue({ error: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("taipeiDay", () => {
  it("rolls over at midnight Taipei, not UTC", () => {
    expect(taipeiDay(new Date("2026-10-27T15:59:00Z"))).toBe("2026-10-27");
    expect(taipeiDay(new Date("2026-10-27T16:00:00Z"))).toBe("2026-10-28");
  });
});

describe("recordActivity", () => {
  it("writes once per person per day", async () => {
    const t = new Date("2026-11-01T02:00:00Z");
    await recordActivity("owner-a", t);
    await recordActivity("owner-a", new Date("2026-11-01T09:00:00Z"));
    await recordActivity("owner-b", t);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(
      { owner_id: "owner-a", day: "2026-11-01" },
      { onConflict: "owner_id,day", ignoreDuplicates: true },
    );
  });

  it("writes again the next day", async () => {
    await recordActivity("owner-c", new Date("2026-11-02T02:00:00Z"));
    await recordActivity("owner-c", new Date("2026-11-03T02:00:00Z"));
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("never throws, and retries after a failure", async () => {
    const t = new Date("2026-11-04T02:00:00Z");
    upsert.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(recordActivity("owner-d", t)).resolves.toBeUndefined();
    await recordActivity("owner-d", t);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
