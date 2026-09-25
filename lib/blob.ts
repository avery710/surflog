/**
 * Photo/video storage — Supabase Storage (private bucket "photos") for the
 * bytes, Postgres table `photo_blobs` (supabase/migrations/) for ownership
 * and mime type. Replaces the old data/blobs/ local filesystem store
 * (removed 2026-09-18); app/api/blob/[id]/route.ts and the photo upload
 * routes are unchanged apart from one extra argument on saveBlob.
 *
 * Same trust boundary as lib/db.ts: server-side only, via the service-role
 * client, which is what makes access to the private bucket possible at all.
 */
import { getSupabase } from "./supabase";

const BUCKET = "photos";
const TABLE = "photo_blobs";

function idOf(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function saveBlob(
  bytes: Buffer,
  mimeType: string,
  ownerId: string,
  /** Exactly one parent: a session's photo, or a board's photo. */
  parent: { sessionId: string } | { boardId: string }
): Promise<string> {
  const id = idOf();
  const sb = getSupabase();

  const upload = await sb.storage.from(BUCKET).upload(id, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (upload.error) throw new Error(`Supabase Storage: ${upload.error.message}`);

  const insert = await sb
    .from(TABLE)
    .insert({
      id,
      owner_id: ownerId,
      mime_type: mimeType,
      ...("sessionId" in parent ? { session_id: parent.sessionId } : { board_id: parent.boardId }),
    });
  if (insert.error) {
    // best-effort cleanup — don't leave an orphaned object with no owner record
    await sb.storage.from(BUCKET).remove([id]);
    throw new Error(`Supabase: ${insert.error.message}`);
  }

  return id;
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
