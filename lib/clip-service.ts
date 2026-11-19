/**
 * Clip create / update / delete for one owner. Web routes call this; a
 * later tagger writes rows through insertClip in lib/clip-db.ts with
 * taggedBy "ai". A foreign or unknown id is 404, never 403.
 */
import { getSession } from "@/lib/db";
import { deleteClip, getClip, insertClip, listClips, newClipId, updateClip, ClipsNotReady } from "@/lib/clip-db";
import {
  validClipBounds,
  type Clip,
  type ClipCreate,
  type ClipPatch,
} from "@/lib/clips";

export type ClipResult<T> = { ok: true; data: T } | { ok: false; status: 400 | 404; error: string };

const fail = (status: 400 | 404, error: string): ClipResult<never> => ({ ok: false, status, error });

function notReady(e: unknown): ClipResult<never> | null {
  if (e instanceof ClipsNotReady) return fail(400, e.message);
  return null;
}

async function ownedSession(ownerId: string, sessionId: string) {
  const session = await getSession(sessionId);
  if (!session || session.ownerId !== ownerId) return null;
  return session;
}

export async function listClipsFor(ownerId: string, sessionId: string): Promise<ClipResult<Clip[]>> {
  if (!(await ownedSession(ownerId, sessionId))) return fail(404, "not found");
  try {
    return { ok: true, data: await listClips(sessionId, ownerId) };
  } catch (e) {
    return notReady(e) ?? Promise.reject(e);
  }
}

/** A hand label. taggedBy is always "user"; model and confidence stay null. */
export async function createClipFor(
  ownerId: string,
  sessionId: string,
  input: ClipCreate
): Promise<ClipResult<Clip>> {
  const session = await ownedSession(ownerId, sessionId);
  if (!session) return fail(404, "not found");
  const photo = session.photos.find((p) => p.id === input.mediaId);
  if (!photo || !photo.type.startsWith("video/")) {
    return fail(400, "that video isn't on this session");
  }
  if (!validClipBounds(input.startMs, input.endMs)) return fail(400, "invalid clip bounds");

  const clip: Clip = {
    id: newClipId(),
    ownerId,
    sessionId,
    mediaId: input.mediaId,
    startMs: input.startMs,
    endMs: input.endMs,
    skill: input.skill,
    taggedBy: "user",
    model: null,
    confidence: null,
    confirmed: false,
    reaction: input.reaction,
    createdAt: new Date().toISOString(),
  };
  try {
    return { ok: true, data: await insertClip(clip) };
  } catch (e) {
    return notReady(e) ?? Promise.reject(e);
  }
}

export async function updateClipFor(ownerId: string, id: string, patch: ClipPatch): Promise<ClipResult<Clip>> {
  let existing: Clip | null;
  try {
    existing = await getClip(id);
  } catch (e) {
    return notReady(e) ?? Promise.reject(e);
  }
  if (!existing || existing.ownerId !== ownerId) return fail(404, "not found");

  const startMs = patch.startMs ?? existing.startMs;
  const endMs = patch.endMs ?? existing.endMs;
  if (!validClipBounds(startMs, endMs)) return fail(400, "invalid clip bounds");

  const next: Partial<Clip> = {};
  if (patch.startMs !== undefined) next.startMs = patch.startMs;
  if (patch.endMs !== undefined) next.endMs = patch.endMs;
  if (patch.skill !== undefined) {
    const changed = patch.skill !== existing.skill;
    // An unsure AI guess stays hidden until the surfer picks a skill, including
    // the one the model already stored.
    const claiming = existing.taggedBy === "ai" && !existing.confirmed;
    if (changed || claiming) {
      next.skill = patch.skill;
      next.taggedBy = "user";
    }
  }
  if (patch.reaction !== undefined) next.reaction = patch.reaction;
  if (patch.confirmed !== undefined) next.confirmed = patch.confirmed;
  if (Object.keys(next).length === 0) return { ok: true, data: existing };

  try {
    const saved = await updateClip(id, next);
    if (!saved) return fail(404, "not found");
    return { ok: true, data: saved };
  } catch (e) {
    return notReady(e) ?? Promise.reject(e);
  }
}

export async function deleteClipFor(ownerId: string, id: string): Promise<ClipResult<{ ok: true }>> {
  let existing: Clip | null;
  try {
    existing = await getClip(id);
  } catch (e) {
    return notReady(e) ?? Promise.reject(e);
  }
  if (!existing || existing.ownerId !== ownerId) return fail(404, "not found");
  try {
    await deleteClip(id);
  } catch (e) {
    return notReady(e) ?? Promise.reject(e);
  }
  return { ok: true, data: { ok: true } };
}
