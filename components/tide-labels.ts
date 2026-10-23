import type { TideEvent } from "@/lib/types";

/**
 * Time labels set INTO the tide curve (2026-10-22, after Avery's "A career
 * that moves you." poster: one thin line that stops short of each word and
 * starts again after it, the word in the line's own colour, nothing above or
 * below). At a turning point the curve is cut by a small gap and the time
 * ("09:05", "15:20 +1d") sits in the gap, vertically centred on the curve.
 * It replaces the hollow turning-point dot and the old above/below label, so
 * no margin is needed for it.
 *
 * Pure layout, shared by components/tide-chart.tsx and the dev copy
 * (app/dev/tide-span/base.tsx): decides which labels fit, and where.
 */

export interface LabelOpts {
  /** Font size in px (IBM Plex Mono, so a character is 0.6 em wide). */
  size: number;
  /** Clear space between the text and the curve on each side of it, px. */
  pad: number;
  weight: number;
  /** Label every turning point inside the visible day, not only the two around the session. */
  all: boolean;
  /** A tiny letter before the time ("H 15:20"); null = time only. */
  letters: { high: string; low: string } | null;
  /** Extra space between characters, px (2026-10-23: glyphs crowded on a tight bend). */
  spacing: number;
  /**
   * 0..1, how much of the curve's bend the text does NOT follow (2026-10-23).
   * 0 = the text runs on the exact curve; 1 = a straight tangent line. The text
   * keeps the curve's direction and slope but a gentler curvature, which is
   * what stops the glyphs of a low from squeezing together.
   */
  flatten: number;
}

export const DEFAULT_LABELS: LabelOpts = {
  size: 8.5,
  pad: 3,
  weight: 500,
  all: false,
  letters: null,
  spacing: 0.6,
  flatten: 0.6,
};

/**
 * Line weights shared by the real chart and the dev copy (2026-10-23, on
 * request: heavier, and the blue span exactly as thick as the curve).
 */
export const CURVE_W = 2.25;
/** The single blue dot of a session without a duration. */
export const DOT_R = 3.4;
/** A span shorter than this on screen is drawn this long (butt ends, so this is its whole length), centred on the real span. */
export const MIN_SPAN_PX = 8;

export interface PlacedLabel {
  key: string;
  text: string;
  /** Centre of the text, px. */
  cx: number;
  /** y of the curve at cx: the text is vertically centred on it. */
  cy: number;
  /** Half the cut-out in the curve (text half width + pad). */
  half: number;
  /** The turning point lies inside the session's span: the label is cut into the blue span, in blue. */
  inSpan: boolean;
}

/** Width of a label in px: mono Latin is 0.6 em a character, CJK a full em. */
export function textWidth(text: string, size: number, spacing = 0) {
  let w = 0;
  let n = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2e80 ? size : size * 0.6;
    n++;
  }
  return w + Math.max(0, n - 1) * spacing;
}

/** How far a label may slide along the curve, away from its turning point, to dodge another thing. */
const MAX_SLIDE = 12;

interface Args {
  events: TideEvent[];
  times: number[];
  nextIdx: number;
  tMin: number;
  tMax: number;
  W: number;
  /** ms of the session start / end (end null without a duration). */
  ts: number;
  te: number | null;
  sx: number;
  ex: number | null;
  /** Clear space beyond the session's mark (the round cap of the span, or the dot with its ring), px. */
  markerR: number;
  /** x of a time, y of the curve at a pixel x. */
  x: (time: number) => number;
  curveYAtX: (px: number) => number;
  /** "09:05" plus the day shift. */
  fmt: (e: TideEvent) => string;
  opts: LabelOpts;
}

