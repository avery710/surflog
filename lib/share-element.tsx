/**
 * The share images' element and layout. One builder for every consumer — the
 * PNG renderer (lib/share-image.tsx, next/og / satori) and the landing page,
 * which puts the same element straight into the DOM — so they cannot drift.
 * No server-only imports: this file is bundled for the browser.
 *
 * Kinds (reworked 2026-10-08; the dark-plate sticker and the tile-grid card
 * are gone). All of them draw `data.imageTiles`, the slim set: swell height,
 * period, wind speed + shore word, water temp, and the tide as ONLY a curve
 * with a dot at the session time. The spot is always shown.
 * - "strip": ONLY the wave tiles (joined by necks) and the board chip are solid
 *   shapes on a TRANSPARENT canvas, with their TEXT KNOCKED OUT (stencil: the
 *   photo shows through the letters). Light = white shapes, dark = near-black.
 *   Spot, date, notes and the wordmark are plain white (light) / black (dark)
 *   text straight on the canvas with a soft glow, like the column. satori has no destination-out, so the
 *   renderer draws the stencil text in a FLAG colour and lib/share-knockout.ts
 *   turns those pixels transparent afterwards (the board photo likewise goes
 *   in over a green placeholder disc). Without `style.knockout` (the landing
 *   page, in the DOM) the text is just solid ink.
 * - "column": text only on a transparent canvas, the data stacked
 *   (label over value). Light = white text, dark = near-black, each with a soft
 *   glow of the opposite colour.
 * - "card": also a sticker (2026-10-08): ~1080 wide, height from the content,
 *   transparent canvas around a solid white card (tiles in ONE row joined by
 *   necks, board chip, notes, logo). Ignores the tone: always white card, black text.
 * - "og": 1200x630 cut of the card for link previews, on the blue Surflog
 *   field (not a sticker).
 * Which parts appear (date and time, waves, board, notes) is a ShareParts;
 * the layout re-flows around what is off.
 *
 * Satori limits observed here: every multi-child node is display:flex, no
 * CSS grid, text is laid out per line by us (lib/share-text.ts), styles are
 * inline objects, no SVG filters.
 */
import type { ReactElement } from "react";
import { flatNeckPath } from "@/components/pill-neck";
import { glyphWidthEm, wrapText } from "./share-text";
import { shareT } from "./share-strings";
import { ALL_PARTS, type ShareParts } from "./share-parts";
import type { NoteBlock, ShareCardData, ShareTile, ShareTideCurve } from "./share-card-data";

export type ShareVariant = "strip" | "column" | "card" | "story" | "og";

export function isShareVariant(v: unknown): v is ShareVariant {
  return v === "strip" || v === "column" || v === "card" || v === "story" || v === "og";
}

/** Text colour of strip/column: light = white (dark photos), dark = near-black. */
export type ShareTone = "light" | "dark";

export function isShareTone(v: unknown): v is ShareTone {
  return v === "light" || v === "dark";
}

/** Where the wordmark images live. Server: data URIs read from public/
 *  (lib/share-image.tsx); browser: the public URLs. `black` is the original
 *  file (for light backgrounds), `white` the pre-rendered white copy. */
export interface ShareLogos {
  black: string;
  white: string;
}

/** Family names as satori knows them (lib/share-fonts.ts). In the DOM the
 *  app's next/font families have generated names, so the page passes its own. */
export interface ShareFontFamilies {
  sans: string;
  mono: string;
}

/** Stencil colours (strip). Text is drawn in FLAG and turned transparent by
 *  lib/share-knockout.ts; the board photo sits over a PHOTO disc. */
export const KNOCKOUT = {
  flag: "#ff00ff",
  photo: "#00ff00",
  shape: { light: "#ffffff", dark: "#0b0d12" },
} as const;

export interface ShareStyle {
  /** strip: draw text in the stencil flag colour (the PNG renderer post-processes). */
  knockout?: boolean;
  /** strip / column only. Default "light". */
  tone?: ShareTone;
  /** Without it the wordmark falls back to plain text. */
  logos?: ShareLogos;
  fonts?: ShareFontFamilies;
}

/** public/surflog-logo.png pixel size. */
export const LOGO_ASPECT = 1200 / 228;

