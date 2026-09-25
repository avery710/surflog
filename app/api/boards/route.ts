import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createBoard, listBoards, newSessionId } from "@/lib/db";
import { parseBoardInput } from "@/lib/boards";
import type { Board } from "@/lib/types";

/** GET /api/boards — the caller's own board rack. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const boards = await listBoards(session.user.id);
  return NextResponse.json({ boards });
}

/** POST /api/boards — add a board to the caller's rack. JSON body; the photo
 *  is uploaded separately to /api/boards/:id/photo once the board exists. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = parseBoardInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const now = new Date().toISOString();
  const board: Board = {
    id: newSessionId(),
    ownerId: session.user.id,
    ...parsed.value,
    photoId: null,
    createdAt: now,
    updatedAt: now,
  };
  const saved = await createBoard(board);
  return NextResponse.json({ board: saved }, { status: 201 });
}
