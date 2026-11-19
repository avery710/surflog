/**
 * Creation time and GPS off a video file, read in the browser with
 * mediabunny (already used to compress short clips). iOS and AirDrop often
 * strip both; callers treat null as "ask the surfer".
 *
 * GPS lives in the raw QuickTime tag `com.apple.quicktime.location.ISO6709`
 * (or a `©xyz` atom), not in a normalised field. The capture time with its
 * offset is `com.apple.quicktime.creationdate`; mediabunny's creationTime
 * is the fallback when that tag was dropped.
 */

import { validLatLng, type LatLng } from "./spot-geo";

/** A video MIME from the file, or from the name when the browser left it blank
 *  (common for .mov). Null when it isn't a video. */
export function videoMime(file: { type: string; name: string }): string | null {
  if (file.type.startsWith("video/")) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "video/mp4";
  return null;
}

export interface VideoMeta {
  createdAt: Date | null;
  location: LatLng | null;
  durationSec: number | null;
}

/** ISO 6709 lat/lng out of a QuickTime location string. Altitude is ignored. */
export function parseIso6709(input: string): LatLng | null {
  const m = /([+-]\d{1,2}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)/.exec(input.replace(/\s/g, ""));
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!validLatLng(lat, lng)) return null;
  return { lat, lng };
}

/** A date string from a video tag, including `+0800` offsets without a colon. */
export function parseLooseDate(value: string): Date | null {
  const s = value.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function rawText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(value);
    } catch {
      return null;
    }
  }
  return null;
}

const LOCATION_KEYS = ["com.apple.quicktime.location.iso6709", "location", "location.iso6709", "©xyz", "xyz"];

/** GPS from mediabunny's raw tag bag. Unknown keys are ignored unless the
 *  value itself is an ISO 6709 string. */
export function locationFromRaw(raw: Record<string, unknown> | undefined): LatLng | null {
  if (!raw) return null;
  for (const [key, value] of Object.entries(raw)) {
    const text = rawText(value);
    if (!text) continue;
    const named = LOCATION_KEYS.includes(key.toLowerCase()) || key.toLowerCase().includes("iso6709");
    if (!named && !/^[+-]\d/.test(text.trim())) continue;
    const point = parseIso6709(text);
    if (point) return point;
  }
  return null;
}

const CREATED_KEYS = ["com.apple.quicktime.creationdate", "creation_time", "date", "©day"];

export function creationInstant(tags: {
  creationTime?: Date | null;
  date?: Date;
  raw?: Record<string, unknown>;
}): Date | null {
  const raw = tags.raw ?? {};
  for (const key of CREATED_KEYS) {
    const found = Object.entries(raw).find(([k]) => k.toLowerCase() === key);
    const text = found ? rawText(found[1]) : null;
    const parsed = text ? parseLooseDate(text) : null;
    if (parsed) return parsed;
  }
  if (tags.creationTime instanceof Date && !Number.isNaN(tags.creationTime.getTime())) return tags.creationTime;
  if (tags.date instanceof Date && !Number.isNaN(tags.date.getTime())) return tags.date;
  return null;
}

/** Best-effort. Any failure (including a browser without the decoder) is
 *  empty metadata, which the draft form treats as a manual pick. */
export async function readVideoMeta(file: Blob): Promise<VideoMeta> {
  const empty: VideoMeta = { createdAt: null, location: null, durationSec: null };
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const [tags, duration] = await Promise.all([
      input.getMetadataTags().catch(() => ({})),
      input.computeDuration().catch(() => 0),
    ]);
    const meta = tags as {
      creationTime?: Date | null;
      date?: Date;
      raw?: Record<string, unknown>;
    };
    return {
      createdAt: creationInstant(meta),
      location: locationFromRaw(meta.raw),
      durationSec: typeof duration === "number" && duration > 0 ? duration : null,
    };
  } catch {
    return empty;
  }
}
