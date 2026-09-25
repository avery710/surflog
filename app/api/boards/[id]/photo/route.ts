import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoard, updateBoard } from "@/lib/db";
import { deleteBlob, saveBlob } from "@/lib/blob";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 15 * 1024 * 1024;

/** POST /api/boards/:id/photo — multipart, one image; replaces any existing
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

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "only images are accepted" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (15MB max)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const photoId = await saveBlob(bytes, file.type, session.user.id, { boardId: id });
  const saved = await updateBoard(id, { photoId });
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
