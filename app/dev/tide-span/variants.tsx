"use client";

import { fmtDuration } from "@/lib/format";

import type { Geo, LegGeo, Variant } from "./base";

/**
 * Ten ways to mark "the tide leg the session sat in" (previous to next
 * turning point) on the real curve. Every variant keeps the original session
 * stretch (soft halo + thick line + end dot) and the session dot on top: the
 * leg is always the quieter, wider layer, the session the sharper, narrower
 * one. Colours are the existing reading tokens only (--data via fill-data /
 * stroke-data, --secondary for the tile, opacity for tints).
 */

/** Closed area between the leg's curve and the curve's floor. */
function areaPath(g: Geo, leg: LegGeo) {
  return `M${leg.x0.toFixed(1)} ${g.floor} L${leg.path.slice(1)} L${leg.x1.toFixed(1)} ${g.floor} Z`;
}

/** Row of the axis-style variants, below the original 40 px. */
const ROW_EXTRA = 10;
const rowY = (g: Geo) => g.H0 + 5;

/** A small open arrowhead pointing right, "the leg goes on". */
function More({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 3} ${y - 3} L${x} ${y} L${x - 3} ${y + 3}`}
      fill="none"
      className="stroke-data"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export const NONE: Variant = { id: "none" };

/** 1. A translucent vertical band across the full chart height. */
const band: Variant = {
  id: "band",
  under: (g) => {
    const l = g.leg;
    if (!l) return null;
    return (
      <g>
        <rect x={l.x0} y={0} width={Math.max(0, l.x1 - l.x0)} height={g.H} rx={2} className="fill-data" opacity={0.09} />
        {!l.startClipped && <line x1={l.x0} x2={l.x0} y1={0} y2={g.H} className="stroke-data" strokeWidth={1} opacity={0.3} />}
        {!l.endClipped && <line x1={l.x1} x2={l.x1} y1={0} y2={g.H} className="stroke-data" strokeWidth={1} opacity={0.3} />}
      </g>
    );
  },
};

/** 2. A flat tint filling the water under the curve across the leg. */
const area: Variant = {
  id: "area",
  under: (g) => (g.leg ? <path d={areaPath(g, g.leg)} className="fill-data" opacity={0.14} /> : null),
};

/** 3. Hatching: the lines lean "/" while rising and "\" while falling. */
const hatch: Variant = {
  id: "hatch",
  under: (g) => {
    const l = g.leg;
    if (!l) return null;
    const pid = `${g.uid}-hatch`;
    return (
      <g>
        <defs>
          <pattern
            id={pid}
            width={3.5}
            height={3.5}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${l.kind === "rising" ? 45 : -45})`}
          >
            <line x1={0} y1={0} x2={0} y2={3.5} className="stroke-data" strokeWidth={1} opacity={0.6} />
          </pattern>
        </defs>
        <path d={areaPath(g, l)} fill={`url(#${pid})`} />
      </g>
    );
  },
};

