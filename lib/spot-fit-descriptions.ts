/**
 * Turns a computed SpotFit into short description strings — NEVER a score.
 * See CLAUDE.md "The unfalsifiability problem": these features are
 * plausible and physically reasoned but have no outcome variable to test
 * against yet (that's what the `rating` field on a session is for). A number
 * that looks authoritative and has never been tested is worse than no
 * number, so this file only ever returns descriptions.
 */
import type { SpotFit } from "./spot-fit";

export function fitDescriptions(fit: SpotFit): string[] {
  const out: string[] = [];

  if (fit.inSwellWindow === true) out.push("inside the usual swell window");
  else if (fit.inSwellWindow === false) out.push("outside the usual swell window");

  if (!fit.missing.includes("swellDirDeg") && !fit.missing.includes("spot.facing")) {
    if (fit.exposure <= 0.15) out.push("side-on to the swell, mostly blocked");
    else if (fit.exposure <= 0.5) out.push("side-on to the swell");
    else if (fit.exposure >= 0.9) out.push("square-on to the swell");
  }

  if (!fit.missing.includes("windDirDeg")) {
    if (fit.windMode === "offshore") out.push("offshore wind — cleaner face");
    else if (fit.windMode === "cross-offshore") out.push("mostly offshore wind");
    else if (fit.windMode === "onshore") out.push("onshore wind — likely blown out");
    else if (fit.windMode === "cross-onshore") out.push("mostly onshore wind");
  }
  if (fit.windMatchesBest === true) out.push("wind matches the published best window");

  if (fit.tideBand && fit.tideMatchesBest === true) out.push("tide suits this break");
  else if (fit.tideBand && fit.tideMatchesBest === false)
    out.push(`tide (${fit.tideBand}) outside the usual window`);

  if (fit.junkRatio != null && fit.junkRatio >= 1)
    out.push("wind chop on top of the swell");

  return out;
}
