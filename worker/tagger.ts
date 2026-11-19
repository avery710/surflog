/**
 * One small interface in front of the model. TAGGER picks the
 * implementation (only gemini today) so a later model is a config change.
 */
import { GeminiTagger } from "./gemini";
import type { RideSpan, SkillSpan } from "./parse";

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
  return new GeminiTagger(key, env.GEMINI_MODEL?.trim() || "gemini-2.5-flash");
}