/** How many lines of notes each kind draws (wrapped lines, list items
 *  included), then it cuts with "…". One number per kind, to be tuned. */
export const NOTE_MAX_LINES: Record<ShareVariant, number> = { strip: 8, column: 10, card: 14, story: 14, og: 2 };

type Kind = "strip" | "column" | "card";

interface Metrics {
  kind: Kind;
  W: number;
  /** null = computed from the content. */
  H: number | null;
  margin: number;
  pad: number;
  name: number;
  nameLines: number;
  date: number;
  label: number;
  fig: number;
  unit: number;
  small: number;
  notes: number;
  /** Board chip scale: the session card's chip is 30px, this many times. */
  chip: number;
  /** Card tiles only. */
  tileH: number;
  tilePadX: number;
  gap: number;
  /** Solid Surflog-blue field around the card (og only). */
  frame: boolean;
  /** Mini tide curve box, or null to not draw one. */
  curve: { w: number; h: number } | null;
}

const METRICS: Record<ShareVariant, Metrics> = {
  strip: { kind: "strip", W: 1080, H: null, margin: 44, pad: 0, name: 48, nameLines: 1, date: 28, label: 22, fig: 36, unit: 19, small: 19, notes: 32, chip: 1.9, tileH: 160, tilePadX: 16, gap: 14, frame: false, curve: { w: 150, h: 56 } },
  column: { kind: "column", W: 760, H: null, margin: 40, pad: 0, name: 60, nameLines: 2, date: 30, label: 24, fig: 46, unit: 22, small: 24, notes: 32, chip: 1.9, tileH: 0, tilePadX: 0, gap: 0, frame: false, curve: { w: 300, h: 70 } },
  card: { kind: "card", W: 1080, H: null, margin: 20, pad: 36, name: 76, nameLines: 2, date: 34, label: 19, fig: 28, unit: 15, small: 17, notes: 38, chip: 1.9, tileH: 150, tilePadX: 14, gap: 14, frame: false, curve: { w: 150, h: 52 } },
  // The Story: the Card's layout, centred on a full-bleed 9:16 background (a photo or blue).
  story: { kind: "card", W: 1080, H: 1920, margin: 48, pad: 36, name: 76, nameLines: 2, date: 34, label: 19, fig: 28, unit: 15, small: 17, notes: 38, chip: 1.9, tileH: 150, tilePadX: 14, gap: 14, frame: false, curve: { w: 150, h: 52 } },
  og: { kind: "card", W: 1200, H: 630, margin: 28, pad: 36, name: 52, nameLines: 1, date: 26, label: 19, fig: 30, unit: 16, small: 16, notes: 26, chip: 1.5, tileH: 138, tilePadX: 14, gap: 14, frame: true, curve: { w: 112, h: 44 } },
};

interface Theme {
  text: string;
  muted: string;
  tile: string;
  plate: string;
  chip: string;
  chipText: string;
  /** satori supports text-shadow; "none" on the solid card. */
  textShadow: string;
  logo: "white" | "black";
  /** Solid text colour for runs that are never stenciled (notes plate). */
  ink: string;
}

const THEMES: Record<"light" | "dark" | "card", Theme> = {
  light: { text: "#ffffff", muted: "rgba(255, 255, 255, 0.82)", tile: "transparent", plate: "transparent", chip: "#ffffff", chipText: "#0b0d12", textShadow: "0 2px 14px rgba(0, 0, 0, 0.55), 0 1px 3px rgba(0, 0, 0, 0.45)", logo: "white", ink: "#ffffff" },
  dark: { text: "#0b0d12", muted: "rgba(11, 13, 18, 0.74)", tile: "transparent", plate: "transparent", chip: "#0b0d12", chipText: "#ffffff", textShadow: "0 1px 12px rgba(255, 255, 255, 0.6), 0 0 2px rgba(255, 255, 255, 0.5)", logo: "black", ink: "#0b0d12" },
  card: { text: "#0b0d12", muted: "#5b6470", tile: "#f2f5f5", plate: "#ffffff", chip: "#f2f5f5", chipText: "#0b0d12", textShadow: "none", logo: "black", ink: "#0b0d12" },
};

