import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSession, updateSession } from "@/lib/db";
import { MAX_SESSION_VIDEO_BYTES, registerUpload } from "@/lib/blob";
import { enqueueClipJob, JobsNotReady } from "@/lib/clip-jobs";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_PREFIX = ["image/", "video/"];

/** POST /api/sessions/:id/photos — { uploadId }: attach a file the browser
 *  already PUT to storage via POST /api/uploads. One file per request. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getSession(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId : "";
  const sessionVideo = body?.kind === "session-video";
  const upload = await registerUpload(
    uploadId,
    session.user.id,
    { sessionId: id },
    sessionVideo ? ["video/"] : ALLOWED_PREFIX,
    sessionVideo ? MAX_SESSION_VIDEO_BYTES : undefined
  );
  if (!upload.ok) return uploadRefusal(upload.reason, sessionVideo ? MAX_SESSION_VIDEO_BYTES : undefined);

  const photos = [...existing.photos, { id: uploadId, type: upload.mimeType }];
  const saved = await updateSession(id, { photos });
  if (sessionVideo) {
    try {
      await enqueueClipJob({ ownerId: session.user.id, sessionId: id, mediaId: uploadId });
    } catch (e) {
      if (!(e instanceof JobsNotReady)) console.error("[clips] could not queue suggestions:", e);
    }
  }
  return NextResponse.json({ session: saved }, { status: 201 });
}

function uploadRefusal(reason: "missing" | "too_large" | "bad_type", maxBytes?: number) {
  if (reason === "too_large") {
    const mb = Math.round((maxBytes ?? 50 * 1024 * 1024) / (1024 * 1024));
    return NextResponse.json({ error: `file too large (${mb} MB max)`, code: reason }, { status: 413 });
  }
  if (reason === "bad_type") {
    return NextResponse.json({ error: "only images/video are accepted", code: reason }, { status: 415 });
  }
  return NextResponse.json({ error: "missing file", code: reason }, { status: 400 });
}
