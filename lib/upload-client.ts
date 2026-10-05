/**
 * Browser-side photo/video upload: shrink a big photo, then send the file
 * straight to Supabase Storage through a one-time URL (POST /api/uploads).
 * The caller attaches the returned upload id to a session or board.
 *
 * Why not POST the file to our own API: a Vercel function's request body is
 * capped at 4.5 MB, and a phone photo or any video is larger.
 */

/** Longest edge kept for photos, and the JPEG quality they're re-encoded at.
 *  2560 px / 0.9 is visually lossless at any size the app shows a photo
 *  (full-screen on a phone or laptop) and lands around 1-2.5 MB. */
const MAX_EDGE = 2560;
const JPEG_QUALITY = 0.9;
/** A photo already this small and within MAX_EDGE is sent untouched — no
 *  point re-encoding (and losing a generation) to save nothing. */
const KEEP_AS_IS_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type UploadErrorCode = "too_large" | "bad_type" | "failed";
export class UploadError extends Error {
  constructor(public code: UploadErrorCode) {
    super(code);
  }
}

/** JPEG/HEIC/WebP photos and PNGs are resized; GIF (animation), SVG and
 *  video go up as they are. */
const RESIZABLE = /^image\/(jpeg|png|webp|heic|heif)$/;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/**
 * A photo larger than MAX_EDGE (or heavier than KEEP_AS_IS_BYTES) is drawn
 * down to MAX_EDGE on its longest side. PNG stays PNG so transparency
 * survives (board cut-outs); everything else becomes JPEG. EXIF rotation is
 * applied by the browser when it draws the image. Anything that can't be
 * decoded here, or that comes out no smaller, is returned unchanged.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!RESIZABLE.test(file.type)) return file;
  try {
    const img = await loadImage(file);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (longest <= MAX_EDGE && file.size <= KEEP_AS_IS_BYTES) return file;

    const scale = Math.min(1, MAX_EDGE / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/png" ? ".png" : ".jpg");
    return new File([blob], name, { type });
  } catch {
    return file;
  }
}

/** Shrinks a photo if needed, uploads it, and returns the upload id to
 *  attach. Throws UploadError — callers pick the message. */
export async function uploadFile(original: File): Promise<string> {
  const file = await shrinkImage(original);
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("too_large");

  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: file.type, size: file.size }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url) {
    throw new UploadError(body?.code === "too_large" || body?.code === "bad_type" ? body.code : "failed");
  }

  const put = await fetch(body.url as string, {
    method: "PUT",
    headers: { "content-type": file.type, "cache-control": "max-age=31536000", "x-upsert": "false" },
    body: file,
  }).catch(() => null);
  if (!put?.ok) throw new UploadError(put?.status === 413 ? "too_large" : "failed");

  return body.id as string;
}
