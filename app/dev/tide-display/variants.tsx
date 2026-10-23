"use client";

import { useEffect, useRef, useState } from "react";

import { ConditionTile, Figure } from "@/components/condition-tile";
import { fmtDuration } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import { tideTrend } from "@/lib/tide-display";
import { endOfSession } from "@/lib/time-slots";
import type { TideEvent } from "@/lib/types";

/** The turning points either side of the session (last at/before, first after). */
function tideLegEnds(input: TideEvent[], sessionWhen: string): { prev?: TideEvent; next?: TideEvent } {
  const events = [...input].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return {
    prev: events.findLast((e) => e.time <= sessionWhen),
    next: events.find((e) => e.time > sessionWhen),
  };
}

/**
 * Six candidate ways to show the Tide tile's chart area (the `sub` under the
 * "Rising / Falling" headline), dev-only. Each variant is a pure function of
 * the same stored data the real tile reads (events + session time + optional
 * duration); none of them touches components/tide-chart.tsx.
 *
 * Strings: the few new ones live in LOCAL below rather than in lib/i18n.tsx's
 * DICT, because this page must not edit lib/*. If a variant is adopted, move
 * its keys into DICT (en + zh-TW) and delete the local table. Existing DICT
 * keys (tile.tideOpenMeteo, tide.rising/falling/high/low/nextDay/prevDay) are
 * used as they are.
 */

const LOCAL = {
  highShort: { en: "H", "zh-TW": "滿" },
  lowShort: { en: "L", "zh-TW": "乾" },
  toHigh: { en: "{d} to high", "zh-TW": "距滿潮 {d}" },
  toLow: { en: "{d} to low", "zh-TW": "距乾潮 {d}" },
  sinceHigh: { en: "{d} since high", "zh-TW": "滿潮後 {d}" },
  sinceLow: { en: "{d} since low", "zh-TW": "乾潮後 {d}" },
  session: { en: "Session", "zh-TW": "衝浪" },
  stageLow: { en: "Low", "zh-TW": "乾潮" },
  stageMid: { en: "Mid", "zh-TW": "中潮" },
  stageHigh: { en: "High", "zh-TW": "滿潮" },
  stageLabel: { en: "{stage} tide, {trend}", "zh-TW": "{stage}，{trend}" },
  gaugeLabel: { en: "Tide gauge, line marks the session's level", "zh-TW": "潮位尺，橫線為衝浪時的潮位" },
  bandLabel: { en: "Rising and falling stretches of the day, marker for the session", "zh-TW": "當天漲潮與退潮時段，標記為衝浪時間" },
  barsLabel: { en: "Hourly tide level, dark bars are the session", "zh-TW": "每小時潮位，深色為衝浪時段" },
} as const;
type LocalKey = keyof typeof LOCAL;

