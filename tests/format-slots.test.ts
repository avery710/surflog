import { describe, expect, it } from "vitest";
import { latestLoggableWhen, nearestSlotInZone } from "@/lib/format";
import { TIME_SLOTS } from "@/lib/time-slots";

// 2026-10-20 07:xx UTC is 15:xx in Taipei (UTC+8, no DST)
const at = (hhmmUtc: string) => new Date(`2026-10-20T${hhmmUtc}:00Z`);

describe("TIME_SLOTS", () => {
  it("is every half hour of the day", () => {
    expect(TIME_SLOTS).toHaveLength(48);
    expect(TIME_SLOTS[0]).toBe("00:00");
    expect(TIME_SLOTS[1]).toBe("00:30");
    expect(TIME_SLOTS.at(-1)).toBe("23:30");
  });
});

describe("nearestSlotInZone", () => {
  it("rounds to the nearest half hour, a tie going up", () => {
    expect(nearestSlotInZone("Asia/Taipei", at("07:14"))).toBe("15:00");
    expect(nearestSlotInZone("Asia/Taipei", at("07:15"))).toBe("15:30");
    expect(nearestSlotInZone("Asia/Taipei", at("07:44"))).toBe("15:30");
    expect(nearestSlotInZone("Asia/Taipei", at("07:45"))).toBe("16:00");
  });
  it("stops at 23:30 and reads the spot's own clock", () => {
    expect(nearestSlotInZone("Asia/Taipei", at("15:50"))).toBe("23:30"); // 23:50 there
    expect(nearestSlotInZone("America/Los_Angeles", at("07:20"))).toBe("00:30");
  });
});

describe("latestLoggableWhen", () => {
  it("is now plus 15 minutes at the spot, so the rounded slot is always allowed", () => {
    expect(latestLoggableWhen("Asia/Taipei", at("07:20"))).toBe("2026-10-20T15:35");
    expect(latestLoggableWhen("Asia/Taipei", at("15:50"))).toBe("2026-10-21T00:05");
    for (const m of ["00", "10", "15", "20", "29", "30", "44", "45", "59"]) {
      const now = at(`07:${m}`);
      const slot = `2026-10-20T${nearestSlotInZone("Asia/Taipei", now)}`;
      expect(slot <= latestLoggableWhen("Asia/Taipei", now)).toBe(true);
    }
  });
});
