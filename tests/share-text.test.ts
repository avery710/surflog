import { describe, expect, it } from "vitest";
import { textWidthEm, wrapText } from "@/lib/share-text";

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("Fun peaky wave", 800, 34, 4)).toEqual({ lines: ["Fun peaky wave"], truncated: false });
  });

  it("breaks Latin text at spaces, not mid-word", () => {
    const r = wrapText("offshore in the morning and glassy all session long", 300, 34, 10);
    expect(r.truncated).toBe(false);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.join(" ")).toBe("offshore in the morning and glassy all session long");
    for (const l of r.lines) expect(textWidthEm(l) * 34).toBeLessThanOrEqual(300 + 34);
  });

  it("breaks CJK text per character and keeps every character", () => {
    const text = "早上六點到的時候風還沒起來浪況很乾淨大概是胸到肩膀高的浪";
    const r = wrapText(text, 340, 34, 10); // 10 glyphs per line
    expect(r.lines.length).toBeGreaterThanOrEqual(3);
    expect(r.lines.join("")).toBe(text);
  });

  it("never starts a line with closing punctuation", () => {
    const r = wrapText("一二三四五六七八九，十一二三四五六七八九，十", 340, 34, 10);
    for (const l of r.lines) expect(/^[，。、！？：；）]/.test(l)).toBe(false);
  });

  it("does not split a CJK line at a space after a bullet", () => {
    const r = wrapText("- 潮水往上推之後浪開始變厚換成較大的板子才比較順暢", 340, 34, 10);
    expect(r.lines[0].length).toBeGreaterThan(2);
    expect(r.lines.join("")).toBe("- 潮水往上推之後浪開始變厚換成較大的板子才比較順暢");
  });

  it("truncates to maxLines with an ellipsis that still fits", () => {
    const text = "浪".repeat(200);
    const r = wrapText(text, 340, 34, 3);
    expect(r.truncated).toBe(true);
    expect(r.lines).toHaveLength(3);
    expect(r.lines[2].endsWith("…")).toBe(true);
    expect(textWidthEm(r.lines[2]) * 34).toBeLessThanOrEqual(340 + 1);
  });

  it("honours paragraphs and drops blank lines", () => {
    expect(wrapText("one\n\n\ntwo", 800, 34, 4).lines).toEqual(["one", "two"]);
  });

  it("never cuts a surrogate pair (emoji, rare CJK) in half", () => {
    const text = "🌊".repeat(50) + "𠮷".repeat(50);
    const r = wrapText(text, 340, 34, 2);
    const joined = r.lines.join("");
    // every code unit is part of a valid pair
    expect(joined).toBe(Array.from(joined).join(""));
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(joined)).toBe(false);
  });

  it("handles empty text", () => {
    expect(wrapText("", 800, 34, 4)).toEqual({ lines: [], truncated: false });
  });
});
