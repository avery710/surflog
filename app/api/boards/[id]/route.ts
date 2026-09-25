import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteBoard, getBoard, updateBoard } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";
import { parseBoardInput } from "@/lib/boards";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/boards/:id — replace the board's fields (not its photo — see
 *  ./photo). 404 (not 403) when it belongs to someone else. */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getBoard(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = parseBoardInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const saved = await updateBoard(id, parsed.value);
  return NextResponse.json({ board: saved });
}

/** DELETE /api/boards/:id — sessions that used it keep existing; their
 *  board_id goes null via the FK's `on delete set null`. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getBoard(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (existing.photoId) await deleteBlob(existing.photoId);
  const ok = await deleteBoard(id);
  return NextResponse.json({ ok });
}
