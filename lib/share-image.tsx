/** Renders the share element (lib/share-element.tsx) to a PNG with next/og. */
import { ImageResponse } from "next/og";
import { loadShareFonts } from "./share-fonts";
import { layoutShare, shareElement, textOf, type ShareVariant } from "./share-element";
import type { ShareCardData } from "./share-card-data";

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