/** The Card sticker's themes (2026-10-08): a ~88% opaque card so the photo
 *  faintly shows through. Light = white card, dark ink. Dark = near-black card,
 *  light ink; tiles and the chip are a lighter shade of it so the necks and
 *  shapes still read. The og image stays on the solid white card. */
function cardTheme(tone: ShareTone, solid: boolean): Theme {
  if (solid) return THEMES.card;
  if (tone === "light") return { ...THEMES.card, plate: "rgba(255, 255, 255, 0.88)" };
  return { text: "#ffffff", muted: "rgba(255, 255, 255, 0.72)", tile: CARD_DARK_SHAPE, plate: "rgba(11, 13, 18, 0.88)", chip: CARD_DARK_SHAPE, chipText: "#ffffff", textShadow: "none", logo: "white", ink: "#ffffff" };
}

/** Strip: flat shapes in the tone's colour; text is solid ink or, when
 *  stenciling, the flag colour. */
function stripTheme(tone: ShareTone, knockout: boolean): Theme {
  const shape = KNOCKOUT.shape[tone];
  const ink = tone === "light" ? "#0b0d12" : "#ffffff";
  const muted = tone === "light" ? "#5b6470" : "rgba(255, 255, 255, 0.72)";
  return { text: knockout ? KNOCKOUT.flag : ink, muted: knockout ? KNOCKOUT.flag : muted, tile: shape, plate: "transparent", chip: shape, chipText: knockout ? KNOCKOUT.flag : ink, textShadow: "none", logo: tone === "light" ? "white" : "black", ink };
}

/** Strip and column: the strip's tiles and the board chip (both kinds) are translucent at this opacity. satori
 *  composites opacity per element (necks over tiles would double up), so the
 *  shapes are drawn opaque and lib/share-knockout.ts scales their alpha after,
 *  inside `ShareLayout.shapeBands`. Tune here. */
export const SHAPE_ALPHA = 0.8;
/** Card, Dark mode: tiles, necks and chip are white at ~18% over the near-black
 *  card, as the opaque equivalent (the card is 88% opaque over the photo) so the
 *  necks' overlaps can't show as denser patches. */
const CARD_DARK_SHAPE = "#37393d";

const BRAND_H = 44;
/** Wordmark height inside it; 1200x228 source. */
const LOGO_H = 34;
const BLOCK_GAP = 28;
const MONO_EM = 0.6;

/** One drawn line of notes; `marker` only on the first line of a list item,
 *  `indent` (px) on every line of one (the hanging indent). */
export interface NoteLine {
  marker: string | null;
  text: string;
  indent: number;
}

/** Wrap note blocks to `maxLines` lines in total, list items with a hanging
 *  indent. Past the limit the last line ends in "…". */
export function wrapNotes(blocks: NoteBlock[], widthPx: number, fontPx: number, maxLines: number): NoteLine[] {
  const out: NoteLine[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const indent = b.marker ? Math.round(fontPx * 1.15) : 0;
    const room = maxLines - out.length;
    const w = wrapText(b.text, widthPx - indent, fontPx, room);
    w.lines.forEach((text, j) => out.push({ marker: j === 0 ? b.marker : null, text, indent }));
    if (w.truncated) return out;
    if (out.length >= maxLines) {
      if (i < blocks.length - 1) {
        const last = out[out.length - 1];
        if (!last.text.endsWith("…")) last.text = `${last.text.replace(/[，。、；：,.;:\s]+$/, "")}…`;
      }
      return out;
    }
  }
  return out;
}

export interface ShareLayout {
  width: number;
  height: number;
  parts: ShareParts;
  nameLines: string[];
  noteLines: NoteLine[];
  tiles: ShareTile[];
  /** Draw the tide curve (the tide tile has no text, only this). */
  curve: boolean;
  /** Anything to say about the data when waves are on but there are none. */
  noConditions: boolean;
  /** Strip and column: [top, bottom) pixel rows holding only shapes (the tile row and the board chip), where the stencil step scales alpha by SHAPE_ALPHA. */
  shapeBands: [number, number][];
}

const lh = (px: number, f = 1.3) => Math.round(px * f);
const nameLH = (m: Metrics) => lh(m.name, 1.15);
const noteLH = (m: Metrics) => lh(m.notes, 1.45);
const chipH = (m: Metrics) => Math.round(30 * m.chip);

