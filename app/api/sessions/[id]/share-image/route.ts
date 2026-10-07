import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ownedShareCard } from "@/lib/session-share";
import { isShareVariant, renderShareImage } from "@/lib/share-image";
import { isShareLang } from "@/lib/share-strings";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/sessions/:id/share-image?variant=sticker|card&lang=en|zh-TW —
 * the owner's preview/download of the two share images. Cookie session and
 * ownership checked; the public counterpart (token-checked, card only) is
 * app/s/[token]/card.png. Same renderer, lib/share-image.tsx.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const variant = req.nextUrl.searchParams.get("variant") ?? "card";
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  if (variant === "og" || !isShareVariant(variant) || !isShareLang(lang)) {
    return NextResponse.json({ error: "variant must be sticker or card, lang en or zh-TW" }, { status: 400 });
  }

  const { id } = await params;
  const card = await ownedShareCard(session.user.id, id, lang);
  if (!card.ok) return NextResponse.json({ error: card.error }, { status: card.status });

  try {
    return await renderShareImage(card.data, variant, { cacheControl: "private, no-store" });
  } catch (e) {
    console.error("[share-image]", e);
    return NextResponse.json({ error: "could not draw the image, try again" }, { status: 503 });
  }
}
