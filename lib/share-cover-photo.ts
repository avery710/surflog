/**
 * The Story image's background: the session's FIRST image (a video is skipped),
 * owner-checked, read from Storage and cropped to the story's 1080x1920 as a
 * JPEG data URI that satori can draw. Owner routes only — never the public link.
 * Null (no image, unreadable, too big) means the story is drawn on plain blue.
 */
import { readBlob } from "./blob";
import type { Photo } from "./types";

const MAX_BYTES = 25 * 1024 * 1024;
export const STORY_W = 1080;
export const STORY_H = 1920;

export async function coverPhotoDataUri(ownerId: string, photos: Photo[]): Promise<string | null> {
  const first = photos.find((p) => p.type.startsWith("image/"));
  if (!first) return null;
  try {
    const blob = await readBlob(first.id);
    if (!blob || blob.ownerId !== ownerId || !blob.mimeType.startsWith("image/") || blob.bytes.length > MAX_BYTES) return null;
    const { default: sharp } = await import("sharp");
    const out = await sharp(blob.bytes).rotate().resize(STORY_W, STORY_H, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch (e) {
    console.error("[share cover photo]", e);
    return null; // plain blue background
  }
}
