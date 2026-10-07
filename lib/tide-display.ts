/**
 * Which tide the session card shows, and its rising/falling headline — pure,
 * so the card, the share images and the public share page all read the same
 * numbers. Rules (see CLAUDE.md "Status", 2026-09-24/28): CWA wins whenever
 * it stored `events`, else Open-Meteo's `tideEvents`; the trend then falls
 * back to CWA's legacy single event, then Open-Meteo's `seaLevelTrend`.
 */
import type { Session, TideEvent } from "./types";

/**
 * Whether the tide was rising or falling at the session, read off the
 * bracketing events: heading toward a high (or just past a low) means
 * rising. Works with a single event too — older CWA rows only stored the
 * nearest one. `time` and `sessionWhen` share the "YYYY-MM-DDTHH:mm"
 * format, so a string compare orders them.
 */
export function tideTrend(input: TideEvent[], sessionWhen: string): "rising" | "falling" | null {
  const events = [...input].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const next = events.find((e) => e.time > sessionWhen);
  if (next) return next.type === "high" ? "rising" : "falling";
  const prev = events.findLast((e) => e.time <= sessionWhen);
  if (prev) return prev.type === "low" ? "rising" : "falling";
  return null;
}

export interface TideDisplay {
  source: "cwa" | "open-meteo" | null;
  events: TideEvent[];
  trend: "rising" | "falling" | null;
}

export function pickTide(session: Pick<Session, "when" | "condCwaTide" | "condOpenMeteo">): TideDisplay {
  const cwa = session.condCwaTide;
  const om = session.condOpenMeteo;
  const cwaEvents = cwa?.events ?? [];
  const omEvents = om?.tideEvents ?? [];
  const source: TideDisplay["source"] =
    cwaEvents.length > 0 ? "cwa" : omEvents.length > 0 ? "open-meteo" : null;
  const events = source === "cwa" ? cwaEvents : omEvents;
  // Older CWA rows (pre-2026-09-24) only ever stored the single nearest
  // event, not `events` — build a one-item array so tideTrend() (which
  // already handles a lone event) can still read a direction off it.
  const cwaLegacyEvent: TideEvent[] =
    cwa?.time && cwa?.tideType ? [{ type: cwa.tideType, time: cwa.time.slice(0, 16), heightM: cwa.tideM }] : [];
  const trend =
    tideTrend(events, session.when) ??
    tideTrend(cwaLegacyEvent, session.when) ??
    om?.seaLevelTrend ??
    null;
  return { source, events, trend };
}

/** The next turning point after the session (the next high when rising, the
 *  next low when falling is what the card's small print shows: the next two
 *  stored events, first one first). */
export function nextTideEvents(events: TideEvent[], sessionWhen: string, count = 2): TideEvent[] {
  return [...events]
    .filter((e) => e.time > sessionWhen)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, count);
}
