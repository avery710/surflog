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
import { WIND_DOT_HEX, WIND_LEVELS, windLevelIndex } from "./wind-strength";
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
  /** A flat colour dot drawn before the FIRST line (wind strength). */
  dot?: string;
  /** Small print under the figure, one entry per line. */
  lines: string[];
}

/** One paragraph or list item of the notes, for the images. `marker` is "•"
 *  for a bullet or "1." for an ordered item, null for a plain paragraph. */
export interface NoteBlock {
  marker: string | null;
  text: string;
}

const decodeEntities = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Notes as blocks: <ul> items become "•", <ol> items "1." "2." ..., every
 *  other block boundary or <br> starts a new line. Bold/italic stay plain.
 *  Falls back to the plain-text mirror ("- " lines become bullets). */
export function notesBlocks(html: string, plain: string): NoteBlock[] {
  const out: NoteBlock[] = [];
  if (html.trim()) {
    let cur = "";
    let marker: string | null = null;
    const lists: { ordered: boolean; n: number }[] = [];
    const flush = () => {
      const text = decodeEntities(cur).replace(/\s+/g, " ").trim();
      if (text) out.push({ marker, text });
      cur = "";
    };
    for (const m of html.matchAll(/<(\/?)([a-zA-Z0-9]+)[^>]*>|([^<]+)/g)) {
      if (m[3] != null) {
        cur += m[3];
        continue;
      }
      const close = m[1] === "/";
      const tag = m[2].toLowerCase();
      if (tag === "br") flush();
      else if (tag === "ul" || tag === "ol") {
        flush();
        if (close) lists.pop();
        else lists.push({ ordered: tag === "ol", n: 0 });
      } else if (tag === "li") {
        flush();
        if (close) marker = null;
        else {
          const top = lists[lists.length - 1];
          marker = top?.ordered ? `${++top.n}.` : "•";
        }
      } else if (tag === "p" || tag === "div") flush();
    }
    flush();
    if (out.length) return out;
  }
  for (const line of plain.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const b = t.match(/^[-•]\s+(.*)$/);
    out.push({ marker: b ? "•" : null, text: b ? b[1] : t });
  }
  return out;
}

/** A mini tide curve, normalised: x and y both 0..1 (y 0 = lowest), `now` is
 *  the session time's x. Cosine-interpolated between the stored turning points. */
export interface ShareTideCurve {
  points: [number, number][];
  now: number;
  nowY: number;
}

export interface ShareCardData {
  lang: ShareLang;
  spotName: string;
  /** "Fri 25 Sep 2026 · 16:00" / "2026年9月25日（週五） · 16:00" */
  whenLabel: string;
  tiles: ShareTile[];
  /** The slimmer set the share IMAGES draw (2026-10-08): swell height only, wind
   *  speed + strength (coloured dot + word) + shore word, water temp only, and the tide as its curve only
   *  (a tile with no value, drawn from `tideCurve`; absent
   *  without a curve). */
  imageTiles: ShareTile[];
  /** Brand + length, e.g. `Pyzel 6'2"`; null without a board. */
  boardName: string | null;
  /** Plain-text notes, bullets as "- "; empty string without notes. */
  notes: string;
  /** The same notes as blocks, with list markers (the images use this). */
  notesBlocks: NoteBlock[];
  /** Mini tide curve with the session-time marker; null without 2+ events. */
  tideCurve: ShareTideCurve | null;
  /** The board's photo as a data URI (or URL in the browser). Set only by the
   *  owner's own routes; never by anything public. */
  boardPhoto?: string | null;
}

const toMin = (t: string) => Date.parse(`${t.slice(0, 16)}:00Z`) / 60000;

/** Curve through the stored tide events within ~9 h of the session. */
export function tideCurve(events: { type: "high" | "low"; time: string; heightM: number | null }[], when: string): ShareTideCurve | null {
  const ev = events
    .filter((e): e is typeof e & { heightM: number } => e.heightM != null)
    .sort((a, b) => a.time.localeCompare(b.time));
  if (ev.length < 2) return null;
  const now = toMin(when);
  const t0 = Math.max(toMin(ev[0].time), now - 9 * 60);
  const t1 = Math.min(toMin(ev[ev.length - 1].time), now + 9 * 60);
  if (!(t1 - t0 > 60) || now < t0 || now > t1) return null;
  const hAt = (t: number) => {
    let i = 0;
    while (i < ev.length - 2 && toMin(ev[i + 1].time) < t) i++;
    const a = toMin(ev[i].time);
    const b = toMin(ev[i + 1].time);
    const u = Math.min(1, Math.max(0, (t - a) / (b - a || 1)));
    return ev[i].heightM + (ev[i + 1].heightM - ev[i].heightM) * ((1 - Math.cos(Math.PI * u)) / 2);
  };
  const ts: number[] = [];
  for (let t = t0; t < t1; t += 20) ts.push(t);
  ts.push(t1);
  const hs = ts.map(hAt);
  const lo = Math.min(...hs);
  const range = Math.max(0.05, Math.max(...hs) - lo);
  const y = (h: number) => (h - lo) / range;
  return {
    points: ts.map((t, i) => [(t - t0) / (t1 - t0), y(hs[i])]),
    now: (now - t0) / (t1 - t0),
    nowY: y(hAt(now)),
  };
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
  let shoreWord: string | null = null;
  let windStrength: { word: string; dot: string } | null = null;

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
      const key = WIND_LEVELS[windLevelIndex(om.windSpeedMs, om.windGustMs)].key;
      windLines.push(t(`wind.strength.${key}`));
      windStrength = { word: t(`wind.strength.${key}`), dot: WIND_DOT_HEX[key] };
    }
    const dir = om.windDirDeg != null ? compassLabel(toCompass(om.windDirDeg), lang) : null;
    const shore = hasShore && fit ? t(`wind.mode.${fit.windMode}`) : null;
    shoreWord = shore;
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

  const curve = tide.source ? tideCurve(tide.events, session.when) : null;
  const imageTiles: ShareTile[] = tiles
    .filter((x) => x.key !== "tide")
    .map((x) =>
      x.key === "wind"
        ? { ...x, lines: [...(windStrength ? [windStrength.word] : []), ...(shoreWord ? [shoreWord] : [])], ...(windStrength ? { dot: windStrength.dot } : {}) }
        : { ...x, lines: [] }
    );
  if (curve) {
    // just the curve and the session dot (the Rising/Falling word was removed)
    imageTiles.push({ key: "tide", label: t("tile.tideOpenMeteo"), value: "", lines: [] });
  }

  return {
    lang,
    spotName: spotName || t("share.unknownSpot"),
    whenLabel: fmtWhen(session.when, lang),
    tiles,
    imageTiles,
    boardName: board ? boardLabel(board) || null : null,
    tideCurve: curve,
    notes: htmlToPlainText(session.notesHtml || "") || session.notes?.trim() || "",
    notesBlocks: notesBlocks(session.notesHtml || "", session.notes?.trim() || ""),
  };
}
