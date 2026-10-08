/**
 * The story frame's optional background: the session's FIRST image (a video
 * is skipped), owner-checked, read from Storage and cropped to 1080x1920 as a
 * JPEG data URI. Owner routes only — never the public link. Null (no image,
 * unreadable, too big) means a transparent background.
 */
import { readBlob } from "./blob";
import { ttlCache } from "./ttl-cache";
import type { Photo } from "./types";

const MAX_BYTES = 25 * 1024 * 1024;
export const STORY_W = 1080;
export const STORY_H = 1920;

// Every settings change asks for 3 previews + 1 full image of the same session:
// download and shrink each photo once, not four times. Keyed by owner, photo and size.
const shrunk = ttlCache<string>(40, 10 * 60_000);

/** `scale` < 1 for the dialog's previews (a 360x640 cover instead of 1080x1920). */
export async function coverPhotoDataUri(ownerId: string, photos: Photo[], scale = 1): Promise<string | null> {
  const first = photos.find((p) => p.type.startsWith("image/"));
  if (!first) return null;
  const w = Math.round(STORY_W * scale);
  const h = Math.round(STORY_H * scale);
  const key = `${ownerId}:${first.id}:${w}x${h}`;
  const hit = shrunk.get(key);
  if (hit) return hit;
  try {
    const blob = await readBlob(first.id);
    if (!blob || blob.ownerId !== ownerId || !blob.mimeType.startsWith("image/") || blob.bytes.length > MAX_BYTES) return null;
    const { default: sharp } = await import("sharp");
    const out = await sharp(blob.bytes).rotate().resize(w, h, { fit: "cover" }).jpeg({ quality: scale < 1 ? 70 : 82 }).toBuffer();
    const uri = `data:image/jpeg;base64,${out.toString("base64")}`;
    shrunk.set(key, uri);
    return uri;
  } catch (e) {
    console.error("[share cover photo]", e);
    return null; // plain blue background
  }
}
