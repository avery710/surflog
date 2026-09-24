/**
 * Swelleye (manual `cond`) vs Open-Meteo (`condOpenMeteo`) comparison.
 * Pure: no I/O, no DB. Feed it sessions, get differences and verdicts back.
 * Difference is always Open-Meteo MINUS Swelleye.
 *
 * Read-only analysis tool — nothing here is used by the app UI.
 * See CLAUDE.md "Data sources" for how to run it and what it found.
 */
import type { Session, TideEvent } from "./types";

/**
 * Every verdict threshold in one place. Each metric is judged "close",
 * "noticeable" or "large". Where both `absClose` and `pctClose` exist, a pair
 * is CLOSE if EITHER is met (a 0.1 m gap on a 0.3 m swell is a big percentage
 * but not a real disagreement) and LARGE only if BOTH large limits are
 * exceeded. These are judgement calls, not fitted to anything; the sample is
 * tiny. Change them here, and the report prints them.
 *
 * Why these numbers:
 * - Swelleye heights are typed to 1 decimal (±0.05 m rounding) and read from
 *   a 2-hourly table; Open-Meteo is hourly at a 0.5-degree-ish grid node.
 * - Swelleye directions are rendered arrows read to a 16-point compass, so
 *   they are quantised to 22.5 degree steps (±11.25). Two independent
 *   readings can differ by one full step (22.5) from quantisation alone, so
 *   "close" is up to one step, "large" is beyond two steps (45).
 * - Wind speed is the open question in CLAUDE.md (~30% apart at Jialeshui),
 *   so its percentage limits are deliberately not tighter than that.
 * - Tide timing: Open-Meteo turning points come from hourly sea-level data,
 *   good to about 30 min at best (see lib/openmeteo.ts findTideEvents).
 */
export const THRESHOLDS = {
  swellHeightM: { absClose: 0.15, absLarge: 0.35, pctClose: 15, pctLarge: 30 },
  swellPeriodS: { absClose: 0.5, absLarge: 1.5 },
  windSpeedMs: { absClose: 1, absLarge: 2.5, pctClose: 15, pctLarge: 30 },
  windGustMs: { absClose: 2, absLarge: 4, pctClose: 15, pctLarge: 30 },
  directionDeg: { absClose: 22.5, absLarge: 45 }, // swell and wind direction
  tideTimingMin: { absClose: 30, absLarge: 90 },
  tempC: { absClose: 1, absLarge: 3 },
  /** Swelleye compass quantisation half-width, for display and notes. */
  compassHalfStepDeg: 11.25,
  /** A metric is "differs a lot" (yes) when more than this share of its
   *  samples are large; "no" only if every sample is close; else "mixed". */
  yesShareLarge: 0.5,
} as const;

export type Verdict = "close" | "noticeable" | "large";
export type Overall = "no" | "mixed" | "yes";

export type MetricKey =
  | "swellHeightM"
  | "swellPeriodS"
  | "swellDir"
  | "windSpeedMs"
  | "windGustMs"
  | "windDir"
  | "tideTiming"
  | "tideTrend"
  | "seaTempC"
  | "airTempC";

export const METRIC_META: Record<MetricKey, { label: string; unit: string }> = {
  swellHeightM: { label: "Swell height", unit: "m" },
  swellPeriodS: { label: "Swell period", unit: "s" },
  swellDir: { label: "Swell direction", unit: "deg" },
  windSpeedMs: { label: "Wind speed", unit: "m/s" },
  windGustMs: { label: "Wind gust", unit: "m/s" },
  windDir: { label: "Wind direction", unit: "deg" },
  tideTiming: { label: "Tide turn timing", unit: "min" },
  tideTrend: { label: "Tide trend", unit: "" },
  seaTempC: { label: "Sea temp", unit: "°C" },
  airTempC: { label: "Air temp", unit: "°C" },
};

export interface MetricResult {
  key: MetricKey;
  swelleye: string; // display text
  openMeteo: string; // display text
  /** OM minus Swelleye, in the metric's unit (signed). null for categorical. */
  diff: number | null;
  /** diff as % of the Swelleye value, where meaningful. */
  pctDiff: number | null;
  verdict: Verdict;
  note?: string;
}

