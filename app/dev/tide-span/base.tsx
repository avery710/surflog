"use client";

import { useEffect, useRef, useState, useId } from "react";

import {
  CURVE_W,
  DEFAULT_LABELS,
  DOT_R,
  MIN_SPAN_PX,
  curveRuns,
  labelsOnCurve,
  placeTideLabels,
  r2,
  runPath,
  spanParts,
  type LabelOpts,
  type PlacedLabel,
} from "@/components/tide-labels";
import { useLang } from "@/lib/i18n";
import type { TideEvent } from "@/lib/types";

/**
 * Dev-only copy of components/tide-chart.tsx (TideChart) with hooks for a
 * span-marking variant. Everything that draws the original (TOP / BOTTOM / H /
 * PAD_X, the day window, x() / y(), the half-cosine legs and STEPS_PER_LEG,
 * the turning-point dots (the time labels were removed 2026-10-22), the session dot and the thick duration
 * stretch, the 2026-10-21 spotlight dimming, the 2026-10-22 blue session
 * without its halo, the ResizeObserver width) is copied verbatim so the "no marking" variant renders
 * the same SVG as the real chart. The real file is not touched: keep this in
 * step by hand if it changes.
 *
 * What a variant adds is only drawn through `Variant`: layers before the curve
 * (`under`), a replacement for the curve (`curve`), and layers after the dots
 * and labels but before the session stretch (`over`). `extra` grows the svg
 * below the original 40 px for variants that need an axis row. `session`
 * (used by /dev/tide-blue) replaces how the session's own stretch and dots are
 * drawn, and `dim` the opacity of the rest of the curve while a duration is set.
 */
export const TOP = 6;
export const BOTTOM = 6;
export const H0 = 40;
export const PAD_X = 4;
const DAY_MS = 24 * 3600 * 1000;
const STEPS_PER_LEG = 16;

const ms = (local: string) => new Date(`${local.slice(0, 16)}:00Z`).getTime();

export interface LegGeo {
  kind: "rising" | "falling";
  /** The turning points either side of the session (real, may lie off-screen). */
  from: TideEvent;
  to: TideEvent;
  /** The leg's length, from turning point to turning point, in minutes. */
  lengthMin: number;
  /** Pixel ends of the leg, clipped to the visible day. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The turning point lies outside the visible day (e.g. a high tomorrow). */
  startClipped: boolean;
  endClipped: boolean;
  /** Path of the curve along the leg only (same sampling as the full curve). */
  path: string;
  /** Point on the leg at a fraction 0..1 of the *visible* part of it. */
  at: (f: number) => { x: number; y: number; angle: number };
}

export interface Geo {
  W: number;
  /** Total svg height: the original 40 plus the variant's `extra`. */
  H: number;
  /** The original chart's height (40): everything the original draws sits inside it. */
  H0: number;
  top: number;
  /** y of the lowest level (the curve's floor). */
  floor: number;
  /** Unique id prefix for gradients / patterns. */
  uid: string;
  x: (time: number) => number;
  y: (level: number) => number;
  heightAt: (time: number) => number;
  tMin: number;
  tMax: number;
  leg: LegGeo | null;
  /** Labels set into the curve (see components/tide-labels.ts). */
  labels: PlacedLabel[];
  /** `mask` values: a gap in the curve per label, and in the blue span per label inside it. */
  curveMask: string;
  spanMask: string;
  session: {
    sx: number;
    sy: number;
    ts: number;
    /** Path of the session's stretch (start to end), null without a duration. */
    path: string | null;
    end: { ex: number; ey: number; te: number; x0: number; x1: number } | null;
  };
}

export interface Variant {
  id: string;
  /** Extra svg height below the original chart's 40 px. */
  extra?: number;
  under?: (g: Geo) => React.ReactNode;
  curve?: (g: Geo, line: string) => React.ReactNode;
  over?: (g: Geo) => React.ReactNode;
  /** Replaces the session's own stretch + dots (default: the real chart's blue ones). */
  session?: (g: Geo) => React.ReactNode;
  /** Overrides of the embedded time labels (size, gap, letter, every turning point). */
  labels?: Partial<LabelOpts>;
  /** Opacity of the rest of the curve while the session has a duration (real chart: 1, no dimming since 2026-10-23). */
  dim?: number;
}

