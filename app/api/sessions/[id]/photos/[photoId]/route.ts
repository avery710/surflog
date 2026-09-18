import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSession, updateSession } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";

type Params = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, photoId } = await params;
  const existing = await getSession(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const photos = existing.photos.filter((p) => p.id !== photoId);
  if (photos.length === existing.photos.length) {
    return NextResponse.json({ error: "photo not on this session" }, { status: 404 });
  }
  await deleteBlob(photoId);
  const saved = await updateSession(id, { photos });
  return NextResponse.json({ session: saved });
}
