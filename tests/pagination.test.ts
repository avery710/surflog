import { describe, expect, it } from "vitest";
import { clampPage, pageCount, pageToFetch, parsePage } from "@/lib/pagination";
import { addToLoaded, compareSessions, mergePage, upsertStat } from "@/lib/session-stats";

describe("parsePage", () => {
  it("reads positive whole numbers", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("15")).toBe(15);
  });
  it("falls back to 1 for anything else", () => {
    for (const raw of [null, undefined, "", "0", "-3", "1.5", "abc", "2x", " 2", "1e3", "99999999999999999999"]) {
      expect(parsePage(raw)).toBe(1);
    }
  });
});

describe("pageCount / clampPage", () => {
  it("counts 10 per page and never goes below one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(10)).toBe(1);
    expect(pageCount(11)).toBe(2);
    expect(pageCount(95)).toBe(10);
  });
  it("clamps into range", () => {
    expect(clampPage(99, 25)).toBe(3);
    expect(clampPage(0, 25)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
  });
});

const mk = (id: string, when: string, createdAt = "2026-10-01T00:00:00Z") => ({
  id,
  when,
  createdAt,
  spot: "x",
  boardId: null,
  goalText: null,
  goalMet: null,
  goalPointsMet: null,
});
const day = (i: number) => `2026-09-${String(30 - i).padStart(2, "0")}T06:00`;
const rows = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => mk(`s${from + i}`, day(from + i)));

describe("session list order", () => {
  it("sorts by when, then createdAt, then id, newest first", () => {
    const list = [
      mk("b", "2026-09-01T06:00", "2026-09-02T00:00:00Z"),
      mk("a", "2026-09-01T06:00", "2026-09-02T00:00:00Z"),
      mk("c", "2026-09-01T06:00", "2026-09-03T00:00:00Z"),
      mk("d", "2026-09-05T06:00", "2026-09-01T00:00:00Z"),
    ].sort(compareSessions);
    expect(list.map((s) => s.id)).toEqual(["d", "c", "a", "b"]);
  });
  it("upserts into place", () => {
    const next = upsertStat(rows(0, 25), mk("new", "2026-09-30T14:00", "2026-10-02T00:00:00Z"));
    expect(next[0].id).toBe("new");
    expect(next).toHaveLength(26);
    expect(upsertStat(next, { ...next[0], spot: "y" })).toHaveLength(26);
  });
});

describe("infinite scroll bookkeeping", () => {
  it("asks for the page that starts at or before the first unloaded row", () => {
    expect(pageToFetch(0)).toBe(1);
    expect(pageToFetch(10)).toBe(2);
    expect(pageToFetch(20)).toBe(3);
    // one row was deleted from the loaded top: row 9 moved up and is still unloaded
    expect(pageToFetch(9)).toBe(1);
    // one row was added to the loaded top
    expect(pageToFetch(11)).toBe(2);
  });

  it("loads every row exactly once while pages arrive", () => {
    const all = rows(0, 23);
    let loaded = all.slice(0, 10);
    while (loaded.length < all.length) {
      const page = pageToFetch(loaded.length);
      loaded = mergePage(loaded, all.slice((page - 1) * 10, page * 10));
    }
    expect(loaded.map((s) => s.id)).toEqual(all.map((s) => s.id));
  });

  it("loses nothing when a loaded row is deleted mid-scroll", () => {
    let all = rows(0, 25);
    let loaded = all.slice(0, 20);
    all = all.filter((s) => s.id !== "s3"); // the server's list after the delete
    loaded = loaded.filter((s) => s.id !== "s3");
    while (loaded.length < all.length) {
      const page = pageToFetch(loaded.length);
      loaded = mergePage(loaded, all.slice((page - 1) * 10, page * 10));
    }
    expect(loaded.map((s) => s.id)).toEqual(all.map((s) => s.id));
  });

  it("loses nothing when a session is added inside the loaded rows", () => {
    const created = mk("new", "2026-09-27T12:00");
    const all = [...rows(0, 25), created].sort(compareSessions);
    const rank = all.findIndex((s) => s.id === "new");
    let loaded = addToLoaded(rows(0, 10), created, rank);
    expect(loaded.some((s) => s.id === "new")).toBe(true);
    while (loaded.length < all.length) {
      const page = pageToFetch(loaded.length);
      loaded = mergePage(loaded, all.slice((page - 1) * 10, page * 10));
    }
    expect(loaded.map((s) => s.id)).toEqual(all.map((s) => s.id));
  });

  it("leaves a session dated further down unloaded until its page arrives", () => {
    const old = mk("old", "2026-01-01T06:00");
    const all = [...rows(0, 25), old].sort(compareSessions);
    const rank = all.findIndex((s) => s.id === "old");
    const loaded = rows(0, 10);
    expect(addToLoaded(loaded, old, rank)).toBe(loaded);
  });
});
