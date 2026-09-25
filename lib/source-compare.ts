/**
 * Swelleye vs Open-Meteo comparison. Two Swelleye inputs: numbers typed into
 * a session's `cond`, and full-day readings of Swelleye's table taken in the
 * browser (`SwelleyeReading`, stored in data/swelleye-readings/).
 * Pure: no I/O, no DB. Feed it data, get differences and verdicts back.
 * Difference is always Open-Meteo MINUS Swelleye.
 *
 * Read-only analysis tool — nothing here is used by the app UI.
 * See CLAUDE.md "Data sources" for how to run it and what it found.
 */
import type { Session, TideEvent } from "./types";
import { WIND_LEVELS, windLevelIndex } from "./wind-strength";

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
  /** Wind strength label (lib/wind-strength.ts), in Beaufort band steps. */
  windBandSteps: { absClose: 0, absLarge: 1 },
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
  | "windStrength"
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
  windStrength: { label: "Wind strength label", unit: "bands" },
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

/**
 * Swelleye direction vs Open-Meteo degrees. `swPoint` is a 16-point compass
 * value ("NE"), or a band ("ENE-E") when the arrows could only be read that
 * precisely: then the diff is 0 inside the band, else the distance to the
 * nearer end.
 */
function direction(
  key: "swellDir" | "windDir",
  swPoint: string | null | undefined,
  omDeg: number | null | undefined
): MetricResult | { skip: string } {
  if (!swPoint || omDeg == null) return { skip: "missing on one side" };
  const ends = swPoint.split(/\s*[-–]\s*/);
  const degs = ends.map(compassToDeg);
  if (degs.length > 2 || degs.some((d) => d === null)) {
    return { skip: `Swelleye direction "${swPoint}" is not a 16-point compass value or band` };
  }
  const [a, b] = [degs[0]!, degs[degs.length - 1]!];
  const span = (((b - a) % 360) + 360) % 360;
  const fromA = (((omDeg - a) % 360) + 360) % 360;
  const inside = fromA <= span;
  const toA = angleDiff(omDeg, a);
  const toB = angleDiff(omDeg, b);
  const diff = inside ? 0 : Math.abs(toA) <= Math.abs(toB) ? toA : toB;
  const omPoint = degToCompass(omDeg);
  return {
    key,
    swelleye: degs.length === 2 ? `${swPoint} (${a}°–${b}°)` : `${swPoint} (${a}°)`,
    openMeteo: `${omPoint} (${round(omDeg, 1)}°)`,
    diff: round(diff, 1),
    pctDiff: null,
    verdict: judge(Math.abs(diff), null, THRESHOLDS.directionDeg),
    note:
      degs.length === 2
        ? inside
          ? "inside Swelleye's band"
          : "outside Swelleye's band"
        : omPoint === swPoint
          ? "same compass point"
          : `Swelleye side is quantised (±${THRESHOLDS.compassHalfStepDeg}°)`,
  };
}

