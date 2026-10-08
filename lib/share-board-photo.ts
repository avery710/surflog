/**
 * The board photo for the OWNER's own share images: owner-checked, read from
 * Storage and shrunk to a small square JPEG data URI that satori can draw.
 * Never used by the public link routes (the share-scoped media route serves
 * only the session's own photos, so a board photo stays private there).
 */
import { getBoard } from "./db";
import { readBlob } from "./blob";

const MAX_BYTES = 12 * 1024 * 1024;

export async function boardPhotoDataUri(ownerId: string, boardId: string | null | undefined): Promise<string | null> {
  if (!boardId) return null;
  try {
    const board = await getBoard(boardId);
    if (!board || board.ownerId !== ownerId || !board.photoId) return null;
    const blob = await readBlob(board.photoId);
    if (!blob || blob.ownerId !== ownerId || !blob.mimeType.startsWith("image/") || blob.bytes.length > MAX_BYTES) return null;
    const { default: sharp } = await import("sharp");
    const out = await sharp(blob.bytes).rotate().resize(160, 160, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch (e) {
    console.error("[share board photo]", e);
    return null; // the chip falls back to the name pill
  }
}
