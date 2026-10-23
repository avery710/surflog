"use client";

import type { Geo, Variant } from "../tide-span/base";

/**
 * Ten ways to draw the session's own time span in blue on the Tide-tile
 * curve, after the "Growth, plotted." poster Avery attached (one thick,
 * round-capped line; small solid marker shapes at the ends; a bold mono label
 * with a small caption), plus five iterations of the time labels set into the
 * curve (after the "A career that moves you." poster). The curve, its dimming
 * and the embedded turning-point times are the real ones
 * (../tide-span/base.tsx is a copy of components/tide-chart.tsx); the span is a
 * solid blue line with no halo and no dots at its ends (its ends are the
 * line's round caps). Only the variants whose whole point is an end marker
 * (route, milestones, track, wave route) keep markers, without a white ring.
 * Blue is `--primary` only (stroke-primary / fill-primary), the rest keeps
 * today's tokens; no new colours.
 *
 * Every variant is built per chart (`build(info)`) because some draw the
 * session's times as text.
 */

export interface Info {
  /** "11:00" */
  start: string;
  /** "13:00", null without a duration */
  end: string | null;
  /** fmtDuration(min), null without a duration */
  dur: string | null;
  startCap: string;
  endCap: string;
  /** Letters for the labelled turning points: en H / L, zh-TW 滿 / 乾 (never 高 / 低). */
  letters: { high: string; low: string };
}

export interface Def {
  id: string;
  /** Extra svg height below the original 40 px, with / without a duration. */
  extra: (hasDuration: boolean) => number;
  build: (info: Info) => Variant;
}

type Kind = "circle" | "square" | "clover";

/** The solid marker shapes: a circle, a rounded square, a four-lobed clover. */
function shape(kind: Kind, x: number, y: number, props: React.SVGProps<SVGElement> & { className?: string }) {
  const p = props as React.SVGProps<SVGGElement>;
  if (kind === "circle") return <circle cx={x} cy={y} r={3.2} {...(props as React.SVGProps<SVGCircleElement>)} />;
  if (kind === "square")
    return <rect x={x - 3.2} y={y - 3.2} width={6.4} height={6.4} rx={1.7} {...(props as React.SVGProps<SVGRectElement>)} />;
  return (
    <g {...p}>
      <circle cx={x - 1.9} cy={y} r={2} />
      <circle cx={x + 1.9} cy={y} r={2} />
      <circle cx={x} cy={y - 1.9} r={2} />
      <circle cx={x} cy={y + 1.9} r={2} />
      <rect x={x - 1.9} y={y - 1.9} width={3.8} height={3.8} />
    </g>
  );
}

/** A solid blue marker sitting directly on the line: no white ring, so it merges with it. */
function Mark({ kind, x, y }: { kind: Kind; x: number; y: number }) {
  return shape(kind, x, y, { className: "fill-primary" });
}

/** The one blue dot that marks a session without a duration (no white ring). */
function SessionDot({ g }: { g: Geo }) {
  return g.session.end ? null : <circle cx={g.session.sx} cy={g.session.sy} r={3.2} className="fill-primary" />;
}

/** The session's stretch as a solid blue round-capped line. No halo, no translucent blue (removed 2026-10-22). */
function Stretch({ g, w }: { g: Geo; w: number }) {
  const d = g.session.path;
  if (!d) return null;
  return (
    <path d={d} fill="none" className="stroke-primary" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" mask={g.spanMask} />
  );
}

/** Below this many px the two ends would sit on top of each other: the end marker is dropped. */
const MIN_FOR_END_MARK = 9;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------

/** 1. now: what the real chart draws since 2026-10-22 (solid blue line, no halo, no end dots, times set into the curve). */
const now: Def = { id: "now", extra: () => 0, build: () => ({ id: "now" }) };

/** 2. Route: the boldest thing on the chart; circle start, rounded-square end. */
const route: Def = {
  id: "route",
  extra: () => 0,
  build: () => ({
    id: "route",
    dim: 0.2,
    session: (g) => {
      const s = g.session;
      const long = s.end ? s.end.x1 - s.end.x0 >= MIN_FOR_END_MARK : false;
      return (
        <>
          <Stretch g={g} w={4.5} />
          {s.end && long && <Mark kind="square" x={s.end.ex} y={s.end.ey} />}
          <Mark kind="circle" x={s.sx} y={s.sy} />
        </>
      );
    },
  }),
};