export interface SessionComparison {
  id: string;
  spot: string;
  when: string;
  metrics: MetricResult[];
  /** Metrics that could not be compared, with the reason. */
  skipped: { key: MetricKey; reason: string }[];
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

export function degToCompass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Centre bearing of a compass point, or null if not one of the 16. */
export function compassToDeg(point: string | null | undefined): number | null {
  if (!point) return null;
  const i = (COMPASS as readonly string[]).indexOf(point.trim().toUpperCase());
  return i < 0 ? null : i * 22.5;
}

/** Signed smallest angle a - b, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (((a - b) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

function judge(
  absDiff: number,
  pct: number | null,
  t: { absClose: number; absLarge: number; pctClose?: number; pctLarge?: number }
): Verdict {
  const closeByPct = t.pctClose !== undefined && pct !== null && Math.abs(pct) <= t.pctClose;
  if (absDiff <= t.absClose || closeByPct) return "close";
  const largeByPct = t.pctLarge === undefined || (pct !== null && Math.abs(pct) > t.pctLarge);
  if (absDiff > t.absLarge && largeByPct) return "large";
  return "noticeable";
}

function numeric(
  key: MetricKey,
  sw: number | null | undefined,
  om: number | null | undefined,
  t: Parameters<typeof judge>[2],
  dp = 2
): MetricResult | null {
  if (sw == null || om == null) return null;
  const diff = om - sw;
  const pct = sw !== 0 ? (diff / sw) * 100 : null;
  return {
    key,
    swelleye: String(sw),
    openMeteo: String(round(om, dp)),
    diff: round(diff, dp),
    pctDiff: pct === null ? null : round(pct, 1),
    verdict: judge(Math.abs(diff), pct, t),
  };
}

function direction(
  key: "swellDir" | "windDir",
  swPoint: string | null | undefined,
  omDeg: number | null | undefined
): MetricResult | { skip: string } {
  if (!swPoint || omDeg == null) return { skip: "missing on one side" };
  const swDeg = compassToDeg(swPoint);
  if (swDeg === null) return { skip: `Swelleye direction "${swPoint}" is not a 16-point compass value` };
  const diff = angleDiff(omDeg, swDeg);
  const omPoint = degToCompass(omDeg);
  return {
    key,
    swelleye: `${swPoint} (${swDeg}°)`,
    openMeteo: `${omPoint} (${omDeg}°)`,
    diff: round(diff, 1),
    pctDiff: null,
    verdict: judge(Math.abs(diff), null, THRESHOLDS.directionDeg),
    note:
      omPoint === swPoint
        ? "same compass point"
        : `Swelleye side is quantised (±${THRESHOLDS.compassHalfStepDeg}°)`,
  };
}

// ---- tide note parsing ------------------------------------------------

export interface ParsedTideNote {
  trend: "rising" | "falling" | null;
  low: string | null; // "HH:mm"
  high: string | null;
}

/**
 * Parses Swelleye's typed tideNote, e.g. "rising — low 14:44, high 20:26".
 * Defensive: any part it cannot find comes back null; returns null if
 * nothing at all was recognised.
 */
export function parseTideNote(note: string | null | undefined): ParsedTideNote | null {
  if (!note) return null;
  const s = note.toLowerCase();
  const trend = /\brising\b|\bflood/.test(s) ? "rising" : /\bfalling\b|\bebb/.test(s) ? "falling" : null;
  const grab = (word: string) => {
    const m = s.match(new RegExp(`\\b${word}\\b[^0-9]{0,12}(\\d{1,2})[:.](\\d{2})`));
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
  };
  const low = grab("low");
  const high = grab("high");
  return trend || low || high ? { trend, low, high } : null;
}

const minutesOfDay = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Signed clock difference a - b in minutes, wrapped to ±12 h. */
function clockDiffMin(a: number, b: number): number {
  return ((((a - b) % 1440) + 1440 + 720) % 1440) - 720;
}

function tideTiming(
  parsed: ParsedTideNote,
  events: TideEvent[] | undefined
): { results: MetricResult[]; skip?: string } {
  if (!events?.length) return { results: [], skip: "Open-Meteo has no tideEvents on this session" };
  const results: MetricResult[] = [];
  for (const type of ["low", "high"] as const) {
    const sw = parsed[type];
    if (!sw) continue;
    // several events of one type may exist across days; take the one with
    // the smallest clock difference (tides repeat ~12.4 h, so this is
    // unambiguous when the session is near both).
    const swMin = minutesOfDay(sw);
    let best: { ev: TideEvent; d: number } | null = null;
    for (const ev of events.filter((e) => e.type === type)) {
      const d = clockDiffMin(minutesOfDay(ev.time.slice(11, 16)), swMin);
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { ev, d };
    }
    if (!best) continue;
    results.push({
      key: "tideTiming",
      swelleye: `${type} ${sw}`,
      openMeteo: `${type} ${best.ev.time.slice(11, 16)}`,
      diff: best.d,
      pctDiff: null,
      verdict: judge(Math.abs(best.d), null, THRESHOLDS.tideTimingMin),
    });
  }
  return results.length ? { results } : { results: [], skip: "no matching low/high event on both sides" };
}

// ---- main -------------------------------------------------------------

/** True when the session has both blocks (Swelleye typed in + Open-Meteo). */
export function hasBoth(s: Session): boolean {
  return !!s.cond && s.cond.source === "swelleye" && !!s.condOpenMeteo;
}

export function compareSession(s: Session): SessionComparison | null {
  if (!hasBoth(s)) return null;
  const sw = s.cond!;
  const om = s.condOpenMeteo!;
  const metrics: MetricResult[] = [];
  const skipped: SessionComparison["skipped"] = [];

  const add = (key: MetricKey, r: MetricResult | { skip: string } | null, reason = "missing on one side") => {
    if (r === null) skipped.push({ key, reason });
    else if ("skip" in r) skipped.push({ key, reason: r.skip });
    else metrics.push(r);
  };

  add("swellHeightM", numeric("swellHeightM", sw.swellHeightM, om.swellHeightM, THRESHOLDS.swellHeightM));
  add("swellPeriodS", numeric("swellPeriodS", sw.swellPeriodS, om.swellPeriodS, THRESHOLDS.swellPeriodS));
  add("swellDir", direction("swellDir", sw.swellDir, om.swellDirDeg));
  add("windSpeedMs", numeric("windSpeedMs", sw.windSpeedMs, om.windSpeedMs, THRESHOLDS.windSpeedMs));
  add("windGustMs", numeric("windGustMs", sw.windGustMs, om.windGustMs, THRESHOLDS.windGustMs));
  add("windDir", direction("windDir", sw.windDir, om.windDirDeg));
  add("seaTempC", numeric("seaTempC", sw.seaTempC, om.seaTempC, THRESHOLDS.tempC, 1));
  add("airTempC", numeric("airTempC", sw.airTempC, om.airTempC, THRESHOLDS.tempC, 1));

  const parsed = parseTideNote(sw.tideNote);
  if (!parsed) {
    skipped.push({ key: "tideTiming", reason: sw.tideNote ? `could not parse tideNote "${sw.tideNote}"` : "no tideNote" });
  } else {
    const t = tideTiming(parsed, om.tideEvents);
    metrics.push(...t.results);
    if (t.skip) skipped.push({ key: "tideTiming", reason: t.skip });
    if (parsed.trend && om.seaLevelTrend) {
      const same = parsed.trend === om.seaLevelTrend;
      metrics.push({
        key: "tideTrend",
        swelleye: parsed.trend,
        openMeteo: om.seaLevelTrend,
        diff: null,
        pctDiff: null,
        verdict: same ? "close" : "large",
      });
    }
  }

  return { id: s.id, spot: s.spot, when: s.when, metrics, skipped };
}

// ---- summary ----------------------------------------------------------

export interface MetricSummary {
  key: MetricKey;
  n: number;
  meanDiff: number | null;
  meanAbsDiff: number | null;
  maxAbsDiff: number | null;
  /** mean of OM / Swelleye, for numeric metrics with nonzero Swelleye values */
  meanRatio: number | null;
  counts: Record<Verdict, number>;
  overall: Overall;
}

export function summarise(comparisons: SessionComparison[]): MetricSummary[] {
  const byKey = new Map<MetricKey, MetricResult[]>();
  for (const c of comparisons) {
    for (const m of c.metrics) byKey.set(m.key, [...(byKey.get(m.key) ?? []), m]);
  }
  const out: MetricSummary[] = [];
  for (const key of Object.keys(METRIC_META) as MetricKey[]) {
    const ms = byKey.get(key);
    if (!ms) continue;
    const diffs = ms.map((m) => m.diff).filter((d): d is number => d !== null);
    const counts: Record<Verdict, number> = { close: 0, noticeable: 0, large: 0 };
    for (const m of ms) counts[m.verdict]++;
    const ratios = ms.filter((m) => m.pctDiff !== null).map((m) => 1 + (m.pctDiff as number) / 100);
    const mean = (a: number[]) => (a.length ? round(a.reduce((x, y) => x + y, 0) / a.length, 2) : null);
    const overall: Overall =
      counts.close === ms.length ? "no" : counts.large / ms.length > THRESHOLDS.yesShareLarge ? "yes" : "mixed";
    out.push({
      key,
      n: ms.length,
      meanDiff: mean(diffs),
      meanAbsDiff: mean(diffs.map(Math.abs)),
      maxAbsDiff: diffs.length ? round(Math.max(...diffs.map(Math.abs)), 2) : null,
      meanRatio: mean(ratios),
      counts,
      overall,
    });
  }
  return out;
}
