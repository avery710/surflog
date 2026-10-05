import { getRequest } from "./spot-requests";
import { isRequestSlug, REQUEST_SLUG_PREFIX } from "./spots";

/**
 * A session's `spot` may be `req:<requestId>` — "log now, fill in later"
 * against the caller's own pending spot request. Same rule as boards
 * (lib/board-access.ts): anyone else's request, an unknown id or a request
 * that's no longer pending is "not found". Any other spot value passes.
 */
export async function checkRequestSpot(spot: string, ownerId: string): Promise<{ ok: boolean }> {
  if (!isRequestSlug(spot)) return { ok: true };
  const request = await getRequest(spot.slice(REQUEST_SLUG_PREFIX.length));
  return { ok: !!request && request.owner_id === ownerId && request.status === "pending" };
}