/** 5. Label: bold mono start time, small caption (the length) under it, hanging below the span's start. */
const label: Def = {
  id: "label",
  extra: (d) => (d ? 22 : 12),
  build: (info) => ({
    id: "label",
    extra: info.dur ? 22 : 12,
    session: (g) => {
      const s = g.session;
      const textW = info.start.length * 6;
      const right = s.sx + textW > g.W - 2;
      const x = right ? Math.min(g.W - 1, s.sx + 1) : Math.max(1, s.sx - 1);
      const anchor = right ? "end" : "start";
      return (
        <>
          <Stretch g={g} w={3} />
          <SessionDot g={g} />
          <text x={x} y={g.H0 + 9.5} textAnchor={anchor} fontSize={10} fontWeight={700} className="fill-primary font-mono">
            {info.start}
          </text>
          {info.dur && (
            <text x={x} y={g.H0 + 19.5} textAnchor={anchor} fontSize={8.5} fontWeight={500} className="fill-muted-foreground">
              {info.dur}
            </text>
          )}
        </>
      );
    },
  }),
};

/** 6. Pill: a solid blue pill with the session's time, under the middle of the span. */
const pill: Def = {
  id: "pill",
  extra: () => 17,
  build: (info) => ({
    id: "pill",
    extra: 17,
    session: (g) => {
      const s = g.session;
      const text = info.end ? `${info.start}–${info.end}` : info.start;
      const pw = text.length * 5.5 + 10;
      const mid = s.end ? (s.sx + s.end.ex) / 2 : s.sx;
      const cx = clamp(mid, 1 + pw / 2, g.W - 1 - pw / 2);
      const top = g.H0 + 4;
      const caret = clamp(mid, cx - pw / 2 + 7, cx + pw / 2 - 7);
      return (
        <>
          <Stretch g={g} w={3} />
          <SessionDot g={g} />
          <path d={`M${caret - 2.5} ${top + 0.5} L${caret} ${top - 2.5} L${caret + 2.5} ${top + 0.5} Z`} className="fill-primary" />
          <rect x={cx - pw / 2} y={top} width={pw} height={12} rx={6} className="fill-primary" />
          <text x={cx} y={top + 8.6} textAnchor="middle" fontSize={9} fontWeight={700} className="fill-primary-foreground font-mono">
            {text}
          </text>
        </>
      );
    },
  }),
};

/** 7. Milestones: circle at the start, clover at the end, a bold time and a caption under each, as on the poster. */
const milestones: Def = {
  id: "milestones",
  extra: (d) => (d ? 22 : 12),
  build: (info) => ({
    id: "milestones",
    extra: info.end ? 22 : 12,
    session: (g) => {
      const s = g.session;
      const long = s.end ? s.end.x1 - s.end.x0 >= MIN_FOR_END_MARK : false;
      const tw = info.start.length * 6;
      // one label under each end when they are far apart; side by side
      // under the middle of the span when they are close
      let a = { x: s.sx, anchor: "middle" as "start" | "middle" | "end" };
      let b = { x: s.end?.ex ?? 0, anchor: "middle" as "start" | "middle" | "end" };
      if (s.end && s.end.x1 - s.end.x0 < tw * 2 + 8) {
        const mid = clamp((s.sx + s.end.ex) / 2, tw + 5, g.W - tw - 5);
        a = { x: mid - 3, anchor: "end" };
        b = { x: mid + 3, anchor: "start" };
      } else {
        a = { x: clamp(s.sx, tw / 2 + 1, g.W - tw / 2 - 1), anchor: "middle" };
        b = { x: clamp(s.end?.ex ?? 0, tw / 2 + 1, g.W - tw / 2 - 1), anchor: "middle" };
      }
      return (
        <>
          <Stretch g={g} w={3.5} />
          {s.end && long && <Mark kind="clover" x={s.end.ex} y={s.end.ey} />}
          <Mark kind="circle" x={s.sx} y={s.sy} />
          <text x={a.x} y={g.H0 + 9.5} textAnchor={a.anchor} fontSize={10} fontWeight={700} className="fill-foreground font-mono">
            {info.start}
          </text>
          {s.end && (
            <>
              <text x={a.x} y={g.H0 + 19.5} textAnchor={a.anchor} fontSize={8.5} fontWeight={500} className="fill-muted-foreground">
                {info.startCap}
              </text>
              <text x={b.x} y={g.H0 + 9.5} textAnchor={b.anchor} fontSize={10} fontWeight={700} className="fill-foreground font-mono">
                {info.end}
              </text>
              <text x={b.x} y={g.H0 + 19.5} textAnchor={b.anchor} fontSize={8.5} fontWeight={500} className="fill-muted-foreground">
                {info.endCap}
              </text>
            </>
          )}
        </>
      );
    },
  }),
};

