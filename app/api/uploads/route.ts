import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createUpload, MAX_SESSION_VIDEO_BYTES, MAX_UPLOAD_BYTES } from "@/lib/blob";

/** POST /api/uploads — { type, size } → { id, url }: a one-time URL the
 *  browser PUTs the file to (straight to Supabase Storage; Vercel caps a
 *  request body at 4.5 MB). The upload belongs to nobody until it's attached
 *  with POST /api/sessions/:id/photos or /api/boards/:id/photo, which check
 *  what actually landed. The size/type check here is only an early, friendly
 *  refusal. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const type = typeof body?.type === "string" ? body.type : "";
  const size = typeof body?.size === "number" ? body.size : NaN;
  const sessionVideo = body?.kind === "session-video";
  const notMedia = !type.startsWith("image/") && !type.startsWith("video/");
  if (sessionVideo ? !type.startsWith("video/") : notMedia) {
    return NextResponse.json({ error: "only images/video are accepted", code: "bad_type" }, { status: 415 });
  }
  const max = sessionVideo ? MAX_SESSION_VIDEO_BYTES : MAX_UPLOAD_BYTES;
  if (!(size > 0) || size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return NextResponse.json({ error: `file too large (${mb} MB max)`, code: "too_large" }, { status: 413 });
  }

  return NextResponse.json(await createUpload(), { status: 201 });
}
