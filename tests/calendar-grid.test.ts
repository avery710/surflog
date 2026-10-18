import { describe, expect, it } from "vitest";
import { monthCells, monthTitle, shiftMonth } from "@/lib/calendar-grid";

describe("monthCells", () => {
  it("is always 42 cells, Sunday first", () => {
    for (const [y, m] of [[2026, 9], [2026, 1], [2024, 1], [2026, 10]]) expect(monthCells(y, m)).toHaveLength(42);
  });
  it("starts on the right weekday (1 Oct 2026 is a Thursday)", () => {
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toBe("2026-10-01");
  });
  it("has every day exactly once", () => {
    const days = monthCells(2026, 9).filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days[30]).toBe("2026-10-31");
    expect(monthCells(2024, 1).filter(Boolean)).toHaveLength(29); // leap year
    expect(monthCells(2026, 1).filter(Boolean)).toHaveLength(28);
  });
  it("starts on column 0 when the 1st is a Sunday (1 Feb 2026)", () => {
    expect(monthCells(2026, 1)[0]).toBe("2026-02-01");
  });
});

describe("shiftMonth", () => {
  it("rolls over year ends both ways", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 9, -13)).toEqual({ year: 2025, month: 8 });
  });
});

describe("monthTitle", () => {
  it("follows the language", () => {
    expect(monthTitle(2026, 9, "en")).toBe("October 2026");
    expect(monthTitle(2026, 9, "zh-TW")).toBe("2026年10月");
  });
});
