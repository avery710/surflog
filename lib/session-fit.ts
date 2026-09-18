import { computeFit, compassToDeg, type SpotFit } from "./spot-fit";
import type { Spot } from "./spots";
import type { Session } from "./types";

/**
 * Builds spot-fit input from whichever reading has directions in degrees.
 * condOpenMeteo is preferred (native degrees); cond (Swelleye, manual) only
 * has compass points, so it's converted and used as a fallback. Tide
 * banding needs a day's min/max which neither source in this app currently
 * supplies (see CLAUDE.md — Open-Meteo tide isn't wired up, and Swelleye's
 * manual `cond.tideM` has no day range) — computeFit already degrades that
 * to "unknown" rather than guessing.
 */
export function computeSessionFit(spot: Spot | undefined, session: Session): SpotFit | null {
  if (!spot?.facing) return null;

  const om = session.condOpenMeteo;
  const manual = session.cond;

  const swellDirDeg = om?.swellDirDeg ?? (manual?.swellDir ? compassToDeg(manual.swellDir) : null);
  const windDirDeg = om?.windDirDeg ?? (manual?.windDir ? compassToDeg(manual.windDir) : null);
  const swellHeightM = om?.swellHeightM ?? manual?.swellHeightM ?? null;
  const windSpeedMs = om?.windSpeedMs ?? manual?.windSpeedMs ?? null;
  const windWaveHeightM = om?.windWaveHeightM ?? null;

  if (swellDirDeg == null && windDirDeg == null) return null;

  return computeFit(spot, {
    swellDirDeg,
    swellHeightM,
    windDirDeg,
    windSpeedMs,
    windWaveHeightM,
    tideM: null,
    tideDayMinM: null,
    tideDayMaxM: null,
  });
}
