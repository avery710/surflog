/**
 * One small interface in front of the model. TAGGER picks the
 * implementation (only gemini today). GEMINI_MODEL picks the Gemini id.
 *
 * Ids checked against https://ai.google.dev/gemini-api/docs/models on
 * 2026-11-19. All three below are listed there with no extra suffix.
 * `gemini-2.5-flash` is deprecated on that page (gone from AI Studio;
 * from 2026-12-01 requests to it are routed to `gemini-3.5-flash-lite`).
 */
import { GeminiTagger } from "./gemini";
import type { RideSpan, SkillSpan } from "./parse";

/** Used when GEMINI_MODEL is unset. Gemini 3.8 Flash. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

/** Default plus the two documented alternatives. Any other id is still
 *  accepted: GEMINI_MODEL is a string, not a closed list. */
export const DOCUMENTED_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-4-hydrogen",
] as const;

export function geminiModelId(env: Record<string, string | undefined>): string {
  const set = env.GEMINI_MODEL?.trim();
  return set || DEFAULT_GEMINI_MODEL;
}

export interface VideoFile {
  path: string;
  mimeType: string;
}

export interface Tagger {
  /** Stored on each clip row. */
  readonly model: string;
  findRides(video: VideoFile): Promise<RideSpan[]>;
  labelRide(video: VideoFile): Promise<SkillSpan[]>;
}

export function createTagger(env: Record<string, string | undefined> = process.env): Tagger {
  const which = (env.TAGGER || "gemini").toLowerCase();
  if (which !== "gemini") throw new Error(`Unknown TAGGER "${which}". Set TAGGER=gemini.`);
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GeminiTagger(key, geminiModelId(env));
}
