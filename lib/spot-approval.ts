/**
 * Approving a spot request: the requested name becomes (or is matched to) a
 * real spot, and every session logged against `req:<id>` — any owner's —
 * moves to the spot's slug and gets conditions for its own date/time in the
 * spot's timezone. Server-side, best-effort per session: one failed fetch
 * leaves that session without conditions but never aborts the approval.
 */
import { listSessionsBySpot, moveSpotNotes, updateSession } from "./db";
import { getConditions } from "./openmeteo";
import { getTide } from "./cwa-tide";
import { resolveRequest, type SpotRequestRow } from "./spot-requests";
import { requestSlug, type Spot } from "./spots";
import type { Session } from "./types";

export interface ApprovalResult {
  request: SpotRequestRow | null;
  /** Sessions moved to the spot. */
  moved: number;
  /** Of those, how many got Open-Meteo conditions. */
  withConditions: number;
}

export async function approveRequest(requestId: string, spot: Spot): Promise<ApprovalResult> {
  const request = await resolveRequest(requestId, "approved", spot.slug);
  if (!request) return { request: null, moved: 0, withConditions: 0 };

  const from = requestSlug(requestId);
  const sessions = await listSessionsBySpot(from);
  let withConditions = 0;

  for (const s of sessions) {
    const patch: Partial<Session> = { spot: spot.slug };
    if (spot.lat != null && spot.lng != null) {
      try {
        patch.condOpenMeteo = await getConditions(spot.lat, spot.lng, s.when, spot.timezone);
        withConditions++;
      } catch {
        // leave null — it can be refreshed from the edit panel later
      }
    }
    if (spot.tideTownship) {
      try {
        patch.condCwaTide = await getTide(spot.tideTownship, s.when);
      } catch {
        // likewise
      }
    }
    try {
      await updateSession(s.id, patch);
    } catch (e) {
      console.error("[spot-approval] couldn't re-point session", s.id, e);
    }
  }

  await moveSpotNotes(from, spot.slug).catch((e) => console.error("[spot-approval] notes", e));
  return { request, moved: sessions.length, withConditions };
}

export async function declineRequest(requestId: string): Promise<SpotRequestRow | null> {
  return resolveRequest(requestId, "declined", null);
}
