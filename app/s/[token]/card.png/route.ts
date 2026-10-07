import { NextRequest } from "next/server";
import { loadPublicCard } from "@/lib/session-share";
import { renderShareImage } from "@/lib/share-image";
import { isShareLang } from "@/lib/share-strings";
import { langFromAcceptLanguage } from "@/lib/share-lang";
import { clientIp, limitShareMiss } from "@/lib/share-limits";
import { shareNotFound, shareTooMany } from "@/lib/share-http";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /s/<token>/card.png[?v=og|card&lang=en|zh-TW] — the solid card for
 * link previews (og = 1200x630, card = 1080x1350). Public, token-checked;
 * proxy.ts only lets this exact path shape through and applies the per-IP
 * request limit. Language: the owner's choice, else ?lang=, else the
 * visitor's Accept-Language (a crawler sends none, so the page puts ?lang=
 * in its og:image URL).
 *
 * Cache-Control is `no-store`: a revoked link must stop serving at once, and
 * a shared CDN copy of the PNG would keep it alive. The price is a render
 * (~100-300 ms) per crawler hit, bounded by the per-IP limit.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const q = req.nextUrl.searchParams;
  const variant = q.get("v") === "card" ? "card" : "og";
  const qLang = q.get("lang");
  const lang = isShareLang(qLang) ? qLang : langFromAcceptLanguage(req.headers.get("accept-language"));

  const card = await loadPublicCard(token, lang);
  if (!card) {
    const miss = limitShareMiss(clientIp(req.headers));
    return miss.ok ? shareNotFound() : shareTooMany(miss.retryAfterS);
  }
  try {
    return await renderShareImage(card, variant, { cacheControl: "no-store" });
  } catch (e) {
    console.error("[share card]", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
