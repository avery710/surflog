"use client";

import { useEffect, useId, useRef, useState } from "react";

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
} from "@/components/tide-labels";
import { useLang } from "@/lib/i18n";
import type { TideEvent } from "@/lib/types";

// Shrunk 2026-10-01 so the Tide tile fits in the same single flex row as
// every other condition tile (see CLAUDE.md "As of 2026-10-01") instead of
// needing its own taller two-row span. No pill (the session's own time
// already shows in the card header). 2026-10-22, on request: the turning
// points' time labels no longer sit above a high / below a low (which needed
// a 13 px margin each); each is set INTO the curve, in a gap cut in it, in
// the curve's own colour (components/tide-labels.ts), and bends with it
// (2026-10-23: drawn on a <textPath> along the curve). H stays 40 so the tile
// does not change height; TOP/BOTTOM only keep a turning point's text (about
// 6 px tall) and the curve's stroke from touching the svg edge.
// 2026-10-23, on request: the curve is a light grey (--tide-curve) at CURVE_W
// 2.25 px, every end of it, including both sides of each label gap, is a round
// cap (the curve is drawn as separate runs between the gaps, not masked), and
// the label text runs on a flattened copy of the curve with a little letter
// spacing so the glyphs of a low do not squeeze.
const TOP = 6;
const BOTTOM = 6;
const H = 40;
const PAD_X = 4;
const DAY_MS = 24 * 3600 * 1000;

// "YYYY-MM-DDTHH:mm" is Asia/Taipei local with no tz; parsing every value as
// UTC keeps the arithmetic consistent without depending on the viewer's zone.
const ms = (local: string) => new Date(`${local.slice(0, 16)}:00Z`).getTime();

/**
 * A small schematic tide wave through the stored highs and lows around a
 * session. The low and high either side of the session are labelled with
 * just their time, set into a gap in the curve (2026-10-22; no dot, no text
 * above or below), and the session's own position is a blue dot on the curve
 * (no vertical marker line — removed 2026-10-01 on request); with a duration
 * the dot gives way to the solid blue stretch, no end dots; only
 * turning points are known, so each leg between two of them is a
 * half-cosine — it shows where in the cycle the session sat, not a measured
 * height at each moment. Sized in real pixels (measured), so text and dots
 * stay the same size at any tile width. Needs at least two events; renders
 * nothing for a single-event legacy row (the caller shows text then).
 */
