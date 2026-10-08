import { describe, expect, it } from "vitest";
import { applyKnockout } from "@/lib/share-knockout";

const px = (arr: number[]) => Uint8Array.from(arr);

describe("applyKnockout", () => {
  it("light: flag pixels become transparent, half-blends half-transparent, shape stays", () => {
    // white shape, pure flag (magenta), 50% blend, solid dark ink
    const buf = px([255, 255, 255, 255, /**/ 255, 0, 255, 255, /**/ 255, 128, 255, 255, /**/ 11, 13, 18, 255]);
    applyKnockout(buf, 4, 1, "light");
    expect(Array.from(buf.slice(0, 4))).toEqual([255, 255, 255, 255]);
    expect(buf[7]).toBe(0);
    expect(buf[11]).toBeGreaterThan(120);
    expect(buf[11]).toBeLessThan(135);
    expect(Array.from(buf.slice(12, 16))).toEqual([11, 13, 18, 255]); // not on the blend line: solid ink kept
  });
  it("dark: flag pixels become transparent, solid white ink is kept", () => {
    const buf = px([11, 13, 18, 255, /**/ 255, 0, 255, 255, /**/ 255, 255, 255, 255]);
    applyKnockout(buf, 3, 1, "dark");
    expect(buf[7]).toBe(0);
    expect(Array.from(buf.slice(8, 12))).toEqual([255, 255, 255, 255]);
  });
  it("finds the photo placeholder and fills it with the shape colour", () => {
    const w = 6;
    const buf = new Uint8Array(w * 6 * 4).fill(255);
    for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]]) buf.set([0, 255, 0, 255], (y * w + x) * 4);
    const { photo } = applyKnockout(buf, w, 6, "light");
    expect(photo).toEqual({ x: 2, y: 2, d: 2 });
    expect(Array.from(buf.slice((2 * w + 2) * 4, (2 * w + 2) * 4 + 4))).toEqual([255, 255, 255, 255]);
  });
  it("translucent shapes: inside the bands text is alpha 0 and the shape keeps shapeAlpha, outside is untouched", () => {
    // 1 pixel per row: row0 = shape, row1 = flag text, row2 = half blend, row3 = plain white text (outside the band)
    const buf = px([255, 255, 255, 255, /**/ 255, 0, 255, 255, /**/ 255, 128, 255, 255, /**/ 255, 255, 255, 255]);
    applyKnockout(buf, 1, 4, "light", { shapeAlpha: 0.6, bands: [[0, 3]] });
    expect(buf[3]).toBe(153);
    expect(buf[7]).toBe(0);
    expect(buf[11]).toBeGreaterThan(70);
    expect(buf[11]).toBeLessThan(83);
    expect(buf[15]).toBe(255);
    const dark = px([11, 13, 18, 255, /**/ 255, 0, 255, 255]);
    applyKnockout(dark, 1, 2, "dark", { shapeAlpha: 0.6, bands: [[0, 2]] });
    expect(dark[3]).toBe(153);
    expect(dark[7]).toBe(0);
  });
  it("coloured wind dots are not mistaken for flag or photo pixels", () => {
    for (const dot of [[132, 204, 22, 153], [52, 211, 153, 153], [251, 191, 36, 153], [239, 68, 68, 153]]) {
      for (const tone of ["light", "dark"] as const) {
        const buf = px(dot);
        applyKnockout(buf, 1, 1, tone);
        expect(Array.from(buf)).toEqual(dot);
      }
    }
  });
});