function useLocal() {
  const { lang } = useLang();
  return (key: LocalKey, vars?: Record<string, string>) => {
    let s: string = LOCAL[key][lang as Lang];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
}

// "YYYY-MM-DDTHH:mm" read as UTC so arithmetic doesn't depend on the viewer's zone.
const ms = (local: string) => new Date(`${local.slice(0, 16)}:00Z`).getTime();
const DAY_MS = 24 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;

export interface TideCase {
  id: string;
  label: string;
  when: string;
  durationMin?: number;
  events: TideEvent[];
}

interface Analysis {
  evs: TideEvent[];
  times: number[];
  sessionMs: number;
  endMs: number | null;
  dayStart: number;
  trend: "rising" | "falling" | null;
  prev?: TideEvent;
  next?: TideEvent;
  /** Level 0..1 across the stored events (real heights if all have one, else lows 0 / highs 1); null outside them or with fewer than two events. */
  norm: (timeMs: number) => number | null;
  normOfEvent: (e: TideEvent) => number;
  sessionDay: string;
}

function analyze(c: TideCase): Analysis {
  const evs = [...c.events].sort((a, b) => ms(a.time) - ms(b.time));
  const times = evs.map((e) => ms(e.time));
  const sessionMs = ms(c.when);
  const end = endOfSession(c.when, c.durationMin);
  const { prev, next } = tideLegEnds(evs, c.when);
  const haveHeights = evs.length > 0 && evs.every((e) => e.heightM != null);
  const levels = evs.map((e) => (haveHeights ? (e.heightM as number) : e.type === "low" ? 0 : 1));
  const lo = levels.length ? Math.min(...levels) : 0;
  const span = (levels.length ? Math.max(...levels) - lo : 0) || 1;
  const drawable = evs.length >= 2;
  const norm = (time: number) => {
    if (!drawable || time < times[0] || time > times[times.length - 1]) return null;
    let i = times.findIndex((tt) => tt >= time);
    if (i <= 0) i = 1;
    const f = Math.min(1, Math.max(0, (time - times[i - 1]) / (times[i] - times[i - 1])));
    const h = levels[i - 1] + ((levels[i] - levels[i - 1]) * (1 - Math.cos(Math.PI * f))) / 2;
    return (h - lo) / span;
  };
  return {
    evs,
    times,
    sessionMs,
    endMs: end ? ms(end) : null,
    dayStart: ms(`${c.when.slice(0, 10)}T00:00`),
    trend: tideTrend(evs, c.when),
    prev,
    next,
    norm,
    normOfEvent: (e) => (levels[evs.indexOf(e)] - lo) / span,
    sessionDay: c.when.slice(0, 10),
  };
}

function useWidth(initial = 120) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setW(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** "15:20", or "03:50 +1d" when the event is on another day than the session. */
function useEventTime() {
  const { t } = useLang();
  return (e: TideEvent, sessionDay: string) => {
    const day = e.time.slice(0, 10);
    const shift = day === sessionDay ? "" : ` ${day > sessionDay ? t("tide.nextDay") : t("tide.prevDay")}`;
    return `${e.time.slice(11, 16)}${shift}`;
  };
}

function useEventName() {
  const { t } = useLang();
  const l = useLocal();
  return (e: TideEvent, short: boolean) =>
    e.type === "low" ? (short ? l("lowShort") : t("tide.low")) : short ? l("highShort") : t("tide.high");
}

const mono = "font-mono text-[11px] leading-4 text-muted-foreground";

/** What every variant shows when there are not two events to build a shape from. */
function Lone({ a }: { a: Analysis }) {
  const time = useEventTime();
  const name = useEventName();
  const e = a.next ?? a.prev;
  if (!e) return null;
  return (
    <span className={`mt-0.5 block ${mono}`}>
      {name(e, true)} {time(e, a.sessionDay)}
    </span>
  );
}

/* ------------------------------------------------------------------ 1 */

/**
 * 1. Water staff. A vertical gauge (like the staff at a harbour): water up to
 * the session's level, a line across at that level, ticks and times at the
 * low and high either side. The day's range, not just the leg, sets the scale.
 */
function Staff({ a }: { a: Analysis }) {
  const { t } = useLang();
  const l = useLocal();
  const time = useEventTime();
  const name = useEventName();
  const [ref, w] = useWidth();
  const H = 60;
  const PAD = 5;
  const lvl = a.norm(a.sessionMs);
  if (lvl == null || !a.prev || !a.next) return <Lone a={a} />;
  const y = (n: number) => H - PAD - n * (H - 2 * PAD);
  const endLvl = a.endMs != null ? a.norm(a.endMs) : null;
  const wide = w >= 170;

  // Labels sit at their own height on the staff, nudged apart where they would touch.
  type Item = { key: string; y: number; text: string; strong?: boolean };
  const items: Item[] = [a.prev, a.next].map((e) => ({
    key: e.time,
    y: y(a.normOfEvent(e)),
    text: `${name(e, !wide)} ${time(e, a.sessionDay)}`,
  }));
  if (w >= 300) {
    items.push({
      key: "s",
      y: y(lvl),
      strong: true,
      text: `${l("session")} ${new Date(a.sessionMs).toISOString().slice(11, 16)}`,
    });
  }
  items.sort((p, q) => p.y - q.y);
  const GAP = 14;
  const top = items.map((it) => it.y - 7);
  for (let i = 1; i < top.length; i++) top[i] = Math.max(top[i], top[i - 1] + GAP);
  for (let i = top.length - 2; i >= 0; i--) top[i] = Math.min(top[i], top[i + 1] - GAP);
  const shift = Math.min(0, H - GAP - top[top.length - 1]);

  return (
    <div ref={ref} className="relative mt-1 w-full" style={{ height: H }}>
      <svg width={22} height={H} className="absolute left-0 top-0" role="img" aria-label={l("gaugeLabel")}>
        <rect x={4} y={PAD - 2} width={10} height={H - 2 * PAD + 4} rx={2} className="fill-card" />
        <rect x={4} y={y(lvl)} width={10} height={H - PAD + 2 - y(lvl)} rx={2} className="fill-data" opacity={0.22} />
        {endLvl != null && (
          <rect x={4} y={Math.min(y(lvl), y(endLvl))} width={10} height={Math.max(2, Math.abs(y(lvl) - y(endLvl)))} className="fill-data" opacity={0.7} />
        )}
        {[a.prev, a.next].map((e) => (
          <line key={e.time} x1={14} x2={19} y1={y(a.normOfEvent(e))} y2={y(a.normOfEvent(e))} className="stroke-muted-foreground" strokeWidth={1} />
        ))}
        <line x1={1} x2={17} y1={y(lvl)} y2={y(lvl)} className="stroke-data" strokeWidth={2} strokeLinecap="round" />
      </svg>
      {items.map((it, i) => (
        <span
          key={it.key}
          className={`absolute left-6 whitespace-nowrap ${mono} ${it.strong ? "font-semibold text-foreground" : ""}`}
          style={{ top: top[i] + shift }}
        >
          {it.text}
        </span>
      ))}
      <span className="sr-only">
        {[a.prev, a.next].map((e) => `${t(e.type === "low" ? "tide.low" : "tide.high")} ${time(e, a.sessionDay)}`).join(", ")}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 */

/**
 * 2. Day band. The session's whole day as one strip: darker where the tide was
 * coming in, lighter where it was going out, the turning points lettered
 * above it, the session a marker (a box when it has a duration). No curve.
 */
function DayBand({ a }: { a: Analysis }) {
  const { t } = useLang();
  const l = useLocal();
  const time = useEventTime();
  const name = useEventName();
  const [ref, w] = useWidth();
  if (a.evs.length === 0) return null;
  const wide = w >= 300;
  const x = (tm: number) => ((tm - a.dayStart) / DAY_MS) * w;
  const clampX = (v: number, half: number) => Math.max(half, Math.min(w - half, v));

  const segs: { x0: number; x1: number; up: boolean }[] = [];
  for (let i = 1; i < a.evs.length; i++) {
    const x0 = Math.max(0, x(a.times[i - 1]));
    const x1 = Math.min(w, x(a.times[i]));
    if (x1 > x0) segs.push({ x0, x1, up: a.evs[i].type === "high" });
  }

  // lettered turning points, skipping any whose label would overlap the previous one
  let lastRight = -Infinity;
  const marks: { e: TideEvent; cx: number; text: string }[] = [];
  for (const e of a.evs) {
    const tm = ms(e.time);
    if (tm < a.dayStart || tm > a.dayStart + DAY_MS) continue;
    const text = wide ? `${name(e, true)} ${time(e, a.sessionDay)}` : name(e, true);
    const half = (text.length * 5.6) / 2;
    const cx = clampX(x(tm), half);
    if (cx - half < lastRight + 4) continue;
    lastRight = cx + half;
    marks.push({ e, cx, text });
  }

  const sx = x(a.sessionMs);
  const ex = a.endMs != null ? x(a.endMs) : null;
  const hours = [0, 6, 12, 18, 24];
  return (
    <div ref={ref} className="mt-0.5 w-full">
      <svg width={w} height={38} className="block" role="img" aria-label={l("bandLabel")}>
        <rect x={0} y={13} width={w} height={10} rx={2} className="fill-card" />
        {segs.map((s) => (
          <rect key={s.x0} x={s.x0} y={13} width={s.x1 - s.x0} height={10} className="fill-data" opacity={s.up ? 0.5 : 0.13} />
        ))}
        {marks.map((m) => (
          <text key={m.e.time} x={m.cx} y={8} textAnchor="middle" fontSize={9.5} className="fill-muted-foreground font-mono">
            {m.text}
          </text>
        ))}
        {hours.map((h) => (
          <line key={h} x1={clampX(x(a.dayStart + h * HOUR_MS), 0.5)} x2={clampX(x(a.dayStart + h * HOUR_MS), 0.5)} y1={23} y2={26} className="stroke-muted-foreground" strokeWidth={1} />
        ))}
        {hours.map((h) => (
          <text
            key={`t${h}`}
            x={clampX(x(a.dayStart + h * HOUR_MS), 0)}
            y={36}
            textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}
            fontSize={9}
            className="fill-muted-foreground font-mono"
          >
            {String(h).padStart(2, "0")}
          </text>
        ))}
        {ex != null && <rect x={sx} y={11} width={Math.max(3, ex - sx)} height={14} rx={2} fill="none" className="stroke-data" strokeWidth={1.5} />}
        <line x1={sx} x2={sx} y1={10} y2={26} className="stroke-data" strokeWidth={2} strokeLinecap="round" />
      </svg>
      <span className="sr-only">
        {a.evs.map((e) => `${t(e.type === "low" ? "tide.low" : "tide.high")} ${time(e, a.sessionDay)}`).join(", ")}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 */

function CountdownLine({ text, strong }: { text: string; strong?: boolean }) {
  // the duration stays mono, the words around it sans
  const m = text.match(/\d+h\d+m|\d+h|\d+m/);
  const [before, after] = m ? text.split(m[0]) : [text, ""];
  return (
    <span className={`block whitespace-nowrap leading-5 ${strong ? "text-[12px] text-foreground" : "text-[10.5px] text-muted-foreground"}`}>
      {before}
      {m && <span className={`font-mono ${strong ? "text-[14px] font-medium" : "text-[11px]"} tracking-[-0.02em]`}>{m[0]}</span>}
      {after}
    </span>
  );
}

/**
 * 3. Countdown. No graphic: how long to the next turning point and how long
 * since the last one, measured from the session's start.
 */
function Countdown({ a }: { a: Analysis }) {
  const l = useLocal();
  const { prev, next } = a;
  if (!prev && !next) return null;
  const mins = (from: number, to: number) => Math.max(1, Math.round((to - from) / 60000));
  const toKey = next?.type === "high" ? "toHigh" : "toLow";
  const sinceKey = prev?.type === "low" ? "sinceLow" : "sinceHigh";
  return (
    <span className="mt-1 block">
      {next && <CountdownLine strong text={l(toKey, { d: fmtDuration(mins(a.sessionMs, a.times[a.evs.indexOf(next)])) })} />}
      {prev && <CountdownLine text={l(sinceKey, { d: fmtDuration(mins(a.times[a.evs.indexOf(prev)], a.sessionMs)) })} />}
    </span>
  );
}

/* ------------------------------------------------------------------ 4 */

/**
 * 4. Hourly bars. One bar per hour of the session's day, as tall as the
 * (schematic) water level in that hour; the hours you were out are dark.
 * Hours the stored events don't reach are left as a short stub.
 */
function HourBars({ a }: { a: Analysis }) {
  const l = useLocal();
  const [ref, w] = useWidth();
  const BAR_H = 26;
  const gap = w < 180 ? 1 : 2;
  const bw = (w - 23 * gap) / 24;
  const startHour = Math.floor((a.sessionMs - a.dayStart) / HOUR_MS);
  const endHour = a.endMs != null ? Math.ceil((a.endMs - a.dayStart) / HOUR_MS) : startHour + 1;
  const levels = Array.from({ length: 24 }, (_, h) => a.norm(a.dayStart + h * HOUR_MS + HOUR_MS / 2));
  if (a.evs.length < 2) return <Lone a={a} />;
  const wide = w >= 300;
  const ticks = wide ? [0, 3, 6, 9, 12, 15, 18, 21] : [0, 12];
  return (
    <div ref={ref} className="mt-1 w-full">
      <svg width={w} height={BAR_H + 13} className="block" role="img" aria-label={l("barsLabel")}>
        {levels.map((v, h) => {
          const out = h >= startHour && h < endHour;
          const bh = v == null ? 2 : 3 + v * (BAR_H - 3);
          return (
            <rect
              key={h}
              x={h * (bw + gap)}
              y={BAR_H - bh}
              width={bw}
              height={bh}
              rx={Math.min(1.5, bw / 2)}
              className="fill-data"
              opacity={out ? 1 : v == null ? 0.1 : 0.22}
            />
          );
        })}
        {ticks.map((h) => (
          <text key={h} x={h * (bw + gap) + (h === 0 ? 0 : bw / 2)} y={BAR_H + 10.5} textAnchor={h === 0 ? "start" : "middle"} fontSize={9} className="fill-muted-foreground font-mono">
            {String(h).padStart(2, "0")}
          </text>
        ))}
        <text x={w} y={BAR_H + 10.5} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
          24
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ 5 */

/**
 * 5. Tide table. The way a printed tide table reads: the turning points around
 * the session as short rows in time order, the session slotted in between on a
 * thin rail. Words from 200 px, letters below.
 */
function TideTable({ a }: { a: Analysis }) {
  const { t } = useLang();
  const l = useLocal();
  const time = useEventTime();
  const name = useEventName();
  const [ref, w] = useWidth();
  const wide = w >= 170;
  const afterNext = a.next ? a.evs[a.evs.indexOf(a.next) + 1] : undefined;
  type Row = { key: string; kind: "event" | "session"; e?: TideEvent };
  const rows: Row[] = [];
  if (a.prev) rows.push({ key: a.prev.time, kind: "event", e: a.prev });
  rows.push({ key: "session", kind: "session" });
  if (a.next) rows.push({ key: a.next.time, kind: "event", e: a.next });
  if (afterNext) rows.push({ key: afterNext.time, kind: "event", e: afterNext });
  const hhmm = (tm: number) => new Date(tm).toISOString().slice(11, 16);
  const sessionText = a.endMs != null ? `${hhmm(a.sessionMs)}–${hhmm(a.endMs)}` : hhmm(a.sessionMs);
  return (
    <div ref={ref} className="relative mt-1 w-full">
      <span aria-hidden className="absolute bottom-2 left-[4px] top-2 w-px bg-foreground/20" />
      <ul className="relative">
        {rows.map((r) => (
          <li key={r.key} className="flex h-[15px] items-center gap-2">
            <span className="flex w-[9px] shrink-0 justify-center">
              {r.kind === "session" ? (
                <span className="size-[9px] rounded-full bg-data" />
              ) : (
                <span className="size-[7px] rounded-full border-[1.5px] border-data bg-secondary" />
              )}
            </span>
            {r.kind === "session" ? (
              <span className="whitespace-nowrap font-mono text-[11px] font-semibold leading-4 text-foreground">
                {wide && <span className="mr-1.5 font-sans font-medium text-muted-foreground">{l("session")}</span>}
                {sessionText}
              </span>
            ) : (
              <span className={`whitespace-nowrap ${mono}`}>
                <span className="sr-only">{t(r.e!.type === "low" ? "tide.low" : "tide.high")}</span>
                <span aria-hidden className="inline-block">
                  {name(r.e!, !wide)}
                  {wide ? " " : " "}
                  {time(r.e!, a.sessionDay)}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ 6 */

/**
 * 6. Tide stage. Where in the day's range the water was, in the words the spot
 * pages already use for a break's best tide (low / mid / high): three
 * segments, the one(s) you were in lit. Direction stays with the headline.
 */
function Stage({ a }: { a: Analysis }) {
  const { t } = useLang();
  const l = useLocal();
  const lvl = a.norm(a.sessionMs);
  if (lvl == null) return <Lone a={a} />;
  const stageOf = (n: number) => (n < 1 / 3 ? 0 : n < 2 / 3 ? 1 : 2);
  const from = stageOf(lvl);
  const endLvl = a.endMs != null ? a.norm(a.endMs) : null;
  const to = endLvl != null ? stageOf(endLvl) : from;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const names = [l("stageLow"), l("stageMid"), l("stageHigh")];
  const trendText = a.trend ? t(a.trend === "rising" ? "tide.rising" : "tide.falling") : "";
  return (
    <span className="mt-1.5 block">
      <span
        role="img"
        aria-label={l("stageLabel", { stage: names[from], trend: trendText })}
        className="grid max-w-[200px] grid-cols-3 gap-1"
      >
        {names.map((n, i) => (
          <span
            key={n}
            aria-hidden
            className={`flex h-[18px] items-center justify-center whitespace-nowrap rounded-full font-sans text-[10.5px] font-medium ${
              i >= lo && i <= hi ? "bg-data text-card" : "bg-card text-muted-foreground"
            }`}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

export const VARIANTS: { id: string; title: string; Body: (p: { a: Analysis }) => React.ReactNode }[] = [
  { id: "staff", title: "1. Water staff", Body: Staff },
  { id: "band", title: "2. Day band", Body: DayBand },
  { id: "countdown", title: "3. Countdown", Body: Countdown },
  { id: "bars", title: "4. Hourly bars", Body: HourBars },
  { id: "table", title: "5. Tide table", Body: TideTable },
  { id: "stage", title: "6. Tide stage", Body: Stage },
];

/** One Tide tile of a given pixel width, shaped like the real ConditionTile. */
export function TideTile({
  variant,
  tideCase,
  width,
}: {
  variant: (typeof VARIANTS)[number];
  tideCase: TideCase;
  width: number;
}) {
  const { t } = useLang();
  const a = analyze(tideCase);
  const Body = variant.Body;
  return (
    <div className="flex shrink-0" style={{ width }}>
      <ConditionTile
        label={t("tile.tideOpenMeteo")}
        className="grow"
        value={
          a.trend ? (
            <Figure value={<span className="capitalize">{t(a.trend === "rising" ? "tide.rising" : "tide.falling")}</span>} />
          ) : null
        }
        sub={<Body a={a} />}
      />
    </div>
  );
}
