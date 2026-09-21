/**
 * Turns a computed SpotFit into short description strings — NEVER a score.
 * See CLAUDE.md "The unfalsifiability problem": these features are
 * plausible and physically reasoned but have no outcome variable to test
 * against yet (that's what the `rating` field on a session is for). A number
 * that looks authoritative and has never been tested is worse than no
 * number, so this file only ever returns descriptions.
 */
import type { SpotFit } from "./spot-fit";
import type { Lang } from "./i18n";

const TIDE_BAND_ZH = { low: "低潮", mid: "中潮", high: "高潮" } as const;

export function fitDescriptions(fit: SpotFit, lang: Lang = "en"): string[] {
  const zh = lang === "zh-TW";
  const out: string[] = [];
  const say = (en: string, zhText: string) => out.push(zh ? zhText : en);

  if (fit.inSwellWindow === true) say("inside the usual swell window", "在常見的湧浪方向範圍內");
  else if (fit.inSwellWindow === false) say("outside the usual swell window", "不在常見的湧浪方向範圍內");

  if (!fit.missing.includes("swellDirDeg") && !fit.missing.includes("spot.facing")) {
    if (fit.exposure <= 0.15) say("side-on to the swell, mostly blocked", "側對湧浪，大多被擋住");
    else if (fit.exposure <= 0.5) say("side-on to the swell", "側對湧浪");
    else if (fit.exposure >= 0.9) say("square-on to the swell", "正對湧浪");
  }

  if (!fit.missing.includes("windDirDeg")) {
    if (fit.windMode === "offshore") say("offshore wind — cleaner face", "離岸風，浪面較乾淨");
    else if (fit.windMode === "cross-offshore") say("mostly offshore wind", "偏離岸風");
    else if (fit.windMode === "onshore") say("onshore wind — likely blown out", "向岸風，浪況可能較亂");
    else if (fit.windMode === "cross-onshore") say("mostly onshore wind", "偏向岸風");
  }
  if (fit.windMatchesBest === true) say("wind matches the published best window", "風向符合最佳風向");

  if (fit.tideBand && fit.tideMatchesBest === true) say("tide suits this break", "潮位適合這個浪點");
  else if (fit.tideBand && fit.tideMatchesBest === false)
    say(
      `tide (${fit.tideBand}) outside the usual window`,
      `潮位（${TIDE_BAND_ZH[fit.tideBand]}）不在常見範圍內`
    );

  if (fit.junkRatio != null && fit.junkRatio >= 1) say("wind chop on top of the swell", "湧浪上疊著風浪");

  return out;
}