/** Estimated width of a mono figure: ASCII 0.6em, CJK one em. */
function monoEm(s: string): number {
  let w = 0;
  for (const ch of s) w += (ch.codePointAt(0) ?? 0) < 0x80 ? MONO_EM : 1;
  return w;
}
function sansEm(s: string): number {
  let w = 0;
  for (const ch of s) w += glyphWidthEm(ch);
  return w;
}

/** Natural width of one tile (without its padding), px. */
function itemWidth(t: ShareTile, m: Metrics): number {
  if (t.key === "tide") return Math.max(m.curve ? m.curve.w : 0, ...t.lines.map((l) => sansEm(l) * m.small));
  const value = monoEm(t.value) * m.fig + (t.unit ? 6 + sansEm(t.unit) * m.unit : 0);
  const lines = Math.max(0, ...t.lines.map((l, i) => sansEm(l) * m.small + (i === 0 && t.dot ? m.small * 0.9 : 0)));
  return Math.max(sansEm(t.label) * m.label, value, lines);
}

const STRIP_RADIUS = 30;

/** Strip, card and og put the date beside the spot (the session card's header); the column stacks them. */
const rowHeader = (m: Metrics) => m.kind !== "column";

/** Pure sizing: line breaks and the final pixel size. */
export function layoutShare(data: ShareCardData, variant: ShareVariant, parts: ShareParts = ALL_PARTS): ShareLayout {
  const m = METRICS[variant];
  const inner = m.W - 2 * m.margin - 2 * m.pad;
  // Strip and card: spot and date share one row, so the name gets what the date leaves.
  const nameRoom = rowHeader(m) ? inner - (parts.datetime ? sansEm(data.whenLabel) * m.date + 22 : 0) : inner;
  const nameLines = wrapText(data.spotName, nameRoom, m.name, rowHeader(m) ? 1 : m.nameLines).lines;
  const noteLines = parts.log && data.notesBlocks.length ? wrapNotes(data.notesBlocks, inner, m.notes, NOTE_MAX_LINES[variant]) : [];
  const tiles = parts.waves ? data.imageTiles : [];
  const noConditions = parts.waves && data.imageTiles.length === 0;
  const curve = !!data.tideCurve && !!m.curve && tiles.some((t) => t.key === "tide");

  const layout: ShareLayout = { width: m.W, height: m.H ?? 0, parts, nameLines, noteLines, tiles, curve, noConditions, shapeBands: [] };
  if (m.H == null) layout.height = Math.ceil(2 * m.margin + 2 * m.pad + contentHeight(m, layout, data));
  if (m.kind !== "card") layout.shapeBands = shapeBandsOf(m, layout, data);
  return layout;
}

function headerHeight(m: Metrics, l: ShareLayout): number {
  const hasName = l.nameLines.length > 0;
  const hasDate = l.parts.datetime;
  if (rowHeader(m)) return hasName ? nameLH(m) : hasDate ? lh(m.date * 1.2) : 0;
  return l.nameLines.length * nameLH(m) + (hasName && hasDate ? 6 : 0) + (hasDate ? lh(m.date) : 0);
}

function dataHeight(m: Metrics, l: ShareLayout): number {
  if (!l.parts.waves) return 0;
  if (!l.tiles.length) return l.noConditions ? lh(m.small) : 0;
  if (m.kind === "column") {
    const rows = l.tiles.map(
      (t) => lh(m.label) + 2 + (t.key === "tide" && l.curve && m.curve ? m.curve.h : lh(m.fig, 1.15)) + (t.key === "wind" ? 0 : t.lines.length * (lh(m.small) + 2))
    );
    return rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * 20;
  }
  return m.tileH;
}

function notesHeight(m: Metrics, l: ShareLayout): number {
  if (!l.noteLines.length) return 0;
  return l.noteLines.length * noteLH(m);
}

function contentHeight(m: Metrics, l: ShareLayout, data: ShareCardData): number {
  const blocks: number[] = [];
  const h = headerHeight(m, l);
  if (h) blocks.push(h);
  const d = dataHeight(m, l);
  if (d) blocks.push(d);
  if (l.parts.board && data.boardName) blocks.push(chipH(m));
  if (l.noteLines.length) blocks.push(notesHeight(m, l));
  blocks.push(BRAND_H);
  return blocks.reduce((a, b) => a + b, 0) + (blocks.length - 1) * BLOCK_GAP;
}

