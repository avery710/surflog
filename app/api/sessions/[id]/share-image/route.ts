import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ownedShareCard } from "@/lib/session-share";
import { parseShareParts } from "@/lib/share-parts";
import { isShareTone, isShareVariant } from "@/lib/share-element";
import { renderShareImage } from "@/lib/share-image";
import { isShareLang } from "@/lib/share-strings";

type Params = { params: Promise<{ id: string }> };

// A deploy can change the layout without changing the data, so the build
// is part of every image's fingerprint. Dev has no build id: never cached,
// so layout edits show at once.
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

/**
 * GET /api/sessions/:id/share-image?variant=strip|column|card|story&lang=en|zh-TW&tone=light|dark&parts=location,datetime,waves,board,log —
 * the owner's preview/download of the two share images. Cookie session and
 * ownership checked; the public counterpart (token-checked, card only) is
 * app/share/[token]/card.png. Same renderer, lib/share-image.tsx.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const variant = req.nextUrl.searchParams.get("variant") ?? "card";
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  if (variant === "og" || !isShareVariant(variant) || !isShareLang(lang)) {
    return NextResponse.json({ error: "variant must be strip, column, card or story, lang en or zh-TW" }, { status: 400 });
  }

  const toneQ = req.nextUrl.searchParams.get("tone") ?? "light";
  if (!isShareTone(toneQ)) return NextResponse.json({ error: "tone must be light or dark" }, { status: 400 });
  const parts = parseShareParts(req.nextUrl.searchParams.get("parts"));

  const { id } = await params;
  const card = await ownedShareCard(session.user.id, id, lang, { boardPhoto: parts.board, coverPhoto: variant === "story" });
  if (!card.ok) return NextResponse.json({ error: card.error }, { status: card.status });

  // Fingerprint of everything the picture is drawn from. The browser keeps the
  // PNG and asks "still this one?"; an unchanged image is a 304, never redrawn.
  const etag = BUILD
    ? `"${createHash("sha256").update(JSON.stringify([BUILD, variant, lang, toneQ, parts, card.data])).digest("base64url")}"`
    : null;
  const cacheControl = etag ? "private, no-cache" : "private, no-store";
  if (etag && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } });
  }

  try {
    const res = await renderShareImage(card.data, variant, { cacheControl, tone: toneQ, parts });
    if (etag) res.headers.set("ETag", etag);
    return res;
  } catch (e) {
    console.error("[share-image]", e);
    return NextResponse.json({ error: "could not draw the image, try again" }, { status: 503 });
  }
}
