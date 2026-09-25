/**
 * Server-side only: resolves a `boardId` sent with a session create/update
 * into one the caller actually owns. Never attach someone else's board — an
 * unknown or foreign id is answered exactly like a missing one (404), so the
 * response can't confirm another user's board id exists.
 */
import { getBoard } from "./db";

export type BoardIdResult =
  | { ok: true; boardId: string | null | undefined } // undefined = field not sent
  | { ok: false };

export async function resolveOwnedBoardId(raw: unknown, ownerId: string): Promise<BoardIdResult> {
  if (raw === undefined) return { ok: true, boardId: undefined };
  if (raw === null || raw === "") return { ok: true, boardId: null };
  if (typeof raw !== "string") return { ok: false };
  const board = await getBoard(raw);
  if (!board || board.ownerId !== ownerId) return { ok: false };
  return { ok: true, boardId: board.id };
}