/** Where the shape-only blocks (strip: tile row and chip; column: the chip) sit vertically (same stacking as contentHeight). */
function shapeBandsOf(m: Metrics, l: ShareLayout, data: ShareCardData): [number, number][] {
  const bands: [number, number][] = [];
  let y = m.margin + m.pad;
  const push = (h: number, shape: boolean) => {
    if (!h) return;
    // padded a few px: the real stacked heights can differ slightly from the estimates, and the gaps hold no ink
    if (shape) bands.push([y - 8, y + h + 8]);
    y += h + BLOCK_GAP;
  };
  push(headerHeight(m, l), false);
  push(dataHeight(m, l), m.kind === "strip" && l.tiles.length > 0);
  push(l.parts.board && data.boardName ? chipH(m) : 0, true);
  return bands;
}

const SATORI_FONTS: ShareFontFamilies = {
  sans: "Funnel Sans, Noto Sans TC",
  mono: "IBM Plex Mono, Funnel Sans, Noto Sans TC",
};

// ---------------------------------------------------------------- pieces

/** The mini tide curve, and nothing else: past part muted, the rest solid, a
 *  dot at the session time. */
function TideCurve({ curve, w, h, c, stroke }: { curve: ShareTideCurve; w: number; h: number; c: Theme; stroke: number }) {
  const padX = 10;
  const padY = 10;
  const px = (x: number) => padX + x * (w - 2 * padX);
  const py = (y: number) => h - padY - y * (h - 2 * padY);
  const f = (n: number) => n.toFixed(1);
  const pts = curve.points;
  const nowIdx = pts.findIndex((p) => p[0] >= curve.now);
  const split = nowIdx < 0 ? pts.length : nowIdx;
  const dOf = (a: [number, number][]) => a.map((p, i) => `${i ? "L" : "M"}${f(px(p[0]))} ${f(py(p[1]))}`).join("");
  const past = [...pts.slice(0, split), [curve.now, curve.nowY] as [number, number]];
  const future = [[curve.now, curve.nowY] as [number, number], ...pts.slice(split)];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "flex" }}>
      <path d={dOf(past)} fill="none" stroke={c.muted} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d={dOf(future)} fill="none" stroke={c.text} strokeWidth={stroke + 0.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(curve.now)} cy={py(curve.nowY)} r={stroke * 2.1} fill={c.text} />
    </svg>
  );
}

/** One tile (strip and card): label over the figure and its small print. The
 *  tide tile carries only the curve. */
