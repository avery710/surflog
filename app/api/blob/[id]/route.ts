import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { blobMeta, readBlob, signedBlobUrl } from "@/lib/blob";

type Params = { params: Promise<{ id: string }> };

// A Vercel function can't send back more than 4.5 MB, so anything that might
// be bigger goes out as a redirect to a short-lived signed storage URL
// instead (which also gives video proper range requests). Photos are shrunk
// before upload and stay well under this, so they keep being served from
// here with a year-long private cache.
const PROXY_MAX_BYTES = 4 * 1024 * 1024;
const SIGNED_SECONDS = 3600;

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const meta = await blobMeta(id);
  if (!meta || meta.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const blob = meta.mimeType.startsWith("video/") ? null : await readBlob(id);
  if (blob && blob.bytes.byteLength <= PROXY_MAX_BYTES) {
    return new NextResponse(new Uint8Array(blob.bytes), {
      headers: {
        "Content-Type": blob.mimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }

  const url = await signedBlobUrl(id, SIGNED_SECONDS);
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });
  // cached for less than the link lives, so a cached redirect never points at an expired link
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${SIGNED_SECONDS / 2}` },
  });
}