export function placeTideLabels(a: Args): PlacedLabel[] {
  const { events, times, nextIdx, tMin, tMax, W, ts, te, sx, ex, opts, markerR: MARKER } = a;
  // which turning points: the low and high either side of the session (or the
  // last one, for a session after them all), or every one in the visible day
  const wanted = opts.all
    ? times.map((_, i) => i)
    : nextIdx === -1
      ? [times.length - 1]
      : [nextIdx, ...(nextIdx > 0 ? [nextIdx - 1] : [])];
  const idx = wanted
    .filter((i) => times[i] >= tMin && times[i] <= tMax)
    // the ones nearest the session first: they win a collision
    .sort((p, q) => Math.abs(times[p] - ts) - Math.abs(times[q] - ts));

  const blocked: [number, number][] = [[sx - MARKER, (ex ?? sx) + MARKER]];
  const placed: PlacedLabel[] = [];
  const slides = [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10, -12, 12];

  for (const i of idx) {
    const e = events[i];
    const text = (opts.letters ? `${opts.letters[e.type]} ` : "") + a.fmt(e);
    const half = textWidth(text, opts.size, opts.spacing) / 2 + opts.pad;
    const want = a.x(times[i]);
    const inSpan = te != null && ex != null && times[i] > ts && times[i] < te;
    let cx: number | null = null;

    if (inSpan && ex != null) {
      // the span crosses this turning point: cut the label into the span, but
      // only when the span is long enough to stay a line either side of it
      // (at least 4 px of line either side: a shorter stub would read as a dot)
      const inset = Math.max(MARKER, 4);
      if (ex - sx >= 2 * half + 2 * inset + 2) {
        cx = Math.min(ex - inset - half, Math.max(sx + inset + half, want));
      }
    } else {
      const lo = half + 1;
      const hi = W - half - 1;
      const base = Math.min(hi, Math.max(lo, want));
      for (const s of slides) {
        const c = Math.min(hi, Math.max(lo, base + s));
        if (Math.abs(c - want) > MAX_SLIDE + Math.abs(base - want)) continue;
        const clear =
          blocked.every(([b0, b1]) => c + half <= b0 || c - half >= b1) &&
          placed.every((p) => c + half + 1 <= p.cx - p.half || c - half - 1 >= p.cx + p.half);
        if (clear) {
          cx = c;
          break;
        }
      }
    }
    if (cx == null) continue;
    placed.push({ key: `${e.type}-${e.time}`, text, cx, cy: a.curveYAtX(cx), half, inSpan });
  }
  return placed;
}

/** Rounds a drawn number to 0.01 px: Math.cos differs in the last digit between Node and the browser, which made hydration complain. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Walks along the curve from pixel x `cx` by `len` px of arc length, left
 * (dir -1) or right (dir 1); returns the x reached and the length walked.
 */
export function walkCurve(
  yAtX: (px: number) => number,
  W: number,
  cx: number,
  len: number,
  dir: number,
): [number, number] {
  let px = cx;
  let py = yAtX(cx);
  let d = 0;
  while (d < len) {
    const nx = px + dir * 0.5;
    if (nx < 0 || nx > W) break;
    const ny = yAtX(nx);
    d += Math.hypot(nx - px, ny - py);
    px = nx;
    py = ny;
  }
  return [px, d];
}

export interface LabelOnCurve extends PlacedLabel {
  /** x of the two ends of the gap, measured along the curve. */
  g0: number;
  g1: number;
  /** Where the text starts along its path (the path's arc length up to the label's centre). */
  lead: number;
  /** The text's path: the curve with its bend reduced by `flatten`, shifted down so the text's middle sits on the line. */
  d: string;
}

/**
 * Each label bends with the curve (2026-10-23, after Avery's "meant for you"
 * reference): its text runs on a <textPath>, and its gap is measured along the
 * curve. On a tight bend (a low at 140 px) exact following squeezes the glyphs
 * together, so the text path keeps the curve's slope at the label's centre but
 * only (1 - flatten) of its bend, and the characters get a little extra
 * spacing. A shift keeps arc length, so the whole path is the flattened curve
 * moved down 0.36 em.
 */
