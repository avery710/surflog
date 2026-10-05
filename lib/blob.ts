/**
 * Photo/video storage — Supabase Storage (private bucket "photos") for the
 * bytes, Postgres table `photo_blobs` (supabase/migrations/) for ownership
 * and mime type. The browser uploads straight to Storage through a one-time
 * signed URL (createUpload → registerUpload), never through a function.
 *
 * Same trust boundary as lib/db.ts: server-side only, via the service-role
 * client, which is what makes access to the private bucket possible at all.
 */
import { getSupabase } from "./supabase";

const BUCKET = "photos";
const TABLE = "photo_blobs";

/** Images and video, 15 MB each — the limit on anything put in the bucket. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Direct upload, step 1: a one-time URL the browser PUTs the file to, so the
 * bytes go straight to Supabase Storage and never through a Vercel function
 * (whose request body is capped at 4.5 MB — a phone photo or any video is
 * larger). The id is unguessable, and nothing can read the object until
 * `registerUpload` records who owns it.
 */
export async function createUpload(): Promise<{ id: string; url: string }> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUploadUrl(id);
  if (error || !data) throw new Error(`Supabase Storage: ${error?.message ?? "no upload URL"}`);
  return { id, url: data.signedUrl };
}

/**
 * Direct upload, step 2: after the browser has PUT the file, check what
 * actually landed (the signed URL doesn't limit size or type) and record its
 * owner. A missing, oversized or wrong-type object is removed and reported;
 * an id that already has an owner row is refused, so an upload can only ever
 * be claimed once.
 */
export async function registerUpload(
  id: string,
  ownerId: string,
  parent: { sessionId: string } | { boardId: string },
  allowedPrefixes: string[]
): Promise<{ ok: true; mimeType: string } | { ok: false; reason: "missing" | "too_large" | "bad_type" }> {
  if (!/^[0-9a-f]{32}$/.test(id)) return { ok: false, reason: "missing" };
  const sb = getSupabase();

  const info = await sb.storage.from(BUCKET).info(id);
  if (info.error || !info.data) return { ok: false, reason: "missing" };
  const size = info.data.size ?? info.data.metadata?.size ?? 0;
  const mimeType = info.data.contentType ?? info.data.metadata?.mimetype ?? "";

  const claimed = await sb.from(TABLE).select("id").eq("id", id).maybeSingle();
  if (claimed.error) throw new Error(`Supabase: ${claimed.error.message}`);
  if (claimed.data) return { ok: false, reason: "missing" };

  const badType = !allowedPrefixes.some((p) => mimeType.startsWith(p));
  if (badType || size > MAX_UPLOAD_BYTES) {
    await sb.storage.from(BUCKET).remove([id]);
    return { ok: false, reason: badType ? "bad_type" : "too_large" };
  }

  const insert = await sb.from(TABLE).insert({
    id,
    owner_id: ownerId,
    mime_type: mimeType,
    ...("sessionId" in parent ? { session_id: parent.sessionId } : { board_id: parent.boardId }),
  });
  if (insert.error) throw new Error(`Supabase: ${insert.error.message}`);
  return { ok: true, mimeType };
}

/** Owner and type only — no download. */
export async function blobMeta(id: string): Promise<{ mimeType: string; ownerId: string } | null> {
  const meta = await getSupabase().from(TABLE).select("owner_id, mime_type").eq("id", id).maybeSingle();
  if (meta.error) throw new Error(`Supabase: ${meta.error.message}`);
  return meta.data ? { mimeType: meta.data.mime_type, ownerId: meta.data.owner_id } : null;
}

/** A short-lived link straight to the object, for files too big to send
 *  back through a function. Only hand it out after the owner check. */
export async function signedBlobUrl(id: string, seconds: number): Promise<string | null> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(id, seconds);
  return error || !data ? null : data.signedUrl;
}

export async function readBlob(
  id: string
): Promise<{ bytes: Buffer; mimeType: string; ownerId: string } | null> {
  const sb = getSupabase();

  const meta = await sb.from(TABLE).select("owner_id, mime_type").eq("id", id).maybeSingle();
  if (meta.error) throw new Error(`Supabase: ${meta.error.message}`);
  if (!meta.data) return null;

  const download = await sb.storage.from(BUCKET).download(id);
  if (download.error || !download.data) return null;

  const bytes = Buffer.from(await download.data.arrayBuffer());
  return { bytes, mimeType: meta.data.mime_type, ownerId: meta.data.owner_id };
}

export async function deleteBlob(id: string): Promise<void> {
  const sb = getSupabase();
  await Promise.allSettled([
    sb.storage.from(BUCKET).remove([id]),
    sb.from(TABLE).delete().eq("id", id),
  ]);
}
