import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setBoardFavorite } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** PUT marks the board 常用 / go-to, DELETE unmarks it (any number per
 *  owner). One database round trip: setBoardFavorite's owner_id filter is
 *  the ownership check, so someone else's board — or a missing one — is a
 *  404 (not 403, don't confirm it exists). Returns just the updated board;
 *  the rack updates optimistically and merges it in. */
async function setFavorite(favorite: boolean, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const board = await setBoardFavorite(session.user.id, id, favorite);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function PUT(_req: NextRequest, ctx: Params) {
  return setFavorite(true, ctx);
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  return setFavorite(false, ctx);
}
