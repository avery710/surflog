/** Renders the share element (lib/share-element.tsx) to a PNG with next/og. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { applyKnockout } from "./share-knockout";
import { loadShareFonts } from "./share-fonts";
import { SHAPE_ALPHA, layoutShare, shareElement, textOf, type ShareLogos, type ShareTone, type ShareVariant } from "./share-element";
import { ALL_PARTS, type ShareParts } from "./share-parts";
import type { ShareCardData } from "./share-card-data";

export interface RenderOptions {
  /** Cache-Control for the response. */
  cacheControl: string;
  /** Sent as Content-Disposition when set (the owner's "Save image"). */
  filename?: string;
  /** Sticker text colour; default "light" (white). */
  tone?: ShareTone;
  /** Dev only: return the strip as drawn, before the stencil step. */
  skipStencil?: boolean;
  /** Which parts to draw (default all). */
  parts?: ShareParts;
}

let logosCache: Promise<ShareLogos> | null = null;

/** The header's wordmark as data URIs (satori fetches nothing itself):
 *  public/surflog-logo.png (black) and the pre-rendered white copy. */
function loadLogos(): Promise<ShareLogos> {
  logosCache ??= (async () => {
    const dir = path.join(process.cwd(), "public");
    const uri = async (f: string) => `data:image/png;base64,${(await readFile(path.join(dir, f))).toString("base64")}`;
    return { black: await uri("surflog-logo.png"), white: await uri("surflog-logo-white.png") };
  })().catch((e) => {
    logosCache = null;
    throw e;
  });
  return logosCache;
}

/** Render to a PNG response. Throws if fonts can't be loaded. */
export async function renderShareImage(
  input: ShareCardData,
  variant: ShareVariant,
  opts: RenderOptions
): Promise<Response> {
  const data = input;
  const parts = opts.parts ?? ALL_PARTS;
  const logos = await loadLogos();
  const layout = layoutShare(data, variant, parts);
  const fonts = await loadShareFonts(textOf(data, layout));
  const headers: Record<string, string> = { "Cache-Control": opts.cacheControl, "X-Content-Type-Options": "nosniff", "Content-Type": "image/png" };
  if (opts.filename) headers["Content-Disposition"] = `attachment; filename="${opts.filename}"`;
  const tone = opts.tone ?? "light";
  const stencil = variant === "strip" || variant === "column";
  const res = new ImageResponse(shareElement(data, variant, layout, { tone, logos, knockout: stencil }), {
    width: layout.width,
    height: layout.height,
    fonts,
  });
  // Story and og are opaque; the stickers (strip, column, card) are cropped to their visible pixels.
  const sticker = stencil || variant === "card";
  if (opts.skipStencil || !sticker) return new Response(res.body, { headers });
  const png = Buffer.from(await res.arrayBuffer());
  const drawn = stencil ? await stencilPng(png, tone, data.boardPhoto, layout.shapeBands) : png;
  return new Response(new Uint8Array(await trimTransparent(drawn)), { headers });
}

/** Crop a sticker to the box of its non-transparent pixels, so it carries no
 *  empty margin (the layout's fixed width and outer margin) into a story. */
export async function trimTransparent(png: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * channels;
    for (let x = 0; x < w; x++) {
      if (data[row + x * channels + channels - 1] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) return png; // nothing drawn: leave it as is
  if (left === 0 && top === 0 && right === w - 1 && bottom === h - 1) return png;
  return sharp(png).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toBuffer();
}

/** Turn the strip's flag-coloured text into holes and paint the board photo. */
async function stencilPng(png: Buffer, tone: "light" | "dark", photo: string | null | undefined, bands: [number, number][]): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { photo: box } = applyKnockout(data, info.width, info.height, tone, { shapeAlpha: SHAPE_ALPHA, bands });
  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  const m = photo?.match(/^data:image\/[a-z+.-]+;base64,(.+)$/);
  if (box && m) {
    const d = box.d + 2;
    const disc = await sharp(Buffer.from(m[1], "base64"))
      .resize(d, d, { fit: "cover" })
      .composite([{ input: Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}"/></svg>`), blend: "dest-in" }])
      .png()
      .toBuffer();
    img = sharp(await img.png().toBuffer()).composite([{ input: disc, left: box.x - 1, top: box.y - 1 }]);
  }
  return img.png().toBuffer();
}
