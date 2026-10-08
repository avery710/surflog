import { NextRequest, NextResponse } from "next/server";
import { shareCaseData } from "@/app/dev/share/cases";
import { parseShareParts } from "@/lib/share-parts";
import { isShareTone, isShareVariant } from "@/lib/share-element";
import { renderShareImage } from "@/lib/share-image";
import { isShareLang } from "@/lib/share-strings";

/**
 * Dev-only: the share images for the synthetic cases of /dev/share. Route
 * handlers aren't covered by app/dev/layout.tsx's notFound(), so the
 * production check is repeated here.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const p = req.nextUrl.searchParams;
  const variant = p.get("variant") ?? "card";
  const lang = p.get("lang") ?? "en";
  if (!isShareVariant(variant) || !isShareLang(lang)) return NextResponse.json({ error: "bad query" }, { status: 400 });
  const tone = p.get("tone") ?? "light";
  if (!isShareTone(tone)) return NextResponse.json({ error: "bad tone" }, { status: 400 });
  const data = shareCaseData(p.get("case") ?? "typical", lang);
  if (!data) return NextResponse.json({ error: "unknown case" }, { status: 404 });
  if (p.get("cover") === "1") {
    // Synthetic landscape "photo" for the story frame's photo background.
    const { default: sharp } = await import("sharp");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b26b"/><stop offset=".55" stop-color="#6fa8dc"/><stop offset="1" stop-color="#134f5c"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="260" r="90" fill="#fff2cc"/></svg>`;
    const jpg = await sharp(Buffer.from(svg)).resize(1080, 1920, { fit: "cover" }).jpeg().toBuffer();
    data.coverPhoto = `data:image/jpeg;base64,${jpg.toString("base64")}`;
  }
  try {
    return await renderShareImage(data, variant, { cacheControl: "no-store", tone, parts: parseShareParts(p.get("parts")), skipStencil: p.get("raw") === "1", storyFrame: p.get("frame") === "1", preview: p.get("size") === "preview" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "render failed" }, { status: 503 });
  }
}
