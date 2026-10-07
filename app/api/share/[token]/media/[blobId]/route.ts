import { NextRequest, NextResponse } from "next/server";
import { readBlob, signedBlobUrl } from "@/lib/blob";
import { sharedMediaMeta } from "@/lib/session-share";
import { clientIp, limitShareMiss } from "@/lib/share-limits";
import { shareNotFound, shareTooMany } from "@/lib/share-http";

type Params = { params: Promise<{ token: string; blobId: string }> };

// Mirrors app/api/blob/[id]/route.ts: a function can't send back more than
// 4.5 MB on Vercel, so videos and anything over 4 MB go out as a redirect to
// a signed storage URL (which also gives video range requests).
const PROXY_MAX_BYTES = 4 * 1024 * 1024;
// Shorter than the owner route's hour: whoever already holds the signed URL
// keeps it until it expires, even after the share is turned off.
const SIGNED_SECONDS = 900;

/** Anything served from our origin to a stranger is locked down: no sniffing,
 *  and a sandboxing CSP so an SVG (or any "image") can never run script. */
const SAFE = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Robots-Tag": "noindex",
};

/**
 * GET /api/share/<token>/media/<blobId> — a photo or video of a SHARED
 * session. Serves a blob only if the token is live and the blob is one of
 * that session's own media; every other case is the same 404. /api/blob/:id
 * stays owner-only and is untouched.
 *
 * Caching is `private` with a short max-age (60 s), never `public`/`s-maxage`
 * and never `immutable`: a shared CDN copy would outlive "turn off sharing",
 * a browser copy may live for a minute at most. The redirect is cached for
 * 60 s too, well under the signed link's life.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { token, blobId } = await params;
  const meta = await sharedMediaMeta(token, blobId);
  if (!meta || !(meta.mimeType.startsWith("image/") || meta.mimeType.startsWith("video/"))) {
    const miss = limitShareMiss(clientIp(req.headers));
    return miss.ok ? shareNotFound() : shareTooMany(miss.retryAfterS);
  }

  const blob = meta.mimeType.startsWith("video/") ? null : await readBlob(blobId);
  if (blob && blob.bytes.byteLength <= PROXY_MAX_BYTES) {
    return new NextResponse(new Uint8Array(blob.bytes), {
      headers: { ...SAFE, "Content-Type": blob.mimeType, "Cache-Control": "private, max-age=60" },
    });
  }

  const url = await signedBlobUrl(blobId, SIGNED_SECONDS);
  if (!url) return shareNotFound();
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=60", "X-Robots-Tag": "noindex" } });
}
