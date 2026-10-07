import { NextRequest, NextResponse } from "next/server";
import { shareCaseData } from "@/app/dev/share/cases";
import { isShareVariant, renderShareImage } from "@/lib/share-image";
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
  const data = shareCaseData(p.get("case") ?? "typical", lang);
  if (!data) return NextResponse.json({ error: "unknown case" }, { status: 404 });
  try {
    return await renderShareImage(data, variant, { cacheControl: "no-store" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "render failed" }, { status: 503 });
  }
}
