import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoard, updateBoard } from "@/lib/db";
import { deleteBlob, registerUpload } from "@/lib/blob";

type Params = { params: Promise<{ id: string }> };

/** POST /api/boards/:id/photo — { uploadId }: attach one image the browser
 *  already PUT to storage via POST /api/uploads; replaces any existing
 *  photo. Same pipeline as session photos (Storage bucket "photos" +
 *  photo_blobs ownership row), served by /api/blob/:id's owner check. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getBoard(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId : "";
  const upload = await registerUpload(uploadId, session.user.id, { boardId: id }, ["image/"]);
  if (!upload.ok) {
    if (upload.reason === "too_large") {
      return NextResponse.json({ error: "file too large (50MB max)", code: upload.reason }, { status: 413 });
    }
    if (upload.reason === "bad_type") {
      return NextResponse.json({ error: "only images are accepted", code: upload.reason }, { status: 415 });
    }
    return NextResponse.json({ error: "missing file", code: upload.reason }, { status: 400 });
  }

  const saved = await updateBoard(id, { photoId: uploadId });
  if (existing.photoId) await deleteBlob(existing.photoId);
  return NextResponse.json({ board: saved }, { status: 201 });
}

/** DELETE /api/boards/:id/photo — remove the board's photo. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getBoard(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const saved = existing.photoId ? await updateBoard(id, { photoId: null }) : existing;
  if (existing.photoId) await deleteBlob(existing.photoId);
  return NextResponse.json({ board: saved });
}