export function SpanChart({
  events,
  sessionWhen,
  sessionEnd,
  variant,
}: {
  events: TideEvent[];
  sessionWhen: string;
  sessionEnd?: string | null;
  variant?: Variant;
}) {
  const { t } = useLang();
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(140);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = H0 + (variant?.extra ?? 0);
  const evs = [...events].sort((a, b) => ms(a.time) - ms(b.time));
  const drawable = evs.length >= 2 && ms(evs[evs.length - 1].time) > ms(evs[0].time);

  let svg: React.ReactNode = null;
  if (drawable) {
    const times = evs.map((e) => ms(e.time));
    const sessionMs = ms(sessionWhen);
    const nextIdx = times.findIndex((tt) => tt > sessionMs);

    const dayStart = ms(`${sessionWhen.slice(0, 10)}T00:00`);
    let tMin = Math.max(times[0], dayStart);
    let tMax = Math.min(times[times.length - 1], dayStart + DAY_MS);
    if (tMax <= tMin) {
      tMin = times[0];
      tMax = times[times.length - 1];
    }

    const haveHeights = evs.every((e) => e.heightM != null);
    const levels = evs.map((e) => (haveHeights ? (e.heightM as number) : e.type === "low" ? 0 : 1));
    const lo = Math.min(...levels);
    const span = Math.max(...levels) - lo || 1;

    const x = (time: number) => PAD_X + ((time - tMin) / (tMax - tMin)) * (W - 2 * PAD_X);
    const y = (h: number) => H0 - BOTTOM - ((h - lo) / span) * (H0 - TOP - BOTTOM);
    const heightAt = (time: number) => {
      let i = times.findIndex((tt) => tt >= time);
      if (i <= 0) i = 1;
      const f = Math.min(1, Math.max(0, (time - times[i - 1]) / (times[i] - times[i - 1])));
      return levels[i - 1] + ((levels[i] - levels[i - 1]) * (1 - Math.cos(Math.PI * f))) / 2;
    };

    const pts: string[] = [];
    for (let i = 1; i < evs.length; i++) {
      for (let s = i === 1 ? 0 : 1; s <= STEPS_PER_LEG; s++) {
        const time = times[i - 1] + ((times[i] - times[i - 1]) * s) / STEPS_PER_LEG;
        pts.push(`${pts.length ? "L" : "M"}${x(time).toFixed(1)} ${y(heightAt(time)).toFixed(1)}`);
      }
    }
    const line = pts.join(" ");

    const tsReal = Math.min(tMax, Math.max(tMin, sessionMs));

    // The span: the line's own round caps are its ends (no dots, 2026-10-22).
    // Shorter than MIN_SPAN_PX on screen it is drawn MIN_SPAN_PX long, centred
    // on the real span (same as components/tide-chart.tsx). `ts` / `sx` / `sy`
    // and `end` are the DRAWN start and end; `tsReal` / `teReal` the true ones.
    let spanLine: string | null = null;
    let ts = tsReal;
    let ex = 0;
    let ey = 0;
    let teOut = 0;
    let teReal = 0;
    let spanX0 = 0;
    if (sessionEnd) {
      teReal = Math.min(tMax, Math.max(tsReal, ms(sessionEnd)));
      if (teReal > tsReal) {
        let a = tsReal;
        let b = teReal;
        if (x(teReal) - x(tsReal) < MIN_SPAN_PX) {
          const mid = (tsReal + teReal) / 2;
          const half = (MIN_SPAN_PX / 2 / (W - 2 * PAD_X)) * (tMax - tMin);
          a = Math.max(tMin, Math.min(mid - half, tMax - 2 * half));
          b = Math.min(tMax, a + 2 * half);
        }
        // the whole stretch as one path, for variants that draw it themselves
        const n = Math.max(4, Math.ceil(((b - a) / (tMax - tMin)) * 48));
        const seg: string[] = [];
        for (let k = 0; k <= n; k++) {
          const time = a + ((b - a) * k) / n;
          seg.push(`${k ? "L" : "M"}${x(time).toFixed(1)} ${y(heightAt(time)).toFixed(1)}`);
        }
        spanLine = seg.join(" ");
        ts = a;
        spanX0 = x(a);
        ex = x(b);
        ey = y(heightAt(b));
        teOut = b;
      }
    }
    const sx = x(ts);
    const sy = y(heightAt(ts));

    const labelOpts: LabelOpts = { ...DEFAULT_LABELS, ...variant?.labels };
    const sessionDay = sessionWhen.slice(0, 10);
    const fmt = (e: TideEvent) => {
      const day = e.time.slice(0, 10);
      const shift = day === sessionDay ? "" : ` ${day > sessionDay ? t("tide.nextDay") : t("tide.prevDay")}`;
      return `${e.time.slice(11, 16)}${shift}`;
    };
    const yAtX = (px: number) => y(heightAt(tMin + ((px - PAD_X) / (W - 2 * PAD_X)) * (tMax - tMin)));
    const labels = placeTideLabels({
      events: evs,
      times,
      nextIdx,
      tMin,
      tMax,
      W,
      ts: tsReal,
      te: spanLine ? teReal : null,
      sx,
      ex: spanLine ? ex : null,
      markerR: spanLine ? 3 : DOT_R + 1.3,
      x,
      curveYAtX: yAtX,
      fmt,
      opts: labelOpts,
    });
    // labels bend with the curve, as in the real chart (2026-10-23): same
    // helpers (components/tide-labels.ts), same flattening, spacing and runs
    const along = labelsOnCurve(labels, { W, yAtX, opts: labelOpts }).map((p, i) => ({ ...p, id: `${uid}-l${i}` }));
    // masks stay for the variants that draw their own curve / span
    const gaps = (list: typeof along) =>
      list.map((p) => <rect key={p.key} x={p.g0} y={0} width={p.g1 - p.g0} height={H} fill="black" />);
    const curveMask = `${uid}-cm`;
    const spanMask = `${uid}-sm`;
    const capR = CURVE_W / 2;
    // grey curve stops at the blue span (see components/tide-chart.tsx)
    const curveD = (spanLine
      ? [...curveRuns(PAD_X, spanX0, along, capR, yAtX, W), ...curveRuns(ex, W - PAD_X, along, capR, yAtX, W)]
      : curveRuns(PAD_X, W - PAD_X, along, capR, yAtX, W)
    ).map(([a, b]) => runPath(a, b, yAtX));
    const spanBits = spanLine ? spanParts(spanX0, ex, along.filter((p) => p.inSpan), capR, yAtX, W) : null;

    // ---- the leg the session sat in (what the variants mark) ----
    let leg: LegGeo | null = null;
    const prevIdx = nextIdx === -1 ? -1 : nextIdx - 1;
    if (nextIdx > 0 && prevIdx >= 0) {
      const a = times[prevIdx];
      const b = times[nextIdx];
      const ca = Math.max(a, tMin);
      const cb = Math.min(b, tMax);
      if (cb > ca) {
        const samples: number[] = [ca];
        for (let s = 0; s <= STEPS_PER_LEG; s++) {
          const time = a + ((b - a) * s) / STEPS_PER_LEG;
          if (time > ca && time < cb) samples.push(time);
        }
        samples.push(cb);
        const path = samples
          .map((time, k) => `${k ? "L" : "M"}${x(time).toFixed(1)} ${y(heightAt(time)).toFixed(1)}`)
          .join(" ");
        const at = (f: number) => {
          const time = ca + (cb - ca) * f;
          const d = (cb - ca) * 0.01;
          const t1 = Math.min(cb, time + d);
          const t0 = Math.max(ca, time - d);
          const angle = Math.atan2(y(heightAt(t1)) - y(heightAt(t0)), x(t1) - x(t0));
          return { x: x(time), y: y(heightAt(time)), angle };
        };
        leg = {
          kind: evs[nextIdx].type === "high" ? "rising" : "falling",
          from: evs[prevIdx],
          to: evs[nextIdx],
          lengthMin: Math.round((b - a) / 60000),
          x0: x(ca),
          y0: y(heightAt(ca)),
          x1: x(cb),
          y1: y(heightAt(cb)),
          startClipped: a < tMin,
          endClipped: b > tMax,
          path,
          at,
        };
      }
    }

    const geo: Geo = {
      W,
      H,
      H0,
      top: TOP,
      floor: H0 - BOTTOM,
      uid,
      x,
      y,
      heightAt,
      tMin,
      tMax,
      leg,
      labels,
      curveMask: `url(#${curveMask})`,
      spanMask: `url(#${spanMask})`,
      session: {
        sx,
        sy,
        ts,
        path: spanLine,
        end: spanLine ? { ex, ey, te: teOut, x0: sx, x1: ex } : null,
      },
    };

    svg = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={t("tide.chartLabel")}>
        <defs>
          <mask id={curveMask} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect x={0} y={0} width={W} height={H} fill="white" />
            {gaps(along)}
          </mask>
          <mask id={spanMask} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect x={0} y={0} width={W} height={H} fill="white" />
            {gaps(along.filter((p) => p.inSpan))}
          </mask>
          {along.map((p) => (
            <path key={p.id} id={p.id} d={p.d} />
          ))}
        </defs>
        {variant?.under?.(geo)}
        {variant?.curve
          ? variant.curve(geo, line)
          : curveD.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                className="[stroke:var(--tide-curve)]"
                strokeWidth={CURVE_W}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={spanLine && variant?.dim != null ? variant.dim : undefined}
              />
            ))}
        {along.map((p) => (
          <text
            key={p.key}
            textAnchor="middle"
            fontSize={labelOpts.size}
            fontWeight={labelOpts.weight}
            letterSpacing={labelOpts.spacing}
            className={(p.inSpan ? "fill-primary" : "fill-muted-foreground") + " font-sans tabular-nums"}
          >
            <textPath href={`#${p.id}`} startOffset={p.lead}>
              {p.text}
            </textPath>
          </text>
        ))}
        {variant?.over?.(geo)}
        {variant?.session ? (
          variant.session(geo)
        ) : spanBits ? (
          <>
            {spanBits.paths.map((d, i) => (
              <path key={i} d={d} fill="none" className="stroke-primary" strokeWidth={CURVE_W} strokeLinecap="butt" strokeLinejoin="round" />
            ))}
            {spanBits.dots.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={capR} className="fill-primary" />
            ))}
          </>
        ) : (
          <circle cx={r2(sx)} cy={r2(sy)} r={DOT_R} className="fill-primary" />
        )}
      </svg>
    );
  }

  return (
    <div ref={wrapRef} className="mt-0.5 w-full overflow-hidden">
      {svg}
    </div>
  );
}
