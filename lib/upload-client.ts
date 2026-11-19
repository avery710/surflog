/**
 * Browser-side photo/video upload: shrink a big photo, then send the file
 * straight to Supabase Storage through a one-time URL (POST /api/uploads).
 * The caller attaches the returned upload id to a session or board.
 *
 * Why not POST the file to our own API: a Vercel function's request body is
 * capped at 4.5 MB, and a phone photo or any video is larger.
 */

import type { Session } from "./types";
import { compressVideo, VideoTooLongError } from "./video-compress";
import { videoMime } from "./video-meta";
import { MAX_SESSION_VIDEO_BYTES, MAX_UPLOAD_BYTES } from "./upload-limits";

export { MAX_UPLOAD_BYTES };

/** Longest edge kept for photos, and the JPEG quality they're re-encoded at.
 *  2560 px / 0.9 is visually lossless at any size the app shows a photo
 *  (full-screen on a phone or laptop) and lands around 1-2.5 MB. */
const MAX_EDGE = 2560;
const JPEG_QUALITY = 0.9;
/** A photo already this small and within MAX_EDGE is sent untouched — no
 *  point re-encoding (and losing a generation) to save nothing. */
const KEEP_AS_IS_BYTES = 3 * 1024 * 1024;

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

/** PUT with upload progress — fetch() can't report how much of a request
 *  body has been sent, XMLHttpRequest can. Resolves with the HTTP status
 *  (0 when the request never completed). */
function putWithProgress(
  url: string,
  file: File,
  onProgress?: (fraction: number) => void,
  contentType = file.type
): Promise<number> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => resolve(0);
    xhr.onabort = () => resolve(0);
    xhr.send(file);
  });
}

export type UploadPhase = "compressing" | "uploading";
/** How much of a file's bar the compression step takes when there is one. */
const COMPRESS_SHARE = 0.6;

/** Shrinks a photo or compresses a video if needed, uploads it, and returns
 *  the upload id to attach. `onProgress` gets 0..1 for this one file and
 *  which step it is in. Throws UploadError — callers pick the message. */
export async function uploadFile(
  original: File,
  onProgress?: (fraction: number, phase: UploadPhase) => void
): Promise<string> {
  let file = original;
  let uploadFrom = 0;
  if (original.type.startsWith("video/")) {
    try {
      file = await compressVideo(original, (f) => {
        uploadFrom = COMPRESS_SHARE;
        onProgress?.(f * COMPRESS_SHARE, "compressing");
      });
    } catch (e) {
      throw new UploadError(e instanceof VideoTooLongError ? "too_large" : "failed");
    }
  } else {
    file = await shrinkImage(original);
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("too_large");
  const uploading = (f: number) => onProgress?.(uploadFrom + f * (1 - uploadFrom), "uploading");
  uploading(0);

  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: file.type, size: file.size }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url) {
    throw new UploadError(body?.code === "too_large" || body?.code === "bad_type" ? body.code : "failed");
  }

  const status = await putWithProgress(body.url as string, file, uploading);
  if (status < 200 || status >= 300) throw new UploadError(status === 413 ? "too_large" : "failed");

  return body.id as string;
}

/** Supabase asks for 6 MB TUS chunks. At or under that, one signed PUT is
 *  the same request the photo path already uses. */
const TUS_CHUNK = 6 * 1024 * 1024;

/**
 * Upload a whole session video straight to Storage. Does not create a
 * session and does not re-encode: a full session is too long for the
 * short-clip compressor, and the review player wants the original.
 * Files over 6 MB use a resumable (TUS) upload with the signed token.
 */
export async function uploadSessionVideo(
  original: File,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const type = videoMime(original);
  if (!type) throw new UploadError("bad_type");
  if (original.size <= 0 || original.size > MAX_SESSION_VIDEO_BYTES) throw new UploadError("too_large");
  onProgress?.(0);

  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, size: original.size, kind: "session-video" }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url || !body?.id) {
    throw new UploadError(body?.code === "too_large" || body?.code === "bad_type" ? body.code : "failed");
  }

  if (original.size <= TUS_CHUNK) {
    const status = await putWithProgress(body.url as string, original, onProgress, type);
    if (status < 200 || status >= 300) throw new UploadError(status === 413 ? "too_large" : "failed");
    return body.id as string;
  }

  if (!body.token || !body.resumableUrl) throw new UploadError("failed");
  const tus = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(original, {
      endpoint: body.resumableUrl as string,
      retryDelays: [0, 2000, 5000, 10000],
      headers: {
        "x-signature": body.token as string,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK,
      metadata: {
        bucketName: "photos",
        objectName: body.id as string,
        contentType: type,
        cacheControl: "31536000",
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        reject(new UploadError(/413|maximum size|too large|entity/i.test(message) ? "too_large" : "failed"));
      },
      onProgress: (sent, total) => {
        if (total > 0) onProgress?.(sent / total);
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });
  return body.id as string;
}

/**
 * Uploads files and attaches each to a session the caller owns, one at a
 * time — the attach route reads the session's photo list and writes it
 * back, so two attaches at once would overwrite each other. A file that
 * fails is counted and skipped, never thrown: the session already exists.
 * `session` is the latest version the server returned, or null if nothing
 * attached. `onProgress` gets which file is going up and `fraction`, 0..1
 * across the whole batch (each file counts equally; within a file it follows
 * the bytes sent, held just short of full until the attach has answered).
 * `onFile` gets each file's own state as it starts and as it ends.
 */
export async function attachFiles(
  sessionId: string,
  files: File[],
  onProgress?: (n: number, total: number, fraction: number, phase: UploadPhase) => void,
  onFile?: (index: number, status: "uploading" | "done" | "failed") => void
): Promise<{ session: Session | null; failed: number }> {
  let session: Session | null = null;
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const report = (within: number, phase: UploadPhase = "uploading") =>
      onProgress?.(i + 1, files.length, (i + within) / files.length, phase);
    report(0);
    onFile?.(i, "uploading");
    try {
      const uploadId = await uploadFile(files[i], (f, phase) => report(f * 0.95, phase));
      const res = await fetch(`/api/sessions/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.session) throw new Error("attach failed");
      session = body.session as Session;
      onFile?.(i, "done");
    } catch {
      failed++;
      onFile?.(i, "failed");
    }
    report(1);
  }
  return { session, failed };
}
