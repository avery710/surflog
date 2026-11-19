/**
 * What a chosen video suggests for a session that has not been saved yet.
 * The surfer still picks spot and time; this only fills the draft.
 * Missing metadata leaves the field empty so they pick it by hand.
 */

import { latestLoggableWhen, nearestSlotInZone } from "./format";
import { distanceM, validLatLng, type LatLng } from "./spot-geo";
import { TIME_SLOTS } from "./time-slots";

/** A GPS point farther than this from every break is not a spot. 30 km
 *  matches the "same coast" neighbour used when adding a spot. */
export const NEAREST_SPOT_MAX_M = 30_000;

export interface SpotPoint {
  slug: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
}

/** The closest catalogue spot within NEAREST_SPOT_MAX_M, or null. */
export function nearestSpot(
  spots: readonly SpotPoint[],
  point: LatLng,
  maxM = NEAREST_SPOT_MAX_M
): { slug: string; distanceM: number; timezone: string } | null {
  if (!validLatLng(point.lat, point.lng)) return null;
  let best: { slug: string; distanceM: number; timezone: string } | null = null;
  for (const s of spots) {
    if (s.lat == null || s.lng == null || !validLatLng(s.lat, s.lng)) continue;
    const d = distanceM(point, { lat: s.lat, lng: s.lng });
    if (d > maxM) continue;
    if (!best || d < best.distanceM) best = { slug: s.slug, distanceM: d, timezone: s.timezone };
  }
  return best;
}

/**
 * "YYYY-MM-DDTHH:mm" at the spot for an instant, on the half-hour grid
 * (same rounding as the log form). A time that hasn't happened yet is
 * pulled back to the latest slot that can still be logged. Null when the
 * instant or the zone can't be read.
 */
export function draftWhen(instant: Date, timeZone: string, now: Date = new Date()): string | null {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) return null;
  let date: string;
  let time: string;
  try {
    date = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
    time = nearestSlotInZone(timeZone, instant);
  } catch {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const when = `${date}T${time}`;
  const latest = latestLoggableWhen(timeZone, now);
  if (when <= latest) return when;
  const day = latest.slice(0, 10);
  const slot = [...TIME_SLOTS].reverse().find((s) => `${day}T${s}` <= latest);
  return slot ? `${day}T${slot}` : null;
}