function windStrength(
  sw: { speed: number | null | undefined; gust: number | null | undefined },
  om: { speed: number | null | undefined; gust: number | null | undefined }
): MetricResult | null {
  if (sw.speed == null || om.speed == null) return null;
  const swI = windLevelIndex(sw.speed, sw.gust);
  const omI = windLevelIndex(om.speed, om.gust);
  const diff = omI - swI;
  return {
    key: "windStrength",
    swelleye: WIND_LEVELS[swI].key,
    openMeteo: WIND_LEVELS[omI].key,
    diff,
    pctDiff: null,
    verdict: judge(Math.abs(diff), null, THRESHOLDS.windBandSteps),
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
  add(
    "windStrength",
    windStrength({ speed: sw.windSpeedMs, gust: sw.windGustMs }, { speed: om.windSpeedMs, gust: om.windGustMs })
  );
  add("seaTempC", numeric("seaTempC", sw.seaTempC, om.seaTempC, THRESHOLDS.tempC, 1));
  add("airTempC", numeric("airTempC", sw.airTempC, om.airTempC, THRESHOLDS.tempC, 1));

  const parsed = parseTideNote(sw.tideNote);
  if (!parsed) {
    skipped.push({ key: "tideTiming", reason: sw.tideNote ? `could not parse tideNote "${sw.tideNote}"` : "no tideNote" });
  } else {
    // tideEvents can hold ~a day of turns; compare only the pair around the
    // session, or a same-clock-time event ~24 h away could be picked.
    const around = [...(om.tideEvents ?? [])].sort((x, y) => x.time.localeCompare(y.time));
    const nextIdx = around.findIndex((e) => e.time > s.when);
    const bracket =
      nextIdx === -1
        ? around.slice(-1)
        : around.slice(Math.max(0, nextIdx - 1), nextIdx + 1);
    const t = tideTiming(parsed, bracket);
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
  /** meanAbsDiff ÷ the metric's `absLarge`: 0 = identical, 1 = at the
   *  "large" line. One scale across metrics. null for categorical ones. */
  gapScore: number | null;
  /** hours/samples within `absClose` (or agreeing, for categorical) */
  nClose: number;
  counts: Record<Verdict, number>;
  overall: Overall;
}

const LARGE_OF: Partial<Record<MetricKey, number>> = {
  swellHeightM: THRESHOLDS.swellHeightM.absLarge,
  swellPeriodS: THRESHOLDS.swellPeriodS.absLarge,
  swellDir: THRESHOLDS.directionDeg.absLarge,
  windSpeedMs: THRESHOLDS.windSpeedMs.absLarge,
  windGustMs: THRESHOLDS.windGustMs.absLarge,
  windDir: THRESHOLDS.directionDeg.absLarge,
  windStrength: THRESHOLDS.windBandSteps.absLarge,
  tideTiming: THRESHOLDS.tideTimingMin.absLarge,
  seaTempC: THRESHOLDS.tempC.absLarge,
  airTempC: THRESHOLDS.tempC.absLarge,
};

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
      gapScore: (() => {
        const t = LARGE_OF[key];
        if (t == null || !diffs.length) return null;
        return round(diffs.reduce((x, d) => x + Math.abs(d), 0) / diffs.length / t, 2);
      })(),
      nClose: counts.close,
      counts,
      overall,
    });
  }
  return out;
}

// ---- browser readings -------------------------------------------------

/** One hour of Swelleye's forecast table, read off the page. Directions are
 *  16-point compass values or "A-B" bands; any field may be null/absent. */
export interface SwelleyeHour {
  swellHeightM?: number | null;
  swellPeriodS?: number | null;
  swellDir?: string | null;
  windSpeedMs?: number | null;
  windGustMs?: number | null;
  windDir?: string | null;
  seaTempC?: number | null;
  airTempC?: number | null;
}

/** A full day of Swelleye's table for one spot, read in the browser on
 *  request (see CLAUDE.md "Swelleye vs Open-Meteo comparison tool"). */
export interface SwelleyeReading {
  spot: string;
  date: string; // "YYYY-MM-DD", Asia/Taipei
  readAt?: string;
  readBy?: string;
  /** keyed by hour, "00" … "22" (Swelleye's 2-hour grid) */
  hours: Record<string, SwelleyeHour>;
  /** the day's turning points as the table shows them, "HH:mm" local */
  tide?: { type: "high" | "low"; time: string }[];
}

/** Open-Meteo for the same day, snapshotted at first compare so re-runs
 *  don't silently switch from forecast to archive data. */
export interface OpenMeteoDay {
  spot: string;
  date: string;
  fetchedAt: string;
  gridLat: number;
  gridLng: number;
  hours: Record<
    string,
    { swellHeightM: number | null; swellPeriodS: number | null; swellDirDeg: number | null;
      windSpeedMs: number | null; windGustMs: number | null; windDirDeg: number | null;
      seaTempC: number | null; airTempC: number | null }
  >;
  tideEvents: TideEvent[];
}

/** rising if the next turning point after `when` is a high, falling if a low. */
function trendAt(events: { type: "high" | "low"; time: string }[], when: string): "rising" | "falling" | null {
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));
  const next = sorted.find((e) => e.time > when);
  if (next) return next.type === "high" ? "rising" : "falling";
  const last = sorted[sorted.length - 1];
  return last ? (last.type === "high" ? "falling" : "rising") : null;
}

