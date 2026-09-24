/**
 * CWA (Taiwan Central Weather Administration) opendata tide forecast —
 * dataset F-A0021-001, server-side only. Free key from
 * https://opendata.cwa.gov.tw/user/authkey (CWA_API_KEY env var).
 *
 * Keyed by TOWNSHIP, not lat/lng — a different matching scheme from
 * Open-Meteo's grid-snap. See lib/spots.ts `tideTownship`. Verified live
 * 2026-09-22: `LocationName` filters server-side, so only one township's
 * data is fetched per call.
 *
 * The dataset gives ~32 days of discrete HIGH/LOW tide EVENTS per township
 * (4/day), not a continuous curve — this picks the single nearest event to
 * the session's time rather than interpolating a height at that exact
 * moment (kept in `tideM`/`tideType`/`time`, for old rows). It also returns
 * `events`: the bracketing pair (last event at/before the session, first
 * after it), each with its own time and height — see CLAUDE.md "Entry
 * schema" `TideEvent`. Heights come back in centimetres; converted to
 * metres here to match the rest of the app's units (see CLAUDE.md
 * "Conventions").
 */
import type { CondCwaTide, TideEvent } from "./types";
import { pickBracket } from "./tide-bracket";

const BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-A0021-001";
const MAX_EVENT_GAP_MS = 7 * 60 * 60 * 1000;

interface CwaTideEvent {
  DateTime: string;
  Tide: string; // "滿潮" (high) | "乾潮" (low)
  TideHeights?: { AboveTWVD?: string | number };
}

interface CwaLocation {
  LocationName: string;
  TimePeriods?: { Daily?: { Date: string; Time?: CwaTideEvent[] }[] };
}

/**
 * @param whenLocal "YYYY-MM-DDTHH:mm" in Asia/Taipei — the session's own format
 */
export async function getTide(
  township: string,
  whenLocal: string
): Promise<CondCwaTide | null> {
  const key = process.env.CWA_API_KEY;
  if (!key) return null;

  const url =
    `${BASE}?Authorization=${encodeURIComponent(key)}&format=JSON` +
    `&LocationName=${encodeURIComponent(township)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const body = await res.json();
  if (body?.success !== "true" && body?.success !== true) return null;

  const forecasts: { Location: CwaLocation }[] = body?.records?.TideForecasts ?? [];
  const loc = forecasts.find((f) => f.Location?.LocationName === township)?.Location;
  if (!loc) return null;

  const targetMs = new Date(`${whenLocal}:00+08:00`).getTime();

  // Daily[] is NOT sorted by date (verified live 2026-09-24: first entry can
  // be e.g. 2026-10-05, then 2026-10-04) — flatten every day's events and
  // sort by DateTime before picking anything positional (prev/next bracket).
  const allEvents = (loc.TimePeriods?.Daily ?? [])
    .flatMap((day) => day.Time ?? [])
    .filter((t) => t.DateTime)
    .sort((a, b) => new Date(a.DateTime).getTime() - new Date(b.DateTime).getTime());

  const eventMs = (t: CwaTideEvent) => new Date(t.DateTime).getTime();

  // Bracketing events: last at/before the session time, first after it.
  // The dataset is forward-only (today onward) — without the 7h cap below,
  // a past/far-future session would silently get whichever forecast-window
  // edge is nearest, days off. Highs/lows are ~6h12m apart, so a real match
  // on both sides is always well under 7h.
  const { prev, next } = pickBracket(allEvents, targetMs, eventMs);
  const withinCap = (e: CwaTideEvent | null): e is CwaTideEvent =>
    e != null && Math.abs(eventMs(e) - targetMs) <= MAX_EVENT_GAP_MS;

  const events: TideEvent[] = [prev, next].filter(withinCap).map(toTideEvent);

  // Legacy single-event fields, kept for old rows/readers: whichever of the
  // bracket is numerically closer to the session time.
  const nearest =
    withinCap(prev) && withinCap(next)
      ? Math.abs(eventMs(prev) - targetMs) <= Math.abs(eventMs(next) - targetMs)
        ? prev
        : next
      : withinCap(prev)
        ? prev
        : withinCap(next)
          ? next
          : null;
  if (!nearest) return null;

  const cm = nearest.TideHeights?.AboveTWVD;
  const tideM = cm != null && cm !== "" ? Number(cm) / 100 : null;

  return {
    tideM,
    tideType: nearest.Tide === "滿潮" ? "high" : nearest.Tide === "乾潮" ? "low" : null,
    time: nearest.DateTime,
    stationTownship: township,
    events: events.length > 0 ? events : undefined,
    source: "cwa",
    fetchedAt: new Date().toISOString(),
  };
}

function toTideEvent(event: CwaTideEvent): TideEvent {
  const cm = event.TideHeights?.AboveTWVD;
  return {
    type: event.Tide === "滿潮" ? "high" : "low",
    time: event.DateTime.slice(0, 16), // "YYYY-MM-DDTHH:mm+08:00..." -> local, no suffix
    heightM: cm != null && cm !== "" ? Number(cm) / 100 : null,
  };
}
