/**
 * Open-Meteo lookup. Server-side only — the browser doesn't need to call this,
 * and in the artifact version it couldn't (sandbox blocks outbound network).
 * That limitation is the whole reason this repo exists.
 *
 * No API key. Free for non-commercial use. Verified working 2026-09-17.
 */
import type { TideEvent } from "./types";
import { pickBracket } from "./tide-bracket";

const MARINE = "https://marine-api.open-meteo.com/v1/marine";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

const MARINE_VARS = [
  "wave_height",
  "swell_wave_height",
  "swell_wave_period",
  "swell_wave_direction",
  "secondary_swell_wave_height",
  "secondary_swell_wave_period",
  "secondary_swell_wave_direction",
  "wind_wave_height",
  "wind_wave_period",
  "sea_surface_temperature",
  "sea_level_height_msl",
].join(",");

// wind lives on the weather endpoint, not the marine one
const WIND_VARS = [
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "temperature_2m",
].join(",");

export interface Conditions {
  swellHeightM: number | null;
  swellPeriodS: number | null;
  swellDirDeg: number | null;
  secondarySwellHeightM: number | null;
  secondarySwellPeriodS: number | null;
  secondarySwellDirDeg: number | null;
  windWaveHeightM: number | null;
  windWavePeriodS: number | null;
  combinedWaveHeightM: number | null;
  windSpeedMs: number | null;
  windGustMs: number | null;
  windDirDeg: number | null;
  seaTempC: number | null;
  airTempC: number | null;
  /** Modelled sea level vs mean sea level (tide + surge), metres. Fallback
   *  for when CWA's tide forecast can't cover a session (past dates,
   *  overseas). Different datum from CWA's TWVD heights — don't compare. */
  seaLevelM: number | null;
  seaLevelTrend: "rising" | "falling" | null;
  /** The previous/next turning points (high/low) of hourly
   *  `sea_level_height_msl` bracketing the session time, refined to
   *  sub-hour precision — see `findTideEvents` below. Modelled at the
   *  offshore grid node, MSL datum: not comparable to CWA's TWVD-referenced
   *  heights in `condCwaTide`, only the shape (rising/falling, timing) is
   *  meaningful across sources. Undefined if the fetch failed or no local
   *  extrema were found in the window. */
  tideEvents?: TideEvent[];
  /** the grid node actually used — may be km from the spot, always show it */
  gridLat: number;
  gridLng: number;
  source: "open-meteo";
  fetchedAt: string;
}

const pick = (block: Record<string, unknown[]> | undefined, key: string, i: number) =>
  (block?.[key]?.[i] as number | undefined) ?? null;

/**
 * @param whenLocal "YYYY-MM-DDTHH:mm" in Asia/Taipei — the session's own format
 */
export async function getConditions(
  lat: number,
  lng: number,
  whenLocal: string
): Promise<Conditions> {
  const date = whenLocal.slice(0, 10);
  const hour = parseInt(whenLocal.slice(11, 13), 10);

  // the archive endpoint lags ~5 days; forecast covers recent + near future
  const ageDays =
    (Date.now() - new Date(date + "T00:00:00+08:00").getTime()) / 86400000;
  const windBase = ageDays > 6 ? ARCHIVE : FORECAST;

  const common = `latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${date}&timezone=Asia%2FTaipei`;

  const [marine, weather, tideEvents] = await Promise.all([
    fetch(`${MARINE}?${common}&hourly=${MARINE_VARS}`).then((r) => r.json()),
    // Open-Meteo's default wind unit is km/h — every value stored before
    // 2026-09-22 was km/h mislabelled as m/s until this param was added.
    fetch(`${windBase}?${common}&hourly=${WIND_VARS}&wind_speed_unit=ms`).then((r) => r.json()),
    // separate call, spans date-1..date+1 so extrema near midnight are found
    // with neighbours on both sides — keeps the single-day indexing above
    // (`i = hour`, 0..23) untouched.
    findTideEvents(lat, lng, whenLocal).catch(() => undefined),
  ]);

  const mh = marine.hourly;
  const wh = weather.hourly;
  const i = hour; // hourly arrays are 0..23 for a single local day

  // trend from the neighbouring hour; at 23:00 look back instead of ahead
  const seaLevelM = pick(mh, "sea_level_height_msl", i);
  const seaLevelOther = pick(mh, "sea_level_height_msl", i < 23 ? i + 1 : i - 1);
  const seaLevelTrend =
    seaLevelM == null || seaLevelOther == null || seaLevelOther === seaLevelM
      ? null
      : (i < 23 ? seaLevelOther > seaLevelM : seaLevelM > seaLevelOther)
        ? "rising"
        : "falling";

  return {
    swellHeightM: pick(mh, "swell_wave_height", i),
    swellPeriodS: pick(mh, "swell_wave_period", i),
    swellDirDeg: pick(mh, "swell_wave_direction", i),
    secondarySwellHeightM: pick(mh, "secondary_swell_wave_height", i),
    secondarySwellPeriodS: pick(mh, "secondary_swell_wave_period", i),
    secondarySwellDirDeg: pick(mh, "secondary_swell_wave_direction", i),
    windWaveHeightM: pick(mh, "wind_wave_height", i),
    windWavePeriodS: pick(mh, "wind_wave_period", i),
    combinedWaveHeightM: pick(mh, "wave_height", i),
    windSpeedMs: pick(wh, "wind_speed_10m", i),
    windGustMs: pick(wh, "wind_gusts_10m", i),
    windDirDeg: pick(wh, "wind_direction_10m", i),
    seaTempC: pick(mh, "sea_surface_temperature", i),
    airTempC: pick(wh, "temperature_2m", i),
    seaLevelM,
    seaLevelTrend,
    tideEvents,
    gridLat: marine.latitude,
    gridLng: marine.longitude,
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
  };
}