export function TideChart({
  events,
  sessionWhen,
  sessionEnd,
}: {
  events: TideEvent[];
  sessionWhen: string;
  /** When the session ended, if it has a duration: that stretch of the curve is drawn in blue. */
  sessionEnd?: string | null;
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

  const evs = [...events].sort((a, b) => ms(a.time) - ms(b.time));
  const drawable = evs.length >= 2 && ms(evs[evs.length - 1].time) > ms(evs[0].time);

  let svg: React.ReactNode = null;
  if (drawable) {
    const times = evs.map((e) => ms(e.time));
    const sessionMs = ms(sessionWhen);
    const nextIdx = times.findIndex((tt) => tt > sessionMs);

    // Visible window: the session's whole day (00:00–24:00), cut to where
    // the stored events reach — the curve can't be drawn past the first or
    // last turning point, and events only span ±14 h of the session. Falls
    // back to the whole range if the day and the events don't overlap.
    const dayStart = ms(`${sessionWhen.slice(0, 10)}T00:00`);
    let tMin = Math.max(times[0], dayStart);
    let tMax = Math.min(times[times.length - 1], dayStart + DAY_MS);
    if (tMax <= tMin) {
      tMin = times[0];
      tMax = times[times.length - 1];
    }

    // Real heights where every event has one; otherwise lows at the bottom
    // and highs at the top. Normalised to the events either way.
    const haveHeights = evs.every((e) => e.heightM != null);
    const levels = evs.map((e) => (haveHeights ? (e.heightM as number) : e.type === "low" ? 0 : 1));
    const lo = Math.min(...levels);
    const span = Math.max(...levels) - lo || 1;

    const x = (time: number) => PAD_X + ((time - tMin) / (tMax - tMin)) * (W - 2 * PAD_X);
    const y = (h: number) => H - BOTTOM - ((h - lo) / span) * (H - TOP - BOTTOM);
    const heightAt = (time: number) => {
      let i = times.findIndex((tt) => tt >= time);
      if (i <= 0) i = 1;
      const f = Math.min(1, Math.max(0, (time - times[i - 1]) / (times[i] - times[i - 1])));
      return levels[i - 1] + (levels[i] - levels[i - 1]) * (1 - Math.cos(Math.PI * f)) / 2;
    };

    const ts = Math.min(tMax, Math.max(tMin, sessionMs));
    const sx = x(ts);
    const sy = y(heightAt(ts));

    // The stretch of the curve the session covered. Its ends are just the
    // flat ends (2026-10-23: no round caps on the span itself, it is the curve
    // turned blue). A span shorter than
    // MIN_SPAN_PX on screen (a 30 min session at 140 px is about 3 px) is drawn
    // MIN_SPAN_PX long, centred on the real span, so it still reads as a short
    // line rather than a dot; the real times are still what labels are placed by.
    let hasSpan = false;
    let drawX0 = sx;
    let drawX1 = sx;
    let te = 0;
    if (sessionEnd) {
      te = Math.min(tMax, Math.max(ts, ms(sessionEnd)));
      if (te > ts) {
        let a = ts;
        let b = te;
        if (x(te) - x(ts) < MIN_SPAN_PX) {
          const mid = (ts + te) / 2;
          const half = ((MIN_SPAN_PX / 2) / (W - 2 * PAD_X)) * (tMax - tMin);
          a = Math.max(tMin, Math.min(mid - half, tMax - 2 * half));
          b = Math.min(tMax, a + 2 * half);
        }
        hasSpan = true;
        drawX0 = x(a);
        drawX1 = x(b);
      }
    }

    // Keep it light: only the low and high either side of the session are
    // labelled; the rest of the wave is just the line. A label is dropped when
    // it cannot fit (see placeTideLabels).
    const sessionDay = sessionWhen.slice(0, 10);
    // Time only, with +1d/-1d day-shift.
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
      ts,
      te: hasSpan ? te : null,
      sx: drawX0,
      ex: hasSpan ? drawX1 : null,
      markerR: hasSpan ? 3 : DOT_R + 1.3,
      x,
      curveYAtX: yAtX,
      fmt,
      opts: DEFAULT_LABELS,
    });
    const fs = DEFAULT_LABELS.size;
    const along = labelsOnCurve(labels, { W, yAtX, opts: DEFAULT_LABELS }).map((p, i) => ({ ...p, id: `${uid}-l${i}` }));
    // The curve and the blue span are drawn as runs between the label gaps,
    // each with a round cap, so every end is round (a mask would cut them
    // flat). A run stops one cap radius short of the gap edge: the cap's tip
    // then sits exactly where the flat cut used to be.
    const capR = CURVE_W / 2;
    // With a duration the grey curve stops at the blue span (its round cap
    // there is hidden under the blue, which is as thick), so the blue is the
    // curve turned blue, not a line laid over it.
    const curveD = (hasSpan
      ? [...curveRuns(PAD_X, drawX0, along, capR, yAtX, W), ...curveRuns(drawX1, W - PAD_X, along, capR, yAtX, W)]
      : curveRuns(PAD_X, W - PAD_X, along, capR, yAtX, W)
    ).map(([a, b]) => runPath(a, b, yAtX));
    const spanBits = hasSpan ? spanParts(drawX0, drawX1, along.filter((p) => p.inSpan), capR, yAtX, W) : null;

    svg = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={t("tide.chartLabel")}>
        <defs>
          {along.map((p) => (
            <path key={p.id} id={p.id} d={p.d} />
          ))}
        </defs>
        {/* 2026-10-22, on request: the session itself is the app blue
            (--primary), the one blue thing on an otherwise grey reading, so it
            is "you" on the curve. Solid blue line only: no halo, no dots at its
            ends; without a duration the single blue dot (no white ring) is all
            that marks the session. 2026-10-23, on request: the rest of the curve
            stays at full strength (the 2026-10-21 "spotlight" dimming is gone),
            the blue stretch is as thick as the curve with flat (butt) outer ends,
            flush with the grey that stops where it starts, and the curve is a
            light grey (--tide-curve, #b8c2c4, about 1.7:1 on the tile) with round ends. The labels
            use --muted-foreground (#59696c, 5.2:1) so 8.5 px text stays legible. */}
        {curveD.map((d, i) => (
          <path key={i} d={d} fill="none" className="[stroke:var(--tide-curve)]" strokeWidth={CURVE_W} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {along.map((p) => (
          <text
            key={p.key}
            textAnchor="middle"
            fontSize={fs}
            fontWeight={DEFAULT_LABELS.weight}
            letterSpacing={DEFAULT_LABELS.spacing}
            className={(p.inSpan ? "fill-primary" : "fill-muted-foreground") + " font-mono"}
          >
            <textPath href={`#${p.id}`} startOffset={p.lead}>
              {p.text}
            </textPath>
          </text>
        ))}
        {spanBits ? (
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
