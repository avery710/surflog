/**
 * Everything the share surfaces display, as plain strings, derived from a
 * session with the same rules as the session card (components/entry-card.tsx):
 * Open-Meteo tiles, CWA-first tide trend + next turning point
 * (lib/tide-display.ts), the Beaufort wind label (lib/wind-strength.ts),
 * the shore word from spot-fit, compass points and formatters from lib/.
 *
 * Used by three consumers, so the numbers cannot drift between them: the
 * share dialog's preview (via the image route), the PNG renderer
 * (lib/share-image.tsx) and the public /s/<token> page. Pure — no Supabase,
 * no React. It never carries ids, owner info, goal or raw condition blobs.
 */
import { toCompass } from "./openmeteo";
import { compassLabel, fmt1, fmtWhen } from "./format";
import { boardLabel } from "./boards";
import { computeSessionFit } from "./session-fit";
import { htmlToPlainText } from "./rich-text";
import { nextTideEvents, pickTide } from "./tide-display";
import { WIND_LEVELS, windLevelIndex } from "./wind-strength";
import { shareT, type ShareLang } from "./share-strings";
import type { Spot } from "./spots";
import type { Board, Session } from "./types";

export type ShareTileKey = "swell" | "period" | "wind" | "temp" | "tide";

export interface ShareTile {
  key: ShareTileKey;
  label: string;
  /** The big figure. */
  value: string;
  unit?: string;
  /** Small print under the figure, one entry per line. */
  lines: string[];
}

export interface ShareCardData {
  lang: ShareLang;
  spotName: string;
  /** "Fri 25 Sep 2026 · 16:00" / "2026年9月25日（週五） · 16:00" */
  whenLabel: string;
  tiles: ShareTile[];
  /** Brand + length, e.g. `Pyzel 6'2"`; null without a board. */
  boardName: string | null;
  /** Plain-text notes, bullets as "- "; empty string without notes. */
  notes: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ShareCardInput {
  session: Session;
  /** The catalogue spot, if the session's slug resolves to one (for the shore word). */
  spot?: Spot;
  /** Display name already resolved for `lang` (catalogue name, request name, free text). */
  spotName: string;
  board?: Pick<Board, "brand" | "lengthIn"> | null;
  lang: ShareLang;
}

export function buildShareCard({ session, spot, spotName, board, lang }: ShareCardInput): ShareCardData {
  const t = (k: Parameters<typeof shareT>[1], v?: Record<string, string | number>) => shareT(lang, k, v);
  const om = session.condOpenMeteo;
  const manual = session.cond;
  const tiles: ShareTile[] = [];

  if (om) {
    tiles.push({
      key: "swell",
      label: t("tile.swellOpenMeteo"),
      value: fmt1(om.swellHeightM) ?? "—",
      unit: "m",
      lines: [compassLabel(toCompass(om.swellDirDeg), lang)].filter((x): x is string => !!x),
    });
    if (om.swellPeriodS != null) {
      tiles.push({ key: "period", label: t("tile.period"), value: fmt1(om.swellPeriodS) ?? "—", unit: "s", lines: [] });
    }

    const fit = computeSessionFit(spot, session);
    const hasShore = !!fit && !fit.missing.includes("windDirDeg") && !fit.missing.includes("spot.facing");
    const windLines: string[] = [];
    if (om.windSpeedMs != null) {
      windLines.push(t(`wind.strength.${WIND_LEVELS[windLevelIndex(om.windSpeedMs, om.windGustMs)].key}`));
    }
    const dir = om.windDirDeg != null ? compassLabel(toCompass(om.windDirDeg), lang) : null;
    const shore = hasShore && fit ? t(`wind.mode.${fit.windMode}`) : null;
    if (dir || shore) windLines.push([dir, shore].filter(Boolean).join(" "));
    tiles.push({
      key: "wind",
      label: t("tile.wind"),
      value: fmt1(om.windSpeedMs) ?? "—",
      unit: "m/s",
      lines: windLines,
    });

    if (om.seaTempC != null || om.airTempC != null) {
      tiles.push({
        key: "temp",
        label: t("tile.temp"),
        value: fmt1(om.seaTempC) ?? "—",
        unit: "°C",
        lines: om.airTempC != null ? [t("tile.airTemp", { t: fmt1(om.airTempC) ?? "—" })] : [],
      });
    }
  } else if (manual) {
    // Sessions with typed-in readings and no Open-Meteo block: the card
    // shows swell and wind only.
    if (manual.swellHeightM != null || manual.swellPeriodS != null) {
      tiles.push({
        key: "swell",
        label: t("tile.swellOpenMeteo"),
        value: fmt1(manual.swellHeightM) ?? "—",
        unit: "m",
        lines: [compassLabel(manual.swellDir, lang)].filter((x): x is string => !!x),
      });
      if (manual.swellPeriodS != null) {
        tiles.push({ key: "period", label: t("tile.period"), value: fmt1(manual.swellPeriodS) ?? "—", unit: "s", lines: [] });
      }
    }
    if (manual.windSpeedMs != null) {
      tiles.push({
        key: "wind",
        label: t("tile.wind"),
        value: fmt1(manual.windSpeedMs) ?? "—",
        unit: "m/s",
        lines: [compassLabel(manual.windDir, lang)].filter((x): x is string => !!x),
      });
    }
  }

  // Tide: the card's headline is rising/falling plus the next turning point.
  const tide = pickTide(session);
  if (tide.source) {
    const next = nextTideEvents(tide.events, session.when, 1)[0];
    const lines: string[] = [];
    if (next) {
      const shift = next.time.slice(0, 10) === session.when.slice(0, 10) ? "" : ` ${t("tide.nextDay")}`;
      const h = fmt1(next.heightM);
      lines.push(`${t(next.type === "high" ? "tide.high" : "tide.low")} ${next.time.slice(11, 16)}${shift}${h != null ? ` · ${h} m` : ""}`);
    }
    tiles.push({
      key: "tide",
      label: t("tile.tideOpenMeteo"),
      value: tide.trend ? capitalize(t(tide.trend === "rising" ? "tide.rising" : "tide.falling")) : "—",
      lines,
    });
  }

  return {
    lang,
    spotName: spotName || t("share.unknownSpot"),
    whenLabel: fmtWhen(session.when, lang),
    tiles,
    boardName: board ? boardLabel(board) || null : null,
    notes: htmlToPlainText(session.notesHtml || "") || session.notes?.trim() || "",
  };
}
