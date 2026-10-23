import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  datePresetOf,
  datePresets,
  filterToParams,
  matchesFilter,
  NO_BOARD,
  parseFilter,
  shiftDay,
} from "@/lib/session-filter";

const q = (s: string) => parseFilter(new URLSearchParams(s));
const row = (over: Partial<{ spot: string; boardId: string | null; when: string }> = {}) => ({
  spot: "jialeshui",
  boardId: "b1" as string | null,
  when: "2026-09-25T06:00",
  ...over,
});

describe("parseFilter", () => {
  it("reads the four fields", () => {
    expect(q("spot=jialeshui&board=b1&from=2026-09-01&to=2026-09-30")).toEqual({
      spot: "jialeshui",
      board: "b1",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });
  it("ignores malformed values", () => {
    expect(q("from=yesterday&to=2026-9-3&board=a b&spot=")).toEqual({});
    expect(q(`spot=${"x".repeat(201)}`)).toEqual({});
    expect(q("board=../../etc")).toEqual({});
  });
  it("round-trips through filterToParams", () => {
    const f = { spot: "a b", board: NO_BOARD, from: "2026-01-01" };
    expect(parseFilter(filterToParams(f))).toEqual(f);
    expect(filterToParams({}).toString()).toBe("");
  });
});

describe("activeFilterCount", () => {
  it("counts the set fields", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ spot: "x", from: "2026-01-01" })).toBe(2);
  });
});

describe("matchesFilter", () => {
  it("matches everything with no filter", () => {
    expect(matchesFilter(row(), {})).toBe(true);
  });
  it("filters by spot and board", () => {
    expect(matchesFilter(row(), { spot: "jialeshui" })).toBe(true);
    expect(matchesFilter(row(), { spot: "nanwan" })).toBe(false);
    expect(matchesFilter(row(), { board: "b1" })).toBe(true);
    expect(matchesFilter(row(), { board: "b2" })).toBe(false);
  });
  it("NO_BOARD means a session without a board", () => {
    expect(matchesFilter(row({ boardId: null }), { board: NO_BOARD })).toBe(true);
    expect(matchesFilter(row(), { board: NO_BOARD })).toBe(false);
    expect(matchesFilter(row({ boardId: null }), { board: "b1" })).toBe(false);
  });
  it("date range is inclusive of both days, whatever the time", () => {
    const s = row({ when: "2026-09-25T22:00" });
    expect(matchesFilter(s, { from: "2026-09-25", to: "2026-09-25" })).toBe(true);
    expect(matchesFilter(s, { from: "2026-09-26" })).toBe(false);
    expect(matchesFilter(s, { to: "2026-09-24" })).toBe(false);
  });
  it("ANDs the fields", () => {
    expect(matchesFilter(row(), { spot: "jialeshui", board: "b2" })).toBe(false);
  });
});

describe("date presets", () => {
  it("shifts days across month and year ends", () => {
    expect(shiftDay("2026-10-17", -30)).toBe("2026-09-17");
    expect(shiftDay("2026-01-05", -10)).toBe("2025-12-26");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("builds open-ended ranges from today", () => {
    expect(datePresets("2026-10-17").map((p) => p.range)).toEqual([
      {},
      { from: "2026-10-14" },
      { from: "2026-10-10" },
      { from: "2026-09-17" },
      { from: "2026-07-19" },
      { from: "2026-01-01" },
    ]);
  });
  it("recognises a preset, or calls anything else custom", () => {
    expect(datePresetOf({}, "2026-10-17")).toBe("all");
    expect(datePresetOf({ from: "2026-10-14" }, "2026-10-17")).toBe("last3");
    expect(datePresetOf({ from: "2026-10-10" }, "2026-10-17")).toBe("lastWeek");
    expect(datePresetOf({ from: "2026-09-17" }, "2026-10-17")).toBe("last30");
    expect(datePresetOf({ from: "2026-01-01" }, "2026-10-17")).toBe("year");
    expect(datePresetOf({ from: "2026-09-17", to: "2026-10-01" }, "2026-10-17")).toBe("custom");
    expect(datePresetOf({ to: "2026-10-01" }, "2026-10-17")).toBe("custom");
  });
});

describe("tags in the filter", () => {
  it("reads each repeated `tag` param, tidied", () => {
    expect(q("tag=solo&tag=With%20Ming&tag=Glassy")).toEqual({ tags: ["Glassy", "Solo", "With Ming"] });
  });
  it("ignores an invalid list", () => {
    expect(q(`tag=${"x".repeat(30)}`)).toEqual({});
    expect(q("tag=")).toEqual({});
  });
  it("round-trips, including a tag with a comma", () => {
    const f = { tags: ["Glassy", "A, B"], from: "2026-01-01" };
    expect(parseFilter(filterToParams(f))).toEqual(f);
  });
  it("counts as one field", () => {
    expect(activeFilterCount({ tags: ["Glassy", "Solo"], spot: "a" })).toBe(2);
    expect(activeFilterCount({ tags: [] })).toBe(0);
  });
  it("passes a session with any of the tags, and none without", () => {
    const f = { tags: ["Glassy", "Solo"] };
    expect(matchesFilter({ ...row(), tags: ["Quiet", "Solo"] }, f)).toBe(true);
    expect(matchesFilter({ ...row(), tags: ["Quiet"] }, f)).toBe(false);
    expect(matchesFilter(row(), f)).toBe(false);
    expect(matchesFilter(row(), {})).toBe(true);
  });
});