export function labelsOnCurve(
  placed: PlacedLabel[],
  a: { W: number; yAtX: (px: number) => number; opts: LabelOpts },
): LabelOnCurve[] {
  const { W, yAtX, opts } = a;
  return placed.map((p) => {
    const [g0] = walkCurve(yAtX, W, p.cx, p.half, -1);
    const [g1] = walkCurve(yAtX, W, p.cx, p.half, 1);
    // the text path runs past the gap so no glyph falls off its end; a pixel
    // extent in x is never longer than the arc, so it is at least half + 6 long
    const reach = p.half + 6;
    const s0 = Math.max(0, p.cx - reach);
    const s1 = Math.min(W, p.cx + reach);
    const y0 = yAtX(p.cx);
    const slope = (yAtX(p.cx + 1) - yAtX(p.cx - 1)) / 2;
    const yText = (px: number) => {
      const tangent = y0 + slope * (px - p.cx);
      return tangent + (1 - opts.flatten) * (yAtX(px) - tangent) + opts.size * 0.36;
    };
    const d: string[] = [];
    let lead = 0;
    let prevX = s0;
    let prevY = yText(s0);
    for (let px = s0; px <= s1 + 0.01; px += 0.5) {
      const py = yText(px);
      if (px <= p.cx) lead += Math.hypot(px - prevX, py - prevY);
      d.push(`${d.length ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`);
      prevX = px;
      prevY = py;
    }
    return { ...p, g0: r2(g0), g1: r2(g1), lead: r2(lead), d: d.join(" ") };
  });
}

/**
 * The stretches of the line between the label gaps, as [x0, x1] pairs. Each
 * run ends `capR` px short of the gap edge (measured along the curve), so the
 * round cap's tip lands where a flat cut would have been and the clear space
 * to the text stays the same. A run that would end before it starts is dropped.
 */
export function curveRuns(
  from: number,
  to: number,
  gaps: { g0: number; g1: number }[],
  capR: number,
  yAtX: (px: number) => number,
  W: number,
): [number, number][] {
  const sorted = gaps.filter((g) => g.g1 > from && g.g0 < to).sort((p, q) => p.g0 - q.g0);
  const runs: [number, number][] = [];
  let start = from;
  for (const g of sorted) {
    const [end] = walkCurve(yAtX, W, g.g0, capR, -1);
    if (end > start) runs.push([start, Math.min(end, to)]);
    const [next] = walkCurve(yAtX, W, g.g1, capR, 1);
    start = Math.max(start, next);
  }
  if (to > start) runs.push([start, to]);
  return runs.filter(([x0, x1]) => x1 > x0);
}

/** An SVG path along the curve between two pixel xs, sampled about every pixel. */
export function runPath(x0: number, x1: number, yAtX: (px: number) => number): string {
  const n = Math.max(2, Math.ceil(x1 - x0));
  const out: string[] = [];
  for (let k = 0; k <= n; k++) {
    const px = x0 + ((x1 - x0) * k) / n;
    out.push(`${k ? "L" : "M"}${px.toFixed(2)} ${yAtX(px).toFixed(2)}`);
  }
  return out.join(" ");
}

/**
 * The blue session span, in pieces. Its two outer ends are flat (butt): the
 * span reads as a stretch of the curve turned blue, flush with the grey on
 * either side (2026-10-23, on request). Where a label is cut into it, the
 * sides of that gap are round like every other gap in the curve: a butt-capped
 * piece plus a dot of the line's radius at that end, which is the same shape
 * as a round cap but leaves the outer ends flat.
 */
export function spanParts(
  from: number,
  to: number,
  gaps: { g0: number; g1: number }[],
  capR: number,
  yAtX: (px: number) => number,
  W: number,
): { paths: string[]; dots: { x: number; y: number }[] } {
  const paths: string[] = [];
  const dots: { x: number; y: number }[] = [];
  for (const [a, b] of curveRuns(from, to, gaps, capR, yAtX, W)) {
    paths.push(runPath(a, b, yAtX));
    if (a - from > 0.001) dots.push({ x: r2(a), y: r2(yAtX(a)) });
    if (to - b > 0.001) dots.push({ x: r2(b), y: r2(yAtX(b)) });
  }
  return { paths, dots };
}
