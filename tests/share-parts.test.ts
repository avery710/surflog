import { describe, expect, it } from "vitest";
import { ALL_PARTS, noParts, parseShareParts, serializeShareParts } from "@/lib/share-parts";
import { buildShareCard, notesBlocks, tideCurve } from "@/lib/share-card-data";
import { NOTE_MAX_LINES, layoutShare, wrapNotes } from "@/lib/share-element";
import { fakeBoard, fakeSession } from "@/app/dev/fixtures";
import { TAIWAN_SPOTS_FIXTURE } from "@/lib/spot-fixtures";

const data = () =>
  buildShareCard({
    session: fakeSession({ notes: "Fun wave", notesHtml: "<p>Fun wave</p>" }),
    spot: TAIWAN_SPOTS_FIXTURE.find((s) => s.slug === "jialeshui"),
    spotName: "Jialeshui",
    board: fakeBoard(),
    lang: "en",
  });

describe("share parts", () => {
  it("absent param means everything; a list means only those", () => {
    expect(parseShareParts(null)).toEqual(ALL_PARTS);
    expect(parseShareParts("details,log")).toEqual({ datetime: true, waves: true, board: false, log: true });
    expect(parseShareParts("")).toEqual({ datetime: false, waves: false, board: false, log: false });
  });
  it("the merged details value still turns both on, one of them alone does not turn on the other", () => {
    expect(parseShareParts("details")).toMatchObject({ datetime: true, waves: true });
    expect(parseShareParts("waves")).toMatchObject({ datetime: false, waves: true });
  });
  it("round-trips and detects nothing selected", () => {
    expect(parseShareParts(serializeShareParts(ALL_PARTS))).toEqual(ALL_PARTS);
    expect(noParts(parseShareParts(""))).toBe(true);
    expect(noParts(ALL_PARTS)).toBe(false);
  });
});

describe("layoutShare with parts", () => {
  it("drops what is switched off and shrinks the strip to fit", () => {
    const d = data();
    const all = layoutShare(d, "strip");
    expect(all.tiles.map((t) => t.key)).toEqual(["swell", "period", "wind", "temp", "tide"]);
    expect(all.noteLines.length).toBe(1);
    const dataOnly = layoutShare(d, "strip", parseShareParts("datetime,waves"));
    expect(dataOnly.nameLines).toEqual(["Jialeshui"]); // the spot is always shown
    expect(dataOnly.noteLines).toEqual([]);
    expect(dataOnly.height).toBeLessThan(all.height);
    expect(layoutShare(d, "column", parseShareParts("log")).tiles).toEqual([]);
  });
  it("the card keeps all five tiles in one row and is sized to its content", () => {
    const card = layoutShare(data(), "card");
    expect(card.tiles).toHaveLength(5);
    expect(card.width).toBe(1080);
    expect(card.height).toBeLessThan(1350);
    expect(layoutShare(data(), "card", parseShareParts("datetime,waves")).height).toBeLessThan(card.height);
  });
  it("og stays 1200x630", () => {
    expect(layoutShare(data(), "og")).toMatchObject({ width: 1200, height: 630 });
  });
});

describe("tideCurve", () => {
  const ev = [
    { type: "low" as const, time: "2026-09-25T10:00", heightM: 0.2 },
    { type: "high" as const, time: "2026-09-25T16:00", heightM: 1.2 },
    { type: "low" as const, time: "2026-09-25T22:00", heightM: 0.3 },
  ];
  it("marks the session time and normalises to 0..1", () => {
    const c = tideCurve(ev, "2026-09-25T16:00");
    expect(c).not.toBeNull();
    expect(c!.nowY).toBeCloseTo(1, 1);
    expect(Math.max(...c!.points.map((p) => p[1]))).toBeCloseTo(1, 5);
    expect(Math.min(...c!.points.map((p) => p[1]))).toBeCloseTo(0, 5);
  });
  it("is null with fewer than two events or a session outside them", () => {
    expect(tideCurve(ev.slice(0, 1), "2026-09-25T10:00")).toBeNull();
    expect(tideCurve(ev, "2026-09-27T10:00")).toBeNull();
  });
});

describe("image tiles", () => {
  it("are slim: no compass, no strength, no air temp, tide is only a curve (no word)", () => {
    const d = data();
    const t = (k: string) => d.imageTiles.find((x) => x.key === k);
    expect(t("swell")).toMatchObject({ value: "1.1", unit: "m", lines: [] });
    expect(t("wind")?.lines).toEqual(["Gentle", "Mostly offshore"]); // strength word + shore word
    expect(t("wind")?.dot).toBe("#84cc16"); // the card's "gentle" dot colour
    expect(t("temp")).toMatchObject({ value: "27.4", lines: [] });
    expect(t("tide")).toMatchObject({ value: "", lines: [] }); // just the curve and the session dot
    expect(d.tideCurve).not.toBeNull();
    // the public page still gets the full tiles
    expect(d.tiles.find((x) => x.key === "wind")?.lines.length).toBeGreaterThan(1);
  });
});

describe("notes for the images", () => {
  it("lists become markers, paragraphs and breaks become lines", () => {
    const html = "<div>Intro line</div><ul><li>one</li><li>two <b>bold</b></li></ul><ol><li>a</li><li>b</li></ol><p>x<br>y &amp; z</p>";
    expect(notesBlocks(html, "")).toEqual([
      { marker: null, text: "Intro line" },
      { marker: "•", text: "one" },
      { marker: "•", text: "two bold" },
      { marker: "1.", text: "a" },
      { marker: "2.", text: "b" },
      { marker: null, text: "x" },
      { marker: null, text: "y & z" },
    ]);
  });
  it("falls back to the plain mirror, '- ' lines are bullets", () => {
    expect(notesBlocks("", "hello\n- item")).toEqual([{ marker: null, text: "hello" }, { marker: "•", text: "item" }]);
  });
  it("wrapNotes caps the total lines with an ellipsis and indents list items", () => {
    const blocks = Array.from({ length: 12 }, (_, i) => ({ marker: "•", text: `項目${i}` }));
    const lines = wrapNotes(blocks, 900, 32, NOTE_MAX_LINES.strip);
    expect(lines).toHaveLength(NOTE_MAX_LINES.strip);
    expect(lines[0].indent).toBeGreaterThan(0);
    expect(lines[lines.length - 1].text.endsWith("…")).toBe(true);
    expect(wrapNotes(blocks.slice(0, 2), 900, 32, 4).some((l) => l.text.endsWith("…"))).toBe(false);
  });
});