function Tile({ tile, m, c, mono, data, width, stroke }: { tile: ShareTile; m: Metrics; c: Theme; mono: string; data: ShareCardData; width: number; stroke: number }) {
  const isTide = tile.key === "tide";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: `${Math.round(width)}px`,
        minWidth: 0,
        height: m.tileH,
        padding: `${Math.round(m.tileH * 0.09)}px ${m.tilePadX}px`,
        borderRadius: m.kind === "strip" ? STRIP_RADIUS : 28,
        background: c.tile,
      }}
    >
      <div style={{ display: "flex", whiteSpace: "nowrap", fontSize: m.label, lineHeight: `${lh(m.label)}px`, fontWeight: 500, color: c.muted }}>{tile.label}</div>
      {isTide ? (
        data.tideCurve && m.curve ? (
          <div style={{ display: "flex", marginTop: 4 }}>
            <TideCurve curve={data.tideCurve} w={m.curve.w} h={m.curve.h} c={c} stroke={stroke} />
          </div>
        ) : null
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 4, color: c.text, whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", fontFamily: mono, fontWeight: 500, fontSize: m.fig, lineHeight: `${lh(m.fig, 1.15)}px` }}>{tile.value}</div>
          {tile.unit ? <div style={{ display: "flex", marginLeft: 6, fontSize: m.unit, fontWeight: 500, color: c.muted }}>{tile.unit}</div> : null}
        </div>
      )}
      {tile.lines.length ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
          {tile.lines.map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", fontSize: m.small, lineHeight: `${lh(m.small)}px`, fontWeight: 500, color: c.muted }}>
              {i === 0 && tile.dot ? <WindDot color={tile.dot} size={m.small} /> : null}
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The wind strength dot: a flat circle in the card's band colour. Solid in
 *  the strip too (it is not text, so it is not knocked out). */
function WindDot({ color, size }: { color: string; size: number }) {
  const d = Math.round(size * 0.7);
  return <div style={{ display: "flex", width: d, height: d, borderRadius: 999, background: color, marginRight: Math.round(size * 0.4), flexShrink: 0 }} />;
}

/** The session card's flat-to-flat neck between two tiles, scaled up. */
function TileNeck({ m, c }: { m: Metrics; c: Theme }) {
  const s = m.gap / 7; // the card's own 8px gap -> this gap
  const o = 8.5 * s;
  const H = Math.ceil(2 * o);
  const ov = Math.ceil(s);
  return (
    <div style={{ display: "flex", width: m.gap, alignItems: "center", flexShrink: 0 }}>
      <svg width={m.gap + 2 * ov} height={H} viewBox={`${-ov} 0 ${m.gap + 2 * ov} ${H}`} style={{ display: "flex", marginLeft: -ov, marginRight: -ov }}>
        <path d={flatNeckPath("horizontal", 0, m.gap, H / 2, s)} fill={c.tile} />
      </svg>
    </div>
  );
}

/** The session card's board chip: photo in a circle, a stem, the name pill.
 *  Flat shapes (geometry of PillNeck's horizontal neck, scaled). No photo =
 *  the plain pill. Opaque fills, so the stem's overlap with the shapes
 *  can't show as a darker band. `photoDisc` (stencil mode) swaps the photo for
 *  a flat disc the renderer later paints the real photo over. */
function BoardChip({ name, photo, photoDisc, m, c, sans }: { name: string; photo?: string | null; photoDisc?: boolean; m: Metrics; c: Theme; sans?: string }) {
  const k = m.chip;
  const H = Math.round(30 * k);
  const pillH = Math.round(28 * k);
  const font = Math.round(13.5 * k);
  const pill = (
    <div
      style={{
        display: "flex",
        height: pillH,
        alignItems: "center",
        padding: `0 ${Math.round(14 * k)}px 0 ${Math.round(12 * k)}px`,
        borderRadius: 999,
        background: c.chip,
        color: c.chipText,
        textShadow: "none",
        fontSize: font,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...(sans ? { fontFamily: sans } : {}),
      }}
    >
      {name}
    </div>
  );
  if (!photo) return <div style={{ display: "flex", height: H, alignItems: "center" }}>{pill}</div>;
  const inner = Math.round(22 * k);
  return (
    <div style={{ display: "flex", position: "relative", height: H, alignItems: "center" }}>
      <svg width={8.6 * k} height={H} viewBox="28 0 8.6 30" style={{ display: "flex", position: "absolute", left: 28 * k, top: 0 }}>
        <path d="M28.23 7.92A3 3 0 0 0 30.87 9.5L32.8 9.5A3 3 0 0 0 35.4 8L35.4 22A3 3 0 0 0 32.8 20.5L30.87 20.5A3 3 0 0 0 28.23 22.08Z" fill={c.chip} />
      </svg>
      <div style={{ display: "flex", width: H, height: H, alignItems: "center", justifyContent: "center", borderRadius: 999, background: c.chip, flexShrink: 0 }}>
        {photoDisc ? (
          <div style={{ display: "flex", width: inner, height: inner, borderRadius: 999, background: KNOCKOUT.photo }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- satori / foreignObject, not next/image
          <img src={photo} alt="" width={inner} height={inner} style={{ width: inner, height: inner, borderRadius: 999, objectFit: "cover" }} />
        )}
      </div>
      <div style={{ display: "flex", marginLeft: 3.5 * k }}>{pill}</div>
    </div>
  );
}

// ---------------------------------------------------------------- element

/** The element satori draws; `layout` comes from layoutShare(). */
export function shareElement(data: ShareCardData, variant: ShareVariant, layout: ShareLayout, style: ShareStyle = {}): ReactElement {
  const m = METRICS[variant];
  const fonts = style.fonts ?? SATORI_FONTS;
  const isCard = m.kind === "card";
  const isStrip = m.kind === "strip";
  const tone = style.tone ?? "light";
  const isColumn = m.kind === "column";
  // Strip and column: shapes at SHAPE_ALPHA with knocked-out text (strip: tiles + chip; column: the chip only).
  const knock = (isStrip || isColumn) && !!style.knockout;
  // `c` themes the solid shapes (strip: tiles + chip; card: everything).
  // `plain` themes text drawn straight on the canvas (strip header, notes).
  const c = isCard ? cardTheme(tone, m.frame) : isStrip ? stripTheme(tone, knock) : THEMES[tone];
  const plain = isStrip ? THEMES[tone] : c;
  const logo = style.logos ? style.logos[plain.logo] : null;
  const { parts } = layout;

  const hasName = layout.nameLines.length > 0;
  const hasDate = parts.datetime;
  // Dark tone: the date is near-black ink in strip and column (2026-10-08). On the
  // Card's near-black dark card black would vanish, so there it stays the light muted ink.
  const dateColor = isCard || tone === "light" ? plain.muted : "#0b0d12";
  const nameStyle = (size: number) => ({ display: "flex", whiteSpace: "nowrap" as const, fontSize: size, lineHeight: `${nameLH(m)}px`, fontWeight: 700, letterSpacing: -1 });
  const dateEl = (size: number, extra = {}) => (
    <div style={{ display: "flex", whiteSpace: "nowrap", flexShrink: 0, fontSize: size, lineHeight: `${lh(size)}px`, fontWeight: 500, color: dateColor, ...extra }}>{data.whenLabel}</div>
  );

  let header: ReactElement | null = null;
  if (hasName || hasDate) {
    if (rowHeader(m)) {
      header = (
        <div style={{ display: "flex", alignItems: "baseline", color: plain.text, textShadow: plain.textShadow }}>
          {hasName ? <div style={{ ...nameStyle(m.name), marginRight: hasDate ? 22 : 0 }}>{layout.nameLines[0]}</div> : null}
          {hasDate ? dateEl(m.date) : null}
        </div>
      );
    } else {
      header = (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {layout.nameLines.map((line, i) => (
            <div key={i} style={nameStyle(m.name)}>{line}</div>
          ))}
          {hasDate ? dateEl(m.date, { marginTop: hasName ? 6 : 0 }) : null}
        </div>
      );
    }
  }

  let dataBlock: ReactElement | null = null;
  if (parts.waves) {
    if (layout.tiles.length === 0) {
      dataBlock = layout.noConditions ? (
        <div style={{ display: "flex", fontSize: m.small, lineHeight: `${lh(m.small)}px`, color: plain.muted }}>{shareT(data.lang, "share.image.noConditions")}</div>
      ) : null;
    } else if (m.kind === "column") {
      dataBlock = (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {layout.tiles.map((t) => (
            <div key={t.key} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: m.label, lineHeight: `${lh(m.label)}px`, fontWeight: 500, color: c.muted }}>{t.label}</div>
              {t.key === "tide" ? (
                layout.curve && data.tideCurve && m.curve ? (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 2, width: m.curve.w }}>
                    <TideCurve curve={data.tideCurve} w={m.curve.w} h={m.curve.h} c={c} stroke={4} />
                    {t.lines.map((line, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "flex-end", whiteSpace: "nowrap", marginTop: 2, paddingRight: 10, fontSize: m.small, lineHeight: `${lh(m.small)}px`, fontWeight: 500, color: c.muted }}>
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null
              ) : (
                <div style={{ display: "flex", alignItems: "center", marginTop: 2, whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <div style={{ display: "flex", fontFamily: fonts.mono, fontWeight: 700, fontSize: m.fig, lineHeight: `${lh(m.fig, 1.15)}px` }}>{t.value}</div>
                    {t.unit ? <div style={{ display: "flex", marginLeft: 6, fontSize: m.unit, fontWeight: 500, color: c.muted }}>{t.unit}</div> : null}
                  </div>
                  {t.lines.length ? (
                    // wind: the strength (dot + word) over the shore word, to the right of the speed
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginLeft: 22 }}>
                      {t.lines.map((line, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", fontSize: m.small, lineHeight: `${lh(m.small)}px`, fontWeight: 500, color: c.muted }}>
                          {i === 0 && t.dot ? <WindDot color={t.dot} size={m.small} /> : null}
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    } else {
      const row = (th: Theme) => (
        <div style={{ display: "flex", width: "100%" }}>
          {layout.tiles.flatMap((t, i) => [
            ...(i > 0 ? [<TileNeck key={`n-${t.key}`} m={m} c={th} />] : []),
            <Tile key={t.key} tile={t} m={m} c={th} mono={fonts.mono} data={data} width={itemWidth(t, m) + 2 * m.tilePadX} stroke={isStrip ? 4 : 3} />,
          ])}
        </div>
      );
      dataBlock = row(c);
    }
  }

  const shapeTheme = isStrip || isColumn ? stripTheme(tone, knock) : c;
  const chip = (th: Theme) => <BoardChip name={data.boardName ?? ""} photo={data.boardPhoto} photoDisc={knock} m={m} c={th} sans={fonts.sans} />;
  const board = parts.board && data.boardName ? chip(shapeTheme) : null;
  const noteLines = layout.noteLines.map((line, i) => (
    <div key={i} style={{ display: "flex", whiteSpace: "pre", fontSize: m.notes, lineHeight: `${noteLH(m)}px`, fontWeight: 500 }}>
      {line.indent ? <div style={{ display: "flex", width: line.indent, flexShrink: 0 }}>{line.marker ?? ""}</div> : null}
      {line.text}
    </div>
  ));
  const notes =
    layout.noteLines.length > 0 ? (
      <div style={{ display: "flex", flexDirection: "column", color: plain.text, textShadow: plain.textShadow }}>{noteLines}</div>
    ) : null;

  const brand = (
    <div style={{ display: "flex", height: BRAND_H, alignItems: "center" }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori / foreignObject, not next/image
        <img src={logo} alt="Surflog" width={Math.round(LOGO_H * LOGO_ASPECT)} height={LOGO_H} style={{ display: "flex", height: LOGO_H, width: Math.round(LOGO_H * LOGO_ASPECT) }} />
      ) : (
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1, color: isCard ? "#0018ff" : plain.ink }}>Surflog</div>
      )}
    </div>
  );

  const blocks = [header, dataBlock, board, notes].filter((b): b is ReactElement => !!b);
  const body: ReactElement[] = [];
  blocks.forEach((b, i) => {
    body.push(
      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginTop: i ? BLOCK_GAP : 0, ...(m.kind === "column" ? {} : { width: "100%" }) }}>
        {b}
      </div>
    );
  });

  const isStory = variant === "story";
  return (
    <div
      style={{
        display: "flex",
        width: layout.width,
        height: layout.height,
        padding: m.margin,
        // strip / column: no background at all, so the PNG keeps its alpha channel
        ...(m.frame || isStory ? { background: "#0018ff" } : {}),
        // story: the card sits in the middle of the 9:16 frame (clear of Instagram's top and bottom bars)
        ...(isStory ? { flexDirection: "column" as const, justifyContent: "center", position: "relative" as const } : {}),
        fontFamily: fonts.sans,
      }}
    >
      {isStory && data.coverPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori / foreignObject, not next/image
        <img src={data.coverPhoto} alt="" width={layout.width} height={layout.height} style={{ position: "absolute", top: 0, left: 0, width: layout.width, height: layout.height, objectFit: "cover" }} />
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          ...(isStory ? {} : { height: "100%" }),
          padding: m.pad,
          borderRadius: 56,
          background: c.plate,
          color: c.text,
          ...(isStrip ? {} : { textShadow: c.textShadow }),
        }}
      >
        {body}
        <div style={{ display: "flex", flexGrow: 1, minHeight: body.length ? BLOCK_GAP : 0 }} />
        {brand}
      </div>
    </div>
  );
}

/** Every character drawn, for the font subset request. */
export function textOf(data: ShareCardData, layout: ShareLayout): string {
  return [
    ...layout.nameLines,
    data.whenLabel,
    ...data.imageTiles.flatMap((t) => [t.label, t.value, t.unit ?? "", ...t.lines]),
    data.boardName ?? "",
    shareT(data.lang, "share.image.noConditions"),
    ...layout.noteLines.map((l) => l.text),
    "Surflog 0123456789 .,:·+−-–—…°/•",
  ].join("");
}
