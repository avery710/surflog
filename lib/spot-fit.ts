/**
 * Spot fit — project one offshore reading onto a specific break.
 *
 * WHY THIS EXISTS
 * Open-Meteo cannot resolve neighbouring breaks: every Yilan spot shares one
 * grid node and returns identical numbers (tested 2026-09-18, see CLAUDE.md).
 * What actually differs between Wai'ao and Double Lions is how the same
 * offshore swell meets a different orientation. That part is geometry, and
 * geometry we can compute.
 *
 * WHAT THIS IS NOT
 * Not a forecast, and not a quality score. It is a set of derived FEATURES.
 * Do not collapse them into one number and show it as "today is 7/10" — the
 * whole point of the journal is to find out empirically which features track
 * Capy's own verdict, not to assert one up front.
 *
 * HONEST LIMITS
 * - cos(incidence) is a crude stand-in for refraction. Real wave energy at a
 *   break depends on bathymetry, headlands and shoaling. Guishan Island
 *   shadows parts of the Yilan coast and this model knows nothing about it.
 * - Spot statics come from Swelleye's infographic, which is human local
 *   knowledge, coarsely binned.
 * - Everything here is recomputable from stored inputs. NEVER freeze these
 *   values into a session row as if they were measurements — store `cond`
 *   (the reading) and recompute fit on read, or stamp it with FORMULA_VERSION
 *   so old rows can be regenerated when the formula improves.
 */
import type { Spot } from "./spots";

export const FORMULA_VERSION = 1;

const POINTS = [
  "N","NNE","NE","ENE","E","ESE","SE","SSE",
  "S","SSW","SW","WSW","W","WNW","NW","NNW",
];

export const compassToDeg = (p: string): number | null => {
  const i = POINTS.indexOf(p.trim().toUpperCase());
  return i < 0 ? null : i * 22.5;
};

/** signed smallest angle a-b, in -180..180 */
const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const rad = (d: number) => (d * Math.PI) / 180;

export type WindMode =
  | "offshore" | "cross-offshore" | "cross" | "cross-onshore" | "onshore";

export interface SpotFit {
  formulaVersion: number;
  /** 0..1 — how square-on the swell meets the beach. 0 = blocked by the coast. */
  exposure: number;
  /**
   * DEMOTED 2026-09-18 — do not display, do not treat as a height estimate.
   * Tested at Jialeshui against Swelleye: under-predicts by ~25% at both
   * hours sampled. Waves refract toward shore-normal as they shoal, so
   * cos() of the OFFSHORE incidence over-penalises. Raw Open-Meteo
   * swell height matched Swelleye to within 0.04 m with no adjustment.
   * Kept only so the blocked case (exposure = 0) can still be tested.
   *
   * UPDATE 2026-09-18 (Phase 1b): `exposure` itself is RESTORED as a per-spot
   * discriminator — Nanwan vs Jialeshui, exposure ratio 10.7 vs a Swelleye
   * height ratio of 1.10, and the surfer ratings went with exposure. The
   * earlier demotion tested against Swelleye's height, which turns out not to
   * be spot-adjusted at all. `effectiveSwellM` stays demoted; `exposure` and
   * `inSwellWindow` do not. See VALIDATION.md Findings 6 and 7.
   */
  effectiveSwellM: number | null;
  /** |angle| between swell direction and the spot's facing */
  incidenceDeg: number;
  /** 0 when the swell sits inside the spot's published best-swell window */
  swellWindowOffsetDeg: number | null;
  inSwellWindow: boolean | null;
  /** -1 fully onshore … +1 fully offshore */
  offshoreness: number;
  windMode: WindMode;
  /** onshore component of wind speed — the part that wrecks the face */
  onshoreWindMs: number | null;
  windMatchesBest: boolean | null;
  /** wind wave height / swell height. High = short-period slop on top. */
  junkRatio: number | null;
  tideBand: "low" | "mid" | "high" | null;
  tideMatchesBest: boolean | null;
  /** which inputs were missing, so the UI can say "unknown" not "zero" */
  missing: string[];
}

export interface FitInput {
  swellDirDeg?: number | null;
  swellHeightM?: number | null;
  windDirDeg?: number | null;
  windSpeedMs?: number | null;
  windWaveHeightM?: number | null;
  /** tide height at the session, plus that day's range, for banding */
  tideM?: number | null;
  tideDayMinM?: number | null;
  tideDayMaxM?: number | null;
}

