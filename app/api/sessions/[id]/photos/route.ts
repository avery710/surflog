import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSession, updateSession } from "@/lib/db";
import { saveBlob } from "@/lib/blob";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_PREFIX = ["image/", "video/"];

/** POST /api/sessions/:id/photos — multipart upload, one file per request. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getSession(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (!ALLOWED_PREFIX.some((p) => file.type.startsWith(p))) {
    return NextResponse.json({ error: "only images/video are accepted" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (15MB max)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const photoId = await saveBlob(bytes, file.type, session.user.id, { sessionId: id });

  const photos = [...existing.photos, { id: photoId, type: file.type }];
  const saved = await updateSession(id, { photos });
  return NextResponse.json({ session: saved }, { status: 201 });
}