// "YYYY-MM-DDTHH:mm" <-> a pure clock-arithmetic ms value (treated as if
// UTC, purely so +/- minutes and re-formatting work without depending on
// the server's real timezone — these times are already Asia/Taipei local,
// per the app's convention of storing no tz suffix).
const toMs = (local: string) => new Date(`${local}:00Z`).getTime();
const toLocal = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const addDays = (date: string, delta: number) =>
  toLocal(toMs(`${date}T00:00`) + delta * 86400000).slice(0, 10);

/**
 * Finds the previous/next tide turning points (local extrema of hourly
 * `sea_level_height_msl`) bracketing `whenLocal`, refined to sub-hour
 * precision with a 3-point parabolic fit around each extremum (hourly
 * resolution alone is only good to ±30 min).
 *
 * Verified 2026-09-24 against Jialeshui 2026-09-16, where Swelleye
 * independently reported low 14:44 / high 20:26: the raw hourly series has
 * its min (0.44 m) at 14:00 and max (1.21 m) at 20:00, refining to ~13:50
 * and ~20:10. The high moves toward Swelleye's 20:26 (16 min off, down from
 * an hour); the low moves the wrong way (13:50 vs 14:44, worse than the
 * raw ±30 min hourly bound). Traced to the API's 2-decimal-place rounding
 * on the surrounding hours (0.47/0.44/0.50) — the fit's curvature term is
 * small there, so a rounding-sized error swings the vertex a lot. Formula
 * itself checked against a synthetic parabola and is correct; this is a
 * real precision limitation of the input data, not a bug in the fit.
 */
/** Exported for the one-off tideEvents backfill script — lets it add
 *  `tideEvents` to existing rows' `cond_open_meteo` without re-fetching or
 *  overwriting any other field via the full getConditions() call. */
export async function findTideEvents(
  lat: number,
  lng: number,
  whenLocal: string
): Promise<TideEvent[] | undefined> {
  const day = whenLocal.slice(0, 10);
  const start = addDays(day, -1);
  const end = addDays(day, 1);
  const url =
    `${MARINE}?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}` +
    `&timezone=Asia%2FTaipei&hourly=sea_level_height_msl`;
  const body = await fetch(url).then((r) => r.json());

  const times: string[] = body?.hourly?.time ?? [];
  const values: (number | null)[] = body?.hourly?.sea_level_height_msl ?? [];
  const extrema = refineExtrema(times, values);
  if (extrema.length === 0) return undefined;

  const targetMs = toMs(whenLocal);
  const { prev, next } = pickBracket(extrema, targetMs, (e) => toMs(e.time));

  const events = [prev, next].filter((e): e is TideEvent => e != null);
  return events.length > 0 ? events : undefined;
}

/** Local maxima/minima of an hourly series, each refined to sub-hour time
 *  and height via a 3-point parabolic fit through the extremum and its two
 *  hourly neighbours. Standard quadratic-vertex interpolation (as used for
 *  spectral peak-picking): fit y = a*x^2 + b*x + c through x = -1, 0, +1
 *  (hours either side of the sample), vertex at x* = -b/(2a). */
function refineExtrema(times: string[], values: (number | null)[]): TideEvent[] {
  const events: TideEvent[] = [];
  for (let i = 1; i < times.length - 1; i++) {
    const yPrev = values[i - 1];
    const y0 = values[i];
    const yNext = values[i + 1];
    if (yPrev == null || y0 == null || yNext == null) continue;

    const isHigh = y0 > yPrev && y0 > yNext;
    const isLow = y0 < yPrev && y0 < yNext;
    if (!isHigh && !isLow) continue;

    const denom = yPrev - 2 * y0 + yNext;
    // denom ~0 means the three points are nearly collinear (a degenerate
    // fit) — keep the offset at 0 rather than divide by ~0.
    const offsetHours = denom === 0 ? 0 : 0.5 * (yPrev - yNext) / denom;
    const clampedOffset = Math.max(-0.5, Math.min(0.5, offsetHours));
    const heightM =
      denom === 0 ? y0 : y0 - Math.pow(yNext - yPrev, 2) / (8 * denom);

    events.push({
      type: isHigh ? "high" : "low",
      time: toLocal(toMs(times[i]) + clampedOffset * 3600000),
      heightM: Math.round(heightM * 1000) / 1000,
    });
  }
  return events;
}

const POINTS = [
  "N","NNE","NE","ENE","E","ESE","SE","SSE",
  "S","SSW","SW","WSW","W","WNW","NW","NNW",
];
export const toCompass = (deg: number | null) =>
  deg == null ? null : POINTS[Math.round(deg / 22.5) % 16];
