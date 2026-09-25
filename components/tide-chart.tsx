"use client";

import { useEffect, useRef, useState } from "react";

import { fmt1 } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { TideEvent } from "@/lib/types";

const H = 106;
const PAD_X = 6;
const TOP = 41; // pill (0–15) + a high's two-line label above its point
const BOTTOM = 35; // a low's two-line label below its point
const STEPS_PER_LEG = 20;

// "YYYY-MM-DDTHH:mm" is Asia/Taipei local with no tz; parsing every value as
// UTC keeps the arithmetic consistent without depending on the viewer's zone.
const ms = (local: string) => new Date(`${local.slice(0, 16)}:00Z`).getTime();

/**
 * A schematic tide wave through the stored highs and lows around a session.
 * The low and high either side of the session are labelled on the curve with
 * time and height (highs above, lows below), and a dashed marker, pill and
 * dot show the session time. The rest of the wave is just the line. Only turning points are known, so each leg between two of
 * them is a half-cosine — it shows where in the cycle the session sat, not a
 * measured height at each moment. Sized in real pixels (measured), so text
 * and dots stay the same size at any tile width. Needs at least two events;
 * renders nothing for a single-event legacy row (the caller shows text then).
 */
export function TideChart({ events, sessionWhen }: { events: TideEvent[]; sessionWhen: string }) {
  const { t } = useLang();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(280);

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
    const tMin = times[0];
    const tMax = times[times.length - 1];

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

    const pts: string[] = [];
    for (let i = 1; i < evs.length; i++) {
      for (let s = i === 1 ? 0 : 1; s <= STEPS_PER_LEG; s++) {
        const time = times[i - 1] + ((times[i] - times[i - 1]) * s) / STEPS_PER_LEG;
        pts.push(`${pts.length ? "L" : "M"}${x(time).toFixed(1)} ${y(heightAt(time)).toFixed(1)}`);
      }
    }
    const line = pts.join(" ");

    const ts = Math.min(tMax, Math.max(tMin, ms(sessionWhen)));
    const sx = x(ts);
    const sy = y(heightAt(ts));
    const pillW = 38;
    const pillX = Math.min(W - pillW / 2 - 1, Math.max(pillW / 2 + 1, sx));

    // Keep it light: only the low and high either side of the session get a
    // dot and a label; the rest of the wave is just the line.
    const sessionMs = ms(sessionWhen);
    const nextIdx = times.findIndex((tt) => tt > sessionMs);
    const labelled = new Set<number>(
      nextIdx === -1 ? [evs.length - 1] : [nextIdx, ...(nextIdx > 0 ? [nextIdx - 1] : [])]
    );

    const sessionDay = sessionWhen.slice(0, 10);
    // time on the first line, height under it
    const labelLines = (e: TideEvent): [string, string | null] => {
      const day = e.time.slice(0, 10);
      const shift = day === sessionDay ? "" : ` ${day > sessionDay ? t("tide.nextDay") : t("tide.prevDay")}`;
      const h = fmt1(e.heightM);
      return [`${e.time.slice(11, 16)}${shift}`, h != null ? `${h}m` : null];
    };

    svg = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={t("tide.chartLabel")}>
        <path d={line} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={sx} x2={sx} y1={15} y2={H - BOTTOM + 8} className="stroke-primary" strokeWidth={1} strokeDasharray="3 3" />
        {evs.map((e, i) => {
          const px = x(times[i]);
          const py = y(levels[i]);
          const anchor = px < 34 ? "start" : px > W - 34 ? "end" : "middle";
          const tx = anchor === "start" ? Math.max(px - 2, 1) : anchor === "end" ? Math.min(px + 2, W - 1) : px;
          return (
            <g key={`${e.type}-${e.time}`}>
              {labelled.has(i) && (
                <circle cx={px} cy={py} r={2.5} className="fill-card stroke-primary" strokeWidth={1.25} />
              )}
              {labelled.has(i) && (
                <text
                  x={tx}
                  y={e.type === "high" ? py - (labelLines(e)[1] ? 18 : 7) : py + 14}
                  textAnchor={anchor}
                  fontSize={10}
                  fontWeight={500}
                  className="fill-muted-foreground stroke-card"
                  stroke="currentColor"
                  strokeWidth={3}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  <tspan x={tx}>{labelLines(e)[0]}</tspan>
                  {labelLines(e)[1] && (
                    <tspan x={tx} dy={11}>
                      {labelLines(e)[1]}
                    </tspan>
                  )}
                </text>
              )}
            </g>
          );
        })}
        <rect x={pillX - pillW / 2} y={1} width={pillW} height={14} rx={7} className="fill-primary" />
        <text
          x={pillX}
          y={11.2}
          textAnchor="middle"
          className="fill-primary-foreground"
          fontSize={9.5}
          fontWeight={600}
          fontFamily="ui-monospace, monospace"
        >
          {sessionWhen.slice(11, 16)}
        </text>
        <circle cx={sx} cy={sy} r={4.5} className="fill-primary stroke-card" strokeWidth={2} />
      </svg>
    );
  }

  return (
    <div ref={wrapRef} className="mt-1 w-full overflow-hidden">
      {svg}
    </div>
  );
}