/** 4. Spotlight: the rest of the curve is dimmed, the leg stays at full strength and a little heavier. */
const spotlight: Variant = {
  id: "spotlight",
  curve: (g, line) => (
    <>
      <path d={line} fill="none" className="stroke-data" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={g.leg ? 0.28 : 1} />
      {g.leg && (
        <path d={g.leg.path} fill="none" className="stroke-data" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </>
  ),
};

/** 5. A band that fades in toward the leg's end: you read it as "heading toward the dark side". */
const fade: Variant = {
  id: "fade",
  under: (g) => {
    const l = g.leg;
    if (!l) return null;
    const gid = `${g.uid}-fade`;
    return (
      <g>
        <defs>
          <linearGradient id={gid} x1={0} x2={1} y1={0} y2={0}>
            <stop offset="0" style={{ stopColor: "var(--data)", stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: "var(--data)", stopOpacity: 0.2 }} />
          </linearGradient>
        </defs>
        <rect x={l.x0} y={0} width={Math.max(0, l.x1 - l.x0)} height={g.H} fill={`url(#${gid})`} />
        {!l.endClipped && <line x1={l.x1} x2={l.x1} y1={0} y2={g.H} className="stroke-data" strokeWidth={1} opacity={0.35} />}
      </g>
    );
  },
};

/** 6. Dotted drop lines from the two turning points across the rest of the chart height. */
const drop: Variant = {
  id: "drop",
  over: (g) => {
    const l = g.leg;
    if (!l) return null;
    // from a high down to the bottom edge, from a low up to the top edge:
    // never through its own time label
    const line = (x: number, y: number, isHigh: boolean) => (
      <line
        x1={x}
        x2={x}
        y1={isHigh ? y + 3 : y - 3}
        y2={isHigh ? g.H - 1 : 1}
        className="stroke-data"
        strokeWidth={1}
        strokeDasharray="1.5 2.5"
        strokeLinecap="round"
        opacity={0.6}
      />
    );
    return (
      <g>
        {!l.startClipped && line(l.x0, l.y0, l.from.type === "high")}
        {!l.endClipped && line(l.x1, l.y1, l.to.type === "high")}
      </g>
    );
  },
};

/** 7. Little carets standing in the water under the curve: up while it rises, down while it falls. */
const carets: Variant = {
  id: "carets",
  under: (g) => (g.leg ? <path d={areaPath(g, g.leg)} className="fill-data" opacity={0.09} /> : null),
  over: (g) => {
    const l = g.leg;
    if (!l) return null;
    const n = Math.min(5, Math.floor((l.x1 - l.x0) / 18));
    const out: React.ReactNode[] = [];
    for (let k = 0; k < n; k++) {
      const p = l.at((k + 0.5) / n);
      const room = g.floor - p.y;
      if (room < 7) continue;
      const cy = p.y + room / 2;
      const up = l.kind === "rising";
      const d = up
        ? `M${p.x} ${cy - 2.5} L${p.x - 3} ${cy + 2.25} L${p.x + 3} ${cy + 2.25} Z`
        : `M${p.x} ${cy + 2.5} L${p.x - 3} ${cy - 2.25} L${p.x + 3} ${cy - 2.25} Z`;
      out.push(<path key={k} d={d} className="fill-data" opacity={0.75} />);
    }
    return <g>{out}</g>;
  },
};

/** 8. A thick track on its own row under the chart, with end caps; the session is a dot or a darker stretch on it. */
const track: Variant = {
  id: "track",
  extra: ROW_EXTRA,
  over: (g) => {
    const l = g.leg;
    if (!l) return null;
    const ry = rowY(g);
    return (
      <g>
        <line x1={4} x2={g.W - 4} y1={ry} y2={ry} className="stroke-data" strokeWidth={1} opacity={0.15} />
        <line x1={l.x0} x2={l.x1} y1={ry} y2={ry} className="stroke-data" strokeWidth={4} strokeLinecap="butt" opacity={0.3} />
        {!l.startClipped && <line x1={l.x0} x2={l.x0} y1={ry - 4.5} y2={ry + 4.5} className="stroke-data" strokeWidth={1.5} strokeLinecap="round" />}
        {l.endClipped ? <More x={g.W - 4} y={ry} /> : <line x1={l.x1} x2={l.x1} y1={ry - 4.5} y2={ry + 4.5} className="stroke-data" strokeWidth={1.5} strokeLinecap="round" />}
        {g.session.end ? (
          <line x1={g.session.end.x0} x2={g.session.end.x1} y1={ry} y2={ry} className="stroke-data" strokeWidth={4} strokeLinecap="butt" />
        ) : (
          <circle cx={g.session.sx} cy={ry} r={3} className="fill-data stroke-card" strokeWidth={1.5} />
        )}
      </g>
    );
  },
};

/** 9. A thin dimension line on its own row, the leg's length written in a pill in the middle. */
const dimension: Variant = {
  id: "dimension",
  extra: ROW_EXTRA,
  over: (g) => {
    const l = g.leg;
    if (!l) return null;
    const ry = rowY(g);
    const text = fmtDuration(l.lengthMin);
    const pillW = text.length * 5.1 + 8;
    const cx = Math.min(g.W - 1 - pillW / 2, Math.max(1 + pillW / 2, (l.x0 + l.x1) / 2));
    return (
      <g>
        <line x1={l.x0} x2={l.x1} y1={ry} y2={ry} className="stroke-data" strokeWidth={1} opacity={0.7} />
        {!l.startClipped && <line x1={l.x0} x2={l.x0} y1={ry - 3.5} y2={ry + 3.5} className="stroke-data" strokeWidth={1.25} strokeLinecap="round" />}
        {l.endClipped ? <More x={g.W - 4} y={ry} /> : <line x1={l.x1} x2={l.x1} y1={ry - 3.5} y2={ry + 3.5} className="stroke-data" strokeWidth={1.25} strokeLinecap="round" />}
        <rect x={cx - pillW / 2} y={ry - 5.5} width={pillW} height={11} rx={5.5} className="fill-secondary stroke-data" strokeWidth={0.75} />
        <text x={cx} y={ry + 3} textAnchor="middle" fontSize={8.5} fontWeight={500} className="fill-muted-foreground font-mono">
          {text}
        </text>
      </g>
    );
  },
};

/** 10. (earlier idea) The leg solid and a touch heavier, the rest of the curve dashed. */
const dashed: Variant = {
  id: "dashed",
  curve: (g, line) => (
    <>
      <path d={line} fill="none" className="stroke-data" strokeWidth={1.25} strokeDasharray="2 2.5" opacity={g.leg ? 0.7 : 1} />
      {g.leg && (
        <path d={g.leg.path} fill="none" className="stroke-data" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </>
  ),
};

export const VARIANTS: { variant: Variant; isNew: boolean }[] = [
  { variant: band, isNew: true },
  { variant: area, isNew: true },
  { variant: hatch, isNew: true },
  { variant: spotlight, isNew: true },
  { variant: fade, isNew: true },
  { variant: drop, isNew: true },
  { variant: carets, isNew: true },
  { variant: track, isNew: true },
  { variant: dimension, isNew: true },
  { variant: dashed, isNew: false },
];
