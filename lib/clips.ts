/**
 * A clip is one labelled stretch of a session's video (lib/types.ts Photo),
 * stored as a row — the video file is not cut. Skills and reactions are a
 * closed list so the review screen, the API and a later tagger agree.
 *
 * An AI clip under CONFIDENCE_CUTOFF is shown as "Unsure, what's this?"
 * until the surfer picks a skill. Hand labels (taggedBy "user") always
 * show the skill they stored, confidence or not.
 */

export const SKILLS = ["takeoff", "bottom_turn", "trim", "cutback", "other", "not_a_ride"] as const;
export type Skill = (typeof SKILLS)[number];

export const REACTIONS = ["nailed_it", "late", "fell", "not_sure"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const TAGGED_BY = ["ai", "user"] as const;
export type TaggedBy = (typeof TAGGED_BY)[number];

/** Below this, an unconfirmed AI clip hides its guessed skill. */
export const CONFIDENCE_CUTOFF = 0.55;

/** A clip has to be a moment, not a whole hour of footage. */
export const MIN_CLIP_MS = 200;
export const MAX_CLIP_MS = 10 * 60 * 1000;

/** How long a hand-added clip starts at, measured from the playhead. */
export const DEFAULT_CLIP_MS = 8_000;

export interface Clip {
  id: string;
  ownerId: string;
  sessionId: string;
  /** photo_blobs id of the source video. */
  mediaId: string;
  startMs: number;
  endMs: number;
  skill: Skill;
  taggedBy: TaggedBy;
  /** Set when taggedBy is "ai"; null for a hand label. */
  model: string | null;
  confidence: number | null;
  confirmed: boolean;
  reaction: Reaction | null;
  createdAt: string;
}

export function isSkill(v: unknown): v is Skill {
  return typeof v === "string" && (SKILLS as readonly string[]).includes(v);
}

export function isReaction(v: unknown): v is Reaction {
  return typeof v === "string" && (REACTIONS as readonly string[]).includes(v);
}

export function isTaggedBy(v: unknown): v is TaggedBy {
  return typeof v === "string" && (TAGGED_BY as readonly string[]).includes(v);
}

export function validConfidence(v: number | null): boolean {
  return v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1);
}

export function validClipBounds(startMs: number, endMs: number): boolean {
  return (
    Number.isInteger(startMs) &&
    Number.isInteger(endMs) &&
    startMs >= 0 &&
    endMs > startMs &&
    endMs - startMs >= MIN_CLIP_MS &&
    endMs - startMs <= MAX_CLIP_MS
  );
}

/** True when the review screen should ask, not show the stored skill. */
export function clipNeedsSkillPick(
  clip: Pick<Clip, "taggedBy" | "confirmed" | "confidence">
): boolean {
  if (clip.confirmed || clip.taggedBy !== "ai") return false;
  return clip.confidence == null || clip.confidence < CONFIDENCE_CUTOFF;
}

export interface ClipCreate {
  mediaId: string;
  startMs: number;
  endMs: number;
  skill: Skill;
  reaction: Reaction | null;
}

export interface ClipPatch {
  startMs?: number;
  endMs?: number;
  skill?: Skill;
  reaction?: Reaction | null;
  confirmed?: boolean;
}

const MEDIA_ID = /^[0-9a-f]{32}$/;

/** The body of POST /api/sessions/:id/clips. Null when it isn't a clip. */
export function readClipCreate(body: unknown): ClipCreate | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const mediaId = typeof b.mediaId === "string" ? b.mediaId : "";
  if (!MEDIA_ID.test(mediaId)) return null;
  if (typeof b.startMs !== "number" || typeof b.endMs !== "number") return null;
  if (!validClipBounds(b.startMs, b.endMs)) return null;
  if (!isSkill(b.skill)) return null;
  let reaction: Reaction | null = null;
  if (b.reaction != null) {
    if (!isReaction(b.reaction)) return null;
    reaction = b.reaction;
  }
  return { mediaId, startMs: b.startMs, endMs: b.endMs, skill: b.skill, reaction };
}

/** The body of PATCH /api/clips/:id. Null when nothing valid is in it. */
export function readClipPatch(body: unknown): ClipPatch | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const patch: ClipPatch = {};
  if ("startMs" in b) {
    if (typeof b.startMs !== "number" || !Number.isInteger(b.startMs) || b.startMs < 0) return null;
    patch.startMs = b.startMs;
  }
  if ("endMs" in b) {
    if (typeof b.endMs !== "number" || !Number.isInteger(b.endMs) || b.endMs < 0) return null;
    patch.endMs = b.endMs;
  }
  if ("skill" in b) {
    if (!isSkill(b.skill)) return null;
    patch.skill = b.skill;
  }
  if ("reaction" in b) {
    if (b.reaction === null) patch.reaction = null;
    else if (isReaction(b.reaction)) patch.reaction = b.reaction;
    else return null;
  }
  if ("confirmed" in b) {
    if (typeof b.confirmed !== "boolean") return null;
    patch.confirmed = b.confirmed;
  }
  return Object.keys(patch).length ? patch : null;
}

/** "m:ss" for a clip edge. Numbers only — not translated. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function sessionVideo(
  photos: readonly { id: string; type: string }[]
): { id: string; type: string } | null {
  return photos.find((p) => p.type.startsWith("video/")) ?? null;
}

/** Confirmed clips grouped in skill order. Empty skills are left out. */
export function clipsBySkill(clips: readonly Clip[]): { skill: Skill; clips: Clip[] }[] {
  const confirmed = clips.filter((c) => c.confirmed);
  return SKILLS.map((skill) => ({
    skill,
    clips: confirmed.filter((c) => c.skill === skill).sort((a, b) => a.startMs - b.startMs),
  })).filter((g) => g.clips.length > 0);
}

/**
 * A new hand clip around a playhead. Pulled back so it still fits in the
 * video and stays at least MIN_CLIP_MS long. Null when the video is too
 * short to hold one.
 */
export function clipAround(playheadMs: number, durationMs: number, lengthMs = DEFAULT_CLIP_MS): {
  startMs: number;
  endMs: number;
} | null {
  if (!Number.isFinite(durationMs) || durationMs < MIN_CLIP_MS) return null;
  const dur = Math.round(durationMs);
  const length = Math.min(Math.max(lengthMs, MIN_CLIP_MS), MAX_CLIP_MS, dur);
  let start = Math.max(0, Math.round(playheadMs));
  let end = start + length;
  if (end > dur) {
    end = dur;
    start = Math.max(0, end - length);
  }
  if (end - start < MIN_CLIP_MS) return null;
  return { startMs: start, endMs: end };
}