/** 8. Route track below: the span as a thick round-capped blue line on its own row, tied to the curve by hairlines. */
const track: Def = {
  id: "track",
  extra: () => 12,
  build: () => ({
    id: "track",
    extra: 12,
    under: (g) => {
      const s = g.session;
      const ry = g.H0 + 6;
      return (
        <g>
          <line x1={4} x2={g.W - 4} y1={ry} y2={ry} className="stroke-data" strokeWidth={1} opacity={0.14} />
          {s.end && (
            <>
              <line x1={s.sx} x2={s.sx} y1={s.sy} y2={ry} className="stroke-primary" strokeWidth={1} strokeDasharray="1 2.5" strokeLinecap="round" />
              <line x1={s.end.ex} x2={s.end.ex} y1={s.end.ey} y2={ry} className="stroke-primary" strokeWidth={1} strokeDasharray="1 2.5" strokeLinecap="round" />
            </>
          )}
        </g>
      );
    },
    session: (g) => {
      const s = g.session;
      const ry = g.H0 + 6;
      const long = s.end ? s.end.x1 - s.end.x0 >= MIN_FOR_END_MARK : false;
      return (
        <>
          {s.path && <path d={s.path} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" mask={g.spanMask} />}
          <SessionDot g={g} />
          {s.end && (
            <>
              <line x1={s.sx} x2={s.end.ex} y1={ry} y2={ry} className="stroke-primary" strokeWidth={4.5} strokeLinecap="round" />
              {long && <Mark kind="square" x={s.end.ex} y={ry} />}
            </>
          )}
          <Mark kind="circle" x={s.sx} y={ry} />
        </>
      );
    },
  }),
};

// ---------------------------------------------------------------------------
// Waves: the span drawn as a solid blue squiggle along the curve.

type Profile = "sine" | "scallop";

/**
 * A wavy line along the curve for the session's length: sample the curve from
 * start to end, then push each point sideways (along the curve's normal) by a
 * wave of the given wavelength and amplitude measured in pixels along the
 * curve. The wavelength is nudged so a whole number of waves fits, so the
 * squiggle starts and ends exactly on the curve (the stroke's round caps are its ends). A
 * "scallop" is a rectified sine: round humps on the upper side only, like the
 * ocean-wave icon. Returns null for a span too short (under `minLen` px) to
 * hold a wave: callers draw a straight stub then.
 */
function wavePath(g: Geo, lambda: number, amp: number, profile: Profile, minLen = 9): string | null {
  const e = g.session.end;
  if (!e) return null;
  const len = e.x1 - e.x0;
  const t0 = g.session.ts;
  const t1 = e.te;
  const n = Math.max(24, Math.ceil(len / 0.5));
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k <= n; k++) {
    const time = t0 + ((t1 - t0) * k) / n;
    pts.push({ x: g.x(time), y: g.y(g.heightAt(time)) });
  }
  const cum = [0];
  for (let k = 1; k <= n; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  const total = cum[n];
  if (total < minLen) return null;
  const waves = Math.max(1, Math.round(total / lambda));
  const lam = total / waves;
  const out: string[] = [];
  for (let k = 0; k <= n; k++) {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(n, k + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    // normal pointing up the screen
    let nx = ty;
    let ny = -tx;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const phase = (2 * Math.PI * cum[k]) / lam;
    const off = profile === "sine" ? amp * Math.sin(phase) : amp * Math.abs(Math.sin(phase / 2));
    out.push(`${k ? "L" : "M"}${(pts[k].x + nx * off).toFixed(1)} ${(pts[k].y + ny * off).toFixed(1)}`);
  }
  return out.join(" ");
}

/** The curve with the span's stretch cut out, dimmed like the spotlight; used where the wave replaces the curve. */
function cutCurve(g: Geo, line: string): React.ReactNode {
  const e = g.session.end;
  if (!e)
    return <path d={line} fill="none" className="stroke-data" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" mask={g.curveMask} />;
  const id = `${g.uid}-cut`;
  return (
    <>
      <defs>
        <clipPath id={id}>
          <rect x={0} y={0} width={Math.max(0, e.x0)} height={g.H} />
          <rect x={e.x1} y={0} width={Math.max(0, g.W - e.x1)} height={g.H} />
        </clipPath>
      </defs>
      <path d={line} fill="none" className="stroke-data" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} clipPath={`url(#${id})`} mask={g.curveMask} />
    </>
  );
}

/** A short straight stub for a span too short to hold a wave. */
function stub(g: Geo, w: number) {
  return g.session.path ? <Stretch g={g} w={w} /> : null;
}

/** 7. Ripple on the curve: a fine solid blue ripple riding along the grey curve; its ends are the stroke caps. */
const ripple: Def = {
  id: "ripple",
  extra: () => 0,
  build: () => ({
    id: "ripple",
    session: (g) => {
      const d = wavePath(g, 6, 1.8, "sine");
      return (
        <>
          {d ? <path d={d} fill="none" className="stroke-primary" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" mask={g.spanMask} /> : stub(g, 3)}
          <SessionDot g={g} />
        </>
      );
    },
  }),
};

/** 8. Rolling waves: fewer, bigger rounded waves that replace the curve for the span. */
const rolling: Def = {
  id: "rolling",
  extra: () => 0,
  build: () => ({
    id: "rolling",
    curve: cutCurve,
    session: (g) => {
      const d = wavePath(g, 15, 3.2, "sine");
      return (
        <>
          {d ? <path d={d} fill="none" className="stroke-primary" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" mask={g.spanMask} /> : stub(g, 3)}
          <SessionDot g={g} />
        </>
      );
    },
  }),
};

/** 9. Scallops: round humps on the upper side of the curve, the ocean-wave icon; the grey curve stays beneath. */
const scallops: Def = {
  id: "scallops",
  extra: () => 0,
  build: () => ({
    id: "scallops",
    session: (g) => {
      const d = wavePath(g, 9, 3.4, "scallop");
      return (
        <>
          {d ? <path d={d} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" mask={g.spanMask} /> : stub(g, 3)}
          <SessionDot g={g} />
        </>
      );
    },
  }),
};

/** 10. Wave route: a medium wave replaces the curve, with the poster's solid circle start and clover end. */
const waveRoute: Def = {
  id: "waveRoute",
  extra: () => 0,
  build: () => ({
    id: "waveRoute",
    curve: cutCurve,
    session: (g) => {
      const s = g.session;
      const d = wavePath(g, 10, 2.4, "sine");
      const long = s.end ? s.end.x1 - s.end.x0 >= MIN_FOR_END_MARK : false;
      return (
        <>
          {d ? <path d={d} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" mask={g.spanMask} /> : stub(g, 3.5)}
          {s.end && long && <Mark kind="clover" x={s.end.ex} y={s.end.ey} />}
          <Mark kind="circle" x={s.sx} y={s.sy} />
        </>
      );
    },
  }),
};

// ---------------------------------------------------------------------------
// Iterations of the time label set into the curve. The span is the real one.

const emb = (id: string, labels: (info: Info) => NonNullable<Variant["labels"]>): Def => ({
  id,
  extra: () => 0,
  build: (info) => ({ id, labels: labels(info) }),
});

/** a. The real chart's label: time only, 8.5 px, 3 px clear either side, the two turning points around the session. */
const embBase = emb("embBase", () => ({}));
/** b. A tiny letter before the time: H / L (en), 滿 / 乾 (zh-TW). */
const embLetter = emb("embLetter", (i) => ({ letters: i.letters }));
/** c. 10 px, semibold: easier to read, a longer gap. */
const embBig = emb("embBig", () => ({ size: 10, weight: 600 }));
/** d. Every turning point of the visible day, not only the two around the session. */
const embAll = emb("embAll", () => ({ all: true }));
/** e. A wider gap (6 px clear each side): the curve stops further from the text. */
const embWide = emb("embWide", () => ({ pad: 6 }));

export const LABEL_DEFS: Def[] = [embBase, embLetter, embBig, embAll, embWide];

export const DEFS: Def[] = [now, route, label, pill, milestones, track, ripple, rolling, scallops, waveRoute];
