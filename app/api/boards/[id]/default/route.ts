import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoard, listBoards, setDefaultBoard } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Shared by PUT/DELETE: auth + ownership (404, not 403, for someone else's). */
async function ownedBoard(params: Params["params"]) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const board = await getBoard(id);
  if (!board || board.ownerId !== session.user.id) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  return { ownerId: session.user.id, id };
}

/** PUT /api/boards/:id/default — make this the caller's default board.
 *  Returns the whole rack, since the previous default changes too. */
export async function PUT(_req: NextRequest, { params }: Params) {
  const r = await ownedBoard(params);
  if ("error" in r) return r.error;
  await setDefaultBoard(r.ownerId, r.id);
  return NextResponse.json({ boards: await listBoards(r.ownerId) });
}

/** DELETE /api/boards/:id/default — clear the default (if it's this board). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const r = await ownedBoard(params);
  if ("error" in r) return r.error;
  const boards = await listBoards(r.ownerId);
  if (boards.find((b) => b.id === r.id)?.isDefault) {
    await setDefaultBoard(r.ownerId, null);
    return NextResponse.json({ boards: await listBoards(r.ownerId) });
  }
  return NextResponse.json({ boards });
}
