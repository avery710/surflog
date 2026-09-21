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
 * moment. Heights come back in centimetres; converted to metres here to
 * match the rest of the app's units (see CLAUDE.md "Conventions").
 */
import type { CondCwaTide } from "./types";

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

  let nearest: { event: CwaTideEvent; diffMs: number } | null = null;
  for (const day of loc.TimePeriods?.Daily ?? []) {
    for (const t of day.Time ?? []) {
      const diffMs = Math.abs(new Date(t.DateTime).getTime() - targetMs);
      if (!nearest || diffMs < nearest.diffMs) nearest = { event: t, diffMs };
    }
  }
  // The dataset is forward-only (today onward). Without this cap, a past
  // session would silently get the forecast window's first event, days off.
  // Highs/lows are ~6h12m apart, so a real match is always well under 7h.
  if (!nearest || nearest.diffMs > MAX_EVENT_GAP_MS) return null;

  const cm = nearest.event.TideHeights?.AboveTWVD;
  const tideM = cm != null && cm !== "" ? Number(cm) / 100 : null;

  return {
    tideM,
    tideType: nearest.event.Tide === "滿潮" ? "high" : nearest.event.Tide === "乾潮" ? "low" : null,
    time: nearest.event.DateTime,
    stationTownship: township,
    source: "cwa",
    fetchedAt: new Date().toISOString(),
  };
}
