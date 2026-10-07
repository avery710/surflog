/**
 * The share images, drawn with next/og (satori -> PNG). One element builder
 * for both consumers — the owner's preview/download route and the public
 * link-preview route — so they cannot drift.
 *
 * Variants:
 * - "sticker": a self-contained dark rounded card, ~84% opaque, on a fully
 *   TRANSPARENT canvas, white text. The user pastes it over their own photo
 *   or video in an Instagram story. A dark translucent plate with white text
 *   reads on a bright beach photo and on a dark night shot alike; text drawn
 *   straight onto the photo (Strava-style, white + shadow) fails on sky and
 *   sea glare. Height depends on the notes, so it is computed.
 * - "card": 1080x1350 (Instagram's 4:5 portrait), solid: Surflog blue field,
 *   white card inside — the app's own header/panel look.
 * - "og": 1200x630 landscape cut of the card for link previews (chat apps
 *   and X crop a portrait image badly). Notes limited to two lines.
 *
 * Satori limits observed here: every multi-child node is display:flex, no
 * CSS grid, text is laid out per line by us (lib/share-text.ts), styles are
 * inline objects.
 */
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { tileRows, wrapText } from "./share-text";
import { loadShareFonts } from "./share-fonts";
import { shareT } from "./share-strings";
import type { ShareCardData, ShareTile } from "./share-card-data";

export type ShareVariant = "sticker" | "card" | "og";

export function isShareVariant(v: unknown): v is ShareVariant {
  return v === "sticker" || v === "card" || v === "og";
}

interface Metrics {
  W: number;
  /** null = computed from the content (sticker). */
  H: number | null;
  margin: number;
  pad: number;
  name: number;
  nameLines: number;
  date: number;
  tileH: number;
  label: number;
  fig: number;
  unit: number;
  small: number;
  rowSize: number;
  notes: number;
  notesLines: number;
  board: number;
  theme: "sticker" | "card";
}

const METRICS: Record<ShareVariant, Metrics> = {
  sticker: { W: 1080, H: null, margin: 56, pad: 48, name: 60, nameLines: 2, date: 30, tileH: 200, label: 22, fig: 56, unit: 24, small: 22, rowSize: 3, notes: 34, notesLines: 4, board: 30, theme: "sticker" },
  card: { W: 1080, H: 1350, margin: 48, pad: 56, name: 76, nameLines: 2, date: 34, tileH: 220, label: 24, fig: 64, unit: 26, small: 24, rowSize: 3, notes: 38, notesLines: 7, board: 32, theme: "card" },
  og: { W: 1200, H: 630, margin: 28, pad: 40, name: 56, nameLines: 1, date: 28, tileH: 160, label: 20, fig: 44, unit: 20, small: 19, rowSize: 5, notes: 26, notesLines: 2, board: 26, theme: "card" },
};

const THEMES = {
  sticker: {
    plate: "rgba(10, 14, 28, 0.84)",
    border: "2px solid rgba(255, 255, 255, 0.28)",
    shadow: "0 10px 36px rgba(0, 0, 0, 0.35)",
    text: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    tile: "rgba(255, 255, 255, 0.14)",
    brand: "rgba(255, 255, 255, 0.92)",
  },
  card: {
    plate: "#ffffff",
    border: "none",
    shadow: "none",
    text: "#0b0d12",
    muted: "#5b6470",
    tile: "#f2f5f5",
    brand: "#0018ff",
  },
} as const;

const GAP = 14;
const BRAND_H = 44;

export interface ShareLayout {
  width: number;
  height: number;
  nameLines: string[];
  noteLines: string[];
  rows: ShareTile[][];
}

/** Pure sizing: line breaks and the final pixel size. */
export function layoutShare(data: ShareCardData, variant: ShareVariant): ShareLayout {
  const m = METRICS[variant];
  const inner = m.W - 2 * m.margin - 2 * m.pad;
  const nameLines = wrapText(data.spotName, inner, m.name, m.nameLines).lines;
  const noteLines = data.notes ? wrapText(data.notes, inner, m.notes, m.notesLines).lines : [];
  const rows = tileRows(data.tiles, m.rowSize);
  const height = m.H ?? Math.ceil(contentHeight(m, nameLines.length, rows.length, !!data.boardName, noteLines.length) + 2 * m.margin);
  return { width: m.W, height, nameLines, noteLines, rows };
}

const nameLH = (m: Metrics) => Math.round(m.name * 1.15);
const dateLH = (m: Metrics) => Math.round(m.date * 1.3);
const boardLH = (m: Metrics) => Math.round(m.board * 1.4);
const noteLH = (m: Metrics) => Math.round(m.notes * 1.45);

function contentHeight(m: Metrics, nameLines: number, rowCount: number, hasBoard: boolean, noteLines: number): number {
  let h = 2 * m.pad;
  h += nameLines * nameLH(m) + 6 + dateLH(m);
  if (rowCount) h += 26 + rowCount * m.tileH + (rowCount - 1) * GAP;
  else h += 26 + Math.round(m.small * 1.3); // the "no conditions" line
  if (hasBoard) h += 22 + boardLH(m);
  if (noteLines) h += 26 + noteLines * noteLH(m);
  h += 26 + BRAND_H;
  return h;
}

