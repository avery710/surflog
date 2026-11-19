/**
 * Turn a model's text into ride and skill spans. The worker is the only
 * caller; tests feed it recorded responses so a key and ffmpeg are not
 * required. Times are seconds. Skill segments are relative to the ride
 * clip they were labelled on, and clipsFromRide shifts them onto the
 * full video.
 */
import { isSkill, validClipBounds, type Skill } from "../lib/clips";

export interface RideSpan {
  startSec: number;
  endSec: number;
}

export interface SkillSpan {
  skill: Skill;
  startSec: number;
  endSec: number;
  /** Null when the model left it out — the review screen treats that as unsure. */
  confidence: number | null;
}

export interface DraftClip {
  startMs: number;
  endMs: number;
  skill: Skill;
  confidence: number | null;
}

export class ModelOutputError extends Error {}

/** JSON out of a fenced block or a prose-wrapped object. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.search(/[[{]/);
  if (start === -1) throw new ModelOutputError("model output had no JSON");
  const slice = body.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    const end = Math.max(slice.lastIndexOf("}"), slice.lastIndexOf("]"));
    if (end <= start) throw new ModelOutputError("model output was not JSON");
    try {
      return JSON.parse(slice.slice(0, end + 1));
    } catch {
      throw new ModelOutputError("model output was not JSON");
    }
  }
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asSkill(v: unknown): Skill | null {
  if (typeof v !== "string") return null;
  const key = v.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return isSkill(key) ? key : null;
}

function confidenceOf(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  return Math.min(1, Math.max(0, n));
}

function spans(value: unknown): Record<string, unknown>[] {
  const list = Array.isArray(value) ? value : [];
  return list.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

function pair(item: Record<string, unknown>): { startSec: number; endSec: number } | null {
  const start = num(item.startSec ?? item.start);
  const end = num(item.endSec ?? item.end);
  if (start === null || end === null || start < 0 || end <= start) return null;
  return { startSec: start, endSec: end };
}

/** Rides from `{ "rides": [...] }` or a bare array. Bad rows are dropped. */
export function parseRides(text: string): RideSpan[] {
  const json = extractJson(text);
  const list = spans(Array.isArray(json) ? json : (json as { rides?: unknown })?.rides);
  const rides: RideSpan[] = [];
  for (const item of list) {
    const span = pair(item);
    if (span) rides.push(span);
  }
  return rides;
}

/** Skill segments from `{ "segments": [...] }` or a bare array. */
export function parseSkills(text: string): SkillSpan[] {
  const json = extractJson(text);
  const list = spans(Array.isArray(json) ? json : (json as { segments?: unknown })?.segments);
  const segments: SkillSpan[] = [];
  for (const item of list) {
    const skill = asSkill(item.skill);
    const span = pair(item);
    if (!skill || !span) continue;
    segments.push({ skill, ...span, confidence: confidenceOf(item.confidence) });
  }
  return segments;
}

/**
 * Shift ride-relative segments onto the full video. A ride the model
 * couldn't split becomes one `other` clip with no confidence, when the
 * ride itself is short enough to store.
 */
export function clipsFromRide(ride: RideSpan, segments: SkillSpan[]): DraftClip[] {
  const out: DraftClip[] = [];
  for (const seg of segments) {
    const start = ride.startSec + seg.startSec;
    const end = Math.min(ride.endSec, ride.startSec + seg.endSec);
    const startMs = Math.round(Math.max(ride.startSec, start) * 1000);
    const endMs = Math.round(end * 1000);
    if (!validClipBounds(startMs, endMs)) continue;
    out.push({ startMs, endMs, skill: seg.skill, confidence: seg.confidence });
  }
  if (out.length > 0) return out;
  const startMs = Math.round(ride.startSec * 1000);
  const endMs = Math.round(ride.endSec * 1000);
  if (!validClipBounds(startMs, endMs)) return [];
  return [{ startMs, endMs, skill: "other", confidence: null }];
}
