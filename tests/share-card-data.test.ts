import { describe, expect, it } from "vitest";
import { buildShareCard } from "@/lib/share-card-data";
import { pickTide } from "@/lib/tide-display";
import { tileRows } from "@/lib/share-text";
import { fakeBoard, fakeCond, fakeCondCwaTide, fakeCondOpenMeteo, fakeSession, tideDay } from "@/app/dev/fixtures";
import { TAIWAN_SPOTS_FIXTURE } from "@/lib/spot-fixtures";

const spot = TAIWAN_SPOTS_FIXTURE.find((s) => s.slug === "jialeshui");
const base = (over = {}) =>
  buildShareCard({ session: fakeSession(over), spot, spotName: "Jialeshui", board: fakeBoard(), lang: "en" });
const tile = (d: ReturnType<typeof base>, key: string) => d.tiles.find((t) => t.key === key);

describe("buildShareCard", () => {
  it("builds the five tiles the session card shows, with the card's numbers", () => {
    const d = base();
    expect(d.tiles.map((t) => t.key)).toEqual(["swell", "period", "wind", "temp", "tide"]);
    expect(tile(d, "swell")).toMatchObject({ value: "1.1", unit: "m", lines: ["E"] });
    expect(tile(d, "period")).toMatchObject({ value: "8.2", unit: "s" });
    expect(tile(d, "wind")).toMatchObject({ value: "4.2", unit: "m/s" });
    // 4.2 m/s with gust 6.5 -> midpoint 5.35 -> "Gentle" (< 5.5), as on the card
    expect(tile(d, "wind")?.lines[0]).toBe("Gentle");
    expect(tile(d, "temp")).toMatchObject({ value: "27.4", lines: ["Air 29.1°C"] });
    expect(d.boardName).toBe(`Pyzel Ghost 6'2"`);
    expect(d.whenLabel).toBe("Fri 25 Sep 2026 · 16:00");
  });

  it("tide: headline is rising/falling, small print is only the next turning point", () => {
    const d = base();
    // session 16:00, CWA events: high 14:05, low 20:26 -> next is a low -> falling
    expect(tile(d, "tide")).toMatchObject({ value: "Falling", lines: ["low 20:26 · 0.3 m"] });
  });

  it("CWA wins over Open-Meteo for the tide when it has events", () => {
    const cwa = fakeCondCwaTide({ events: [{ type: "high", time: "2026-09-25T18:00", heightM: 1.4 }, { type: "low", time: "2026-09-25T10:00", heightM: 0.2 }] });
    const om = fakeCondOpenMeteo({ tideEvents: tideDay("2026-09-25") });
    const s = fakeSession({ condCwaTide: cwa, condOpenMeteo: om });
    expect(pickTide(s).source).toBe("cwa");
    expect(tile(base({ condCwaTide: cwa, condOpenMeteo: om }), "tide")).toMatchObject({ value: "Rising", lines: ["high 18:00 · 1.4 m"] });
  });

  it("falls back to Open-Meteo tide events, then to the sea-level trend", () => {
    const om = fakeCondOpenMeteo({ tideEvents: tideDay("2026-09-25") });
    expect(pickTide(fakeSession({ condCwaTide: null, condOpenMeteo: om })).source).toBe("open-meteo");
    const trendOnly = fakeSession({ condCwaTide: null, condOpenMeteo: fakeCondOpenMeteo({ tideEvents: [], seaLevelTrend: "rising" }) });
    expect(pickTide(trendOnly)).toMatchObject({ source: null, trend: "rising" });
    // no source -> no tide tile, like the card
    expect(tile(base({ condCwaTide: null, condOpenMeteo: fakeCondOpenMeteo({ tideEvents: [] }) }), "tide")).toBeUndefined();
  });

  it("marks a next turning point on another day", () => {
    const cwa = fakeCondCwaTide({ events: [{ type: "low", time: "2026-09-25T10:00", heightM: 0.2 }, { type: "high", time: "2026-09-26T00:30", heightM: 1.3 }] });
    expect(tile(base({ condCwaTide: cwa }), "tide")?.lines[0]).toBe("high 00:30 +1d · 1.3 m");
  });

  it("omits tiles whose data is missing, like the card", () => {
    const d = base({ condOpenMeteo: fakeCondOpenMeteo({ swellPeriodS: null, seaTempC: null, airTempC: null }), condCwaTide: null });
    expect(d.tiles.map((t) => t.key)).toEqual(["swell", "wind", "tide"]);
  });

  it("uses typed readings only when there is no Open-Meteo block", () => {
    const d = base({ condOpenMeteo: null, condCwaTide: null, cond: fakeCond() });
    expect(d.tiles.map((t) => t.key)).toEqual(["swell", "period", "wind"]);
    expect(base({ condOpenMeteo: null, condCwaTide: null, cond: null }).tiles).toEqual([]);
  });

  it("translates labels, compass points, wind words and the date to zh-TW", () => {
    const d = buildShareCard({ session: fakeSession(), spot, spotName: "佳樂水", board: null, lang: "zh-TW" });
    expect(tile(d, "swell")).toMatchObject({ label: "湧浪", lines: ["東"] });
    expect(tile(d, "wind")?.lines[0]).toBe("輕風");
    expect(tile(d, "tide")?.value).toBe("退潮中");
    expect(d.whenLabel).toBe("2026年9月25日（週五） · 16:00");
    expect(d.boardName).toBeNull();
  });

  it("notes: plain text from the sanitized HTML, bullets kept, empty when none", () => {
    const d = base({ notesHtml: "<div>Glassy</div><ul><li>one</li><li>two</li></ul>", notes: "" });
    expect(d.notes).toBe("Glassy\n- one\n- two");
    expect(base({ notesHtml: "", notes: "" }).notes).toBe("");
  });
});

describe("tileRows", () => {
  it("balances rows so there is no orphan tile", () => {
    expect(tileRows([1, 2, 3, 4, 5], 3).map((r) => r.length)).toEqual([3, 2]);
    expect(tileRows([1, 2, 3, 4], 3).map((r) => r.length)).toEqual([2, 2]);
    expect(tileRows([1, 2, 3], 3).map((r) => r.length)).toEqual([3]);
    expect(tileRows([1, 2, 3, 4, 5], 5).map((r) => r.length)).toEqual([5]);
    expect(tileRows([], 3)).toEqual([]);
  });
});
