import { describe, expect, it } from "vitest";
import { fmtDuration, fmtTime, fmtWhen, latestLoggableWhen, nearestSlotInZone } from "@/lib/format";
import { endOfSession } from "@/lib/time-slots";
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

describe("durations", () => {
  it("ends on the same day, or not at all", () => {
    expect(endOfSession("2026-10-05T16:00", 90)).toBe("2026-10-05T17:30");
    expect(endOfSession("2026-10-05T22:30", 60)).toBe("2026-10-05T23:30");
    expect(endOfSession("2026-10-05T23:00", 60)).toBeNull();
    expect(endOfSession("2026-10-05T16:00", null)).toBeNull();
  });

  it("labels the time as a range only when there is a duration", () => {
    expect(fmtTime("2026-10-05T16:00")).toBe("16:00");
    expect(fmtTime("2026-10-05T16:00", 90)).toBe("16:00–17:30");
    expect(fmtWhen("2026-10-05T16:00", "en", 120)).toBe("Mon 5 Oct 2026 · 16:00–18:00");
  });

  it("writes a duration in words", () => {
    expect(fmtDuration(30)).toBe("30 min");
    expect(fmtDuration(120)).toBe("2 h");
    expect(fmtDuration(90)).toBe("1 h 30 min");
    expect(fmtDuration(90, "zh-TW")).toBe("1 小時 30 分");
    expect(fmtDuration(30, "zh-TW")).toBe("30 分鐘");
  });
});
