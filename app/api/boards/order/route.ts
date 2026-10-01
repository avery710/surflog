import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listBoards, reorderBoards } from "@/lib/db";

/** PUT /api/boards/order — drag-and-drop reorder. Body: `{ ids: string[] }`,
 *  the caller's full new rack order (both 常用 and regular boards mixed
 *  into one flat sequence — see the sort_order comment on the Board type).
 *  One request per drop. Every id must be exactly the caller's current
 *  rack, no more, no fewer — anything else 404s, same as a foreign board
 *  id elsewhere in this API, so a bad id can't be used to probe whether it
 *  belongs to someone else. Returns the reordered rack. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ownerId = session.user.id;

  const body = await req.json().catch(() => null);
  const ids = body && typeof body === "object" ? (body as Record<string, unknown>).ids : null;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of board ids" }, { status: 400 });
  }

  const owned = await listBoards(ownerId);
  const ownedIds = new Set(owned.map((b) => b.id));
  const submitted = new Set(ids as string[]);
  const isExactOwnRack =
    submitted.size === ids.length && ids.length === owned.length && (ids as string[]).every((id) => ownedIds.has(id));
  if (!isExactOwnRack) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const boards = await reorderBoards(ownerId, ids as string[]);
  return NextResponse.json({ boards });
}
