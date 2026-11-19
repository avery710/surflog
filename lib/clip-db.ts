/**
 * Clips table — supabase/migrations/20261119000000_create_clips.sql.
 * Server-only, same trust boundary as lib/db.ts: the service-role client,
 * ownership checked by the caller (lib/clip-service.ts).
 */
import { isMissingTable } from "./spot-store";
import { getSupabase } from "./supabase";
import type { Clip, Reaction, Skill, TaggedBy } from "./clips";

const TABLE = "clips";

export class ClipsNotReady extends Error {
  constructor() {
    super("clips aren't switched on yet — the 20261119000000 migration hasn't been applied");
  }
}

interface ClipRow {
  id: string;
  owner_id: string;
  session_id: string;
  media_id: string;
  start_ms: number;
  end_ms: number;
  skill: Skill;
  tagged_by: TaggedBy;
  model: string | null;
  confidence: number | null;
  confirmed: boolean;
  reaction: Reaction | null;
  created_at: string;
}

function rowToClip(row: ClipRow): Clip {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sessionId: row.session_id,
    mediaId: row.media_id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    skill: row.skill,
    taggedBy: row.tagged_by,
    model: row.model,
    confidence: row.confidence,
    confirmed: row.confirmed,
    reaction: row.reaction,
    createdAt: row.created_at,
  };
}

function clipToRow(clip: Partial<Clip>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (clip.id !== undefined) row.id = clip.id;
  if (clip.ownerId !== undefined) row.owner_id = clip.ownerId;
  if (clip.sessionId !== undefined) row.session_id = clip.sessionId;
  if (clip.mediaId !== undefined) row.media_id = clip.mediaId;
  if (clip.startMs !== undefined) row.start_ms = clip.startMs;
  if (clip.endMs !== undefined) row.end_ms = clip.endMs;
  if (clip.skill !== undefined) row.skill = clip.skill;
  if (clip.taggedBy !== undefined) row.tagged_by = clip.taggedBy;
  if (clip.model !== undefined) row.model = clip.model;
  if (clip.confidence !== undefined) row.confidence = clip.confidence;
  if (clip.confirmed !== undefined) row.confirmed = clip.confirmed;
  if (clip.reaction !== undefined) row.reaction = clip.reaction;
  if (clip.createdAt !== undefined) row.created_at = clip.createdAt;
  return row;
}

function raise(error: { message: string; code?: string }): never {
  if (isMissingTable(error)) throw new ClipsNotReady();
  throw new Error(`Supabase: ${error.message}`);
}

export function newClipId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function listClips(sessionId: string, ownerId: string): Promise<Clip[]> {
  const result = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("session_id", sessionId)
    .eq("owner_id", ownerId)
    .order("start_ms", { ascending: true })
    .order("created_at", { ascending: true });
  if (result.error) raise(result.error);
  return (result.data as ClipRow[]).map(rowToClip);
}

export async function getClip(id: string): Promise<Clip | null> {
  const result = await getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (result.error) raise(result.error);
  return result.data ? rowToClip(result.data as ClipRow) : null;
}

export async function insertClip(clip: Clip): Promise<Clip> {
  const result = await getSupabase().from(TABLE).insert(clipToRow(clip)).select("*").single();
  if (result.error) raise(result.error);
  return rowToClip(result.data as ClipRow);
}

export async function updateClip(id: string, patch: Partial<Clip>): Promise<Clip | null> {
  const result = await getSupabase().from(TABLE).update(clipToRow(patch)).eq("id", id).select("*").maybeSingle();
  if (result.error) raise(result.error);
  return result.data ? rowToClip(result.data as ClipRow) : null;
}

export async function deleteClip(id: string): Promise<void> {
  const result = await getSupabase().from(TABLE).delete().eq("id", id);
  if (result.error) raise(result.error);
}
