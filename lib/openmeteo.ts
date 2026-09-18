/**
 * Open-Meteo lookup. Server-side only — the browser doesn't need to call this,
 * and in the artifact version it couldn't (sandbox blocks outbound network).
 * That limitation is the whole reason this repo exists.
 *
 * No API key. Free for non-commercial use. Verified working 2026-09-17.
 */
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

  const [marine, weather] = await Promise.all([
    fetch(`${MARINE}?${common}&hourly=${MARINE_VARS}`).then((r) => r.json()),
    fetch(`${windBase}?${common}&hourly=${WIND_VARS}`).then((r) => r.json()),
  ]);

  const mh = marine.hourly;
  const wh = weather.hourly;
  const i = hour; // hourly arrays are 0..23 for a single local day

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
    gridLat: marine.latitude,
    gridLng: marine.longitude,
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
  };
}

const POINTS = [
  "N","NNE","NE","ENE","E","ESE","SE","SSE",
  "S","SSW","SW","WSW","W","WNW","NW","NNW",
];
export const toCompass = (deg: number | null) =>
  deg == null ? null : POINTS[Math.round(deg / 22.5) % 16];