const toMin = (local: string) => new Date(`${local}:00Z`).getTime() / 60000;

/** One comparison per hour in the reading, plus one "tide" row for the
 *  day's turning-point timing. */
export function compareReading(r: SwelleyeReading, om: OpenMeteoDay): SessionComparison[] {
  const swTide = (r.tide ?? []).map((e) => ({ type: e.type, time: `${r.date}T${e.time}` }));
  const out: SessionComparison[] = [];

  for (const hh of Object.keys(r.hours).sort()) {
    const sw = r.hours[hh];
    const o = om.hours[hh];
    const when = `${r.date}T${hh}:00`;
    const metrics: MetricResult[] = [];
    const skipped: SessionComparison["skipped"] = [];
    const add = (key: MetricKey, x: MetricResult | { skip: string } | null) => {
      if (x === null) skipped.push({ key, reason: "missing on one side" });
      else if ("skip" in x) skipped.push({ key, reason: x.skip });
      else metrics.push(x);
    };
    if (!o) {
      skipped.push({ key: "swellHeightM", reason: `no Open-Meteo data for ${hh}:00` });
      out.push({ id: `${r.spot}-${when}`, spot: r.spot, when, metrics, skipped });
      continue;
    }
    add("swellHeightM", numeric("swellHeightM", sw.swellHeightM, o.swellHeightM, THRESHOLDS.swellHeightM));
    add("swellPeriodS", numeric("swellPeriodS", sw.swellPeriodS, o.swellPeriodS, THRESHOLDS.swellPeriodS));
    add("swellDir", direction("swellDir", sw.swellDir, o.swellDirDeg));
    add("windSpeedMs", numeric("windSpeedMs", sw.windSpeedMs, o.windSpeedMs, THRESHOLDS.windSpeedMs));
    add("windGustMs", numeric("windGustMs", sw.windGustMs, o.windGustMs, THRESHOLDS.windGustMs));
    add("windDir", direction("windDir", sw.windDir, o.windDirDeg));
    add(
      "windStrength",
      windStrength({ speed: sw.windSpeedMs, gust: sw.windGustMs }, { speed: o.windSpeedMs, gust: o.windGustMs })
    );
    add("seaTempC", numeric("seaTempC", sw.seaTempC, o.seaTempC, THRESHOLDS.tempC, 1));
    add("airTempC", numeric("airTempC", sw.airTempC, o.airTempC, THRESHOLDS.tempC, 1));
    const swTrend = swTide.length ? trendAt(swTide, when) : null;
    const omTrend = om.tideEvents.length ? trendAt(om.tideEvents, when) : null;
    if (swTrend && omTrend) {
      metrics.push({
        key: "tideTrend",
        swelleye: swTrend,
        openMeteo: omTrend,
        diff: null,
        pctDiff: null,
        verdict: swTrend === omTrend ? "close" : "large",
      });
    }
    out.push({ id: `${r.spot}-${when}`, spot: r.spot, when, metrics, skipped });
  }

  // tide timing: each Swelleye turning point vs the nearest Open-Meteo one of
  // the same type (absolute time, so a next-day event can't be picked by clock)
  const tideMetrics: MetricResult[] = [];
  for (const e of swTide) {
    let best: { ev: TideEvent; d: number } | null = null;
    for (const ev of om.tideEvents.filter((x) => x.type === e.type)) {
      const d = toMin(ev.time) - toMin(e.time);
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { ev, d };
    }
    if (!best) continue;
    tideMetrics.push({
      key: "tideTiming",
      swelleye: `${e.type} ${e.time.slice(11, 16)}`,
      openMeteo: `${e.type} ${best.ev.time.slice(11, 16)}`,
      diff: Math.round(best.d),
      pctDiff: null,
      verdict: judge(Math.abs(best.d), null, THRESHOLDS.tideTimingMin),
    });
  }
  if (tideMetrics.length) {
    out.push({ id: `${r.spot}-${r.date}-tide`, spot: r.spot, when: `${r.date} tide`, metrics: tideMetrics, skipped: [] });
  }
  return out;
}