export function computeFit(spot: Spot, c: FitInput): SpotFit {
  const missing: string[] = [];

  const facing = spot.facing ? compassToDeg(spot.facing) : null;
  if (facing == null) missing.push("spot.facing");

  // ---- exposure: how square-on does the swell meet this beach ----
  let incidenceDeg = 0;
  let exposure = 0;
  if (facing != null && c.swellDirDeg != null) {
    incidenceDeg = Math.abs(angleDiff(c.swellDirDeg, facing));
    // beyond 90 degrees the swell is arriving from behind the land
    exposure = Math.max(0, Math.cos(rad(incidenceDeg)));
  } else {
    if (c.swellDirDeg == null) missing.push("swellDirDeg");
  }

  const effectiveSwellM =
    c.swellHeightM != null && facing != null
      ? Math.round(c.swellHeightM * exposure * 100) / 100
      : null;

  // ---- published best-swell window ----
  let swellWindowOffsetDeg: number | null = null;
  let inSwellWindow: boolean | null = null;
  if (spot.bestSwellDir?.length && c.swellDirDeg != null) {
    const offsets = spot.bestSwellDir
      .map(compassToDeg)
      .filter((d): d is number => d != null)
      .map((d) => Math.abs(angleDiff(c.swellDirDeg!, d)));
    // each compass point covers +-11.25 degrees
    const raw = Math.min(...offsets) - 11.25;
    swellWindowOffsetDeg = Math.max(0, Math.round(raw * 10) / 10);
    inSwellWindow = swellWindowOffsetDeg === 0;
  } else if (!spot.bestSwellDir?.length) {
    missing.push("spot.bestSwellDir");
  }

  // ---- wind relative to the shore ----
  // wind FROM the direction the beach faces = blowing in off the sea = onshore
  let offshoreness = 0;
  let windMode: WindMode = "cross";
  let onshoreWindMs: number | null = null;
  if (facing != null && c.windDirDeg != null) {
    const windRel = Math.abs(angleDiff(c.windDirDeg, facing));
    offshoreness = -Math.cos(rad(windRel));
    windMode =
      offshoreness > 0.7 ? "offshore"
      : offshoreness > 0.25 ? "cross-offshore"
      : offshoreness > -0.25 ? "cross"
      : offshoreness > -0.7 ? "cross-onshore"
      : "onshore";
    if (c.windSpeedMs != null) {
      onshoreWindMs =
        Math.round(c.windSpeedMs * Math.max(0, -offshoreness) * 10) / 10;
    }
  } else if (c.windDirDeg == null) {
    missing.push("windDirDeg");
  }

  let windMatchesBest: boolean | null = null;
  if (spot.bestWindDir?.length && c.windDirDeg != null) {
    windMatchesBest = spot.bestWindDir
      .map(compassToDeg)
      .filter((d): d is number => d != null)
      .some((d) => Math.abs(angleDiff(c.windDirDeg!, d)) <= 22.5);
  }

  // ---- junk ratio: short-period wind slop sitting on the swell ----
  const junkRatio =
    c.windWaveHeightM != null && c.swellHeightM != null && c.swellHeightM > 0
      ? Math.round((c.windWaveHeightM / c.swellHeightM) * 100) / 100
      : null;

  // ---- tide band, relative to that day's own range ----
  let tideBand: SpotFit["tideBand"] = null;
  if (c.tideM != null && c.tideDayMinM != null && c.tideDayMaxM != null) {
    const span = c.tideDayMaxM - c.tideDayMinM;
    if (span > 0) {
      const pct = (c.tideM - c.tideDayMinM) / span;
      tideBand = pct < 1 / 3 ? "low" : pct < 2 / 3 ? "mid" : "high";
    }
  } else {
    missing.push("tide range");
  }

  let tideMatchesBest: boolean | null = null;
  if (tideBand && spot.bestTide) {
    // "Mid to High", "Low to Mid", "All tides", ...
    const t = spot.bestTide.toLowerCase();
    tideMatchesBest = t.includes("all") || t.includes(tideBand);
  }

  return {
    formulaVersion: FORMULA_VERSION,
    exposure: Math.round(exposure * 100) / 100,
    effectiveSwellM,
    incidenceDeg: Math.round(incidenceDeg),
    swellWindowOffsetDeg,
    inSwellWindow,
    offshoreness: Math.round(offshoreness * 100) / 100,
    windMode,
    onshoreWindMs,
    windMatchesBest,
    junkRatio,
    tideBand,
    tideMatchesBest,
    missing,
  };
}
