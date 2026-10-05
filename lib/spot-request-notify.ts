import type { SpotRequestRow } from "./spot-requests";

/**
 * THE HOOK for telling the admin about a new spot request. Called once from
 * POST /api/spot-requests after the request is stored; a throw or rejection
 * is caught and logged there and never blocks the user's request.
 *
 * Not wired to anything yet: the app has no email provider (decided
 * 2026-10-05, none picked or installed). To send email, implement it here —
 * `request` carries the requester's display name/email snapshot, the
 * requested name, raw location text, parsed lat/lng and the note; the
 * admin's address would come from SPOT_ADMIN_EMAILS (lib/spot-admin.ts).
 */
export async function notifySpotRequest(request: SpotRequestRow): Promise<void> {
  console.info(`[spot-request] new request "${request.name}" (${request.id}) — no notifier configured`);
}