function Tile({ tile, m, c }: { tile: ShareTile; m: Metrics; c: (typeof THEMES)[keyof typeof THEMES] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        height: m.tileH,
        padding: `${Math.round(m.tileH * 0.09)}px ${Math.round(m.tileH * 0.1)}px`,
        borderRadius: 28,
        background: c.tile,
      }}
    >
      <div style={{ display: "flex", fontSize: m.label, lineHeight: `${Math.round(m.label * 1.3)}px`, fontWeight: 500, color: c.muted }}>
        {tile.label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 4, color: c.text, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", fontFamily: "IBM Plex Mono, Funnel Sans, Noto Sans TC", fontWeight: 500, fontSize: m.fig, lineHeight: `${Math.round(m.fig * 1.15)}px` }}>
          {tile.value}
        </div>
        {tile.unit ? (
          <div style={{ display: "flex", marginLeft: 6, fontSize: m.unit, fontWeight: 500, color: c.muted }}>{tile.unit}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
        {tile.lines.map((line, i) => (
          <div key={i} style={{ display: "flex", whiteSpace: "nowrap", fontSize: m.small, lineHeight: `${Math.round(m.small * 1.3)}px`, fontWeight: 500, color: c.muted }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The element satori draws; `layout` comes from layoutShare(). */
export function shareElement(data: ShareCardData, variant: ShareVariant, layout: ShareLayout): ReactElement {
  const m = METRICS[variant];
  const c = THEMES[m.theme];
  const isCard = m.theme === "card";
  const fontFamily = "Funnel Sans, Noto Sans TC";

  return (
    <div
      style={{
        display: "flex",
        width: layout.width,
        height: layout.height,
        padding: m.margin,
        // sticker: no background at all, so the PNG keeps its alpha channel
        ...(isCard ? { background: "#0018ff" } : {}),
        fontFamily,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: m.pad,
          borderRadius: isCard ? 56 : 52,
          background: c.plate,
          border: c.border,
          boxShadow: c.shadow,
          color: c.text,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {layout.nameLines.map((line, i) => (
            <div key={i} style={{ display: "flex", whiteSpace: "nowrap", fontSize: m.name, lineHeight: `${nameLH(m)}px`, fontWeight: 700, letterSpacing: -1 }}>
              {line}
            </div>
          ))}
          <div style={{ display: "flex", marginTop: 6, fontSize: m.date, lineHeight: `${dateLH(m)}px`, fontWeight: 500, color: c.muted }}>
            {data.whenLabel}
          </div>
        </div>

        {layout.rows.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, gap: GAP }}>
            {layout.rows.map((row, r) => (
              <div key={r} style={{ display: "flex", gap: GAP }}>
                {row.map((tile) => (
                  <Tile key={tile.key} tile={tile} m={m} c={c} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: 26, fontSize: m.small, lineHeight: `${Math.round(m.small * 1.3)}px`, color: c.muted }}>
            {shareT(data.lang, "share.image.noConditions")}
          </div>
        )}

        {data.boardName ? (
          <div style={{ display: "flex", marginTop: 22, fontSize: m.board, lineHeight: `${boardLH(m)}px`, fontWeight: 500, whiteSpace: "nowrap" }}>
            <div style={{ display: "flex", color: c.muted, marginRight: 12 }}>{shareT(data.lang, "share.board")}</div>
            <div style={{ display: "flex" }}>{data.boardName}</div>
          </div>
        ) : null}

        {layout.noteLines.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
            {layout.noteLines.map((line, i) => (
              <div key={i} style={{ display: "flex", whiteSpace: "pre", fontSize: m.notes, lineHeight: `${noteLH(m)}px`, fontWeight: 500 }}>
                {line}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", marginTop: 26, height: BRAND_H, alignItems: "center", fontSize: 34, fontWeight: 800, letterSpacing: -1, color: c.brand }}>
          Surflog
        </div>
      </div>
    </div>
  );
}

/** Every character drawn, for the font subset request. */
export function textOf(data: ShareCardData, layout: ShareLayout): string {
  return [
    ...layout.nameLines,
    data.whenLabel,
    ...data.tiles.flatMap((t) => [t.label, t.value, t.unit ?? "", ...t.lines]),
    data.boardName ?? "",
    shareT(data.lang, "share.board"),
    shareT(data.lang, "share.image.noConditions"),
    ...layout.noteLines,
    "Surflog 0123456789 .,:·+−-–—…°/",
  ].join("");
}

export interface RenderOptions {
  /** Cache-Control for the response. */
  cacheControl: string;
  /** Sent as Content-Disposition when set (the owner's "Save image"). */
  filename?: string;
}

/** Render to a PNG response. Throws if fonts can't be loaded. */
export async function renderShareImage(
  data: ShareCardData,
  variant: ShareVariant,
  opts: RenderOptions
): Promise<ImageResponse> {
  const layout = layoutShare(data, variant);
  const fonts = await loadShareFonts(textOf(data, layout));
  const headers: Record<string, string> = { "Cache-Control": opts.cacheControl, "X-Content-Type-Options": "nosniff" };
  if (opts.filename) headers["Content-Disposition"] = `attachment; filename="${opts.filename}"`;
  return new ImageResponse(shareElement(data, variant, layout), {
    width: layout.width,
    height: layout.height,
    fonts,
    headers,
  });
}
