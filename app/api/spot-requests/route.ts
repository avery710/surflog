import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequest, listAllRequests, listOwnRequests, rowToRequest } from "@/lib/spot-requests";
import { notifySpotRequest } from "@/lib/spot-request-notify";
import { isSpotAdmin } from "@/lib/spot-admin";
import { locationFromInput } from "@/lib/spot-create";

const MAX_PENDING_PER_USER = 20;

/** The minimum a requester may read back about their own request. */
const own = (r: { id: string; name: string; status: string; spot_slug: string | null }) => ({
  id: r.id,
  name: r.name,
  status: r.status,
  spotSlug: r.spot_slug,
});

/**
 * GET /api/spot-requests?mine=1 — the caller's own requests, minimal shape,
 *   200 { requests: { id, name, status, spotSlug }[] }  (any signed-in user)
 * GET /api/spot-requests — EVERY request with requester name/email, location,
 *   note, timestamps (admin only; anyone else gets 404 like the other admin
 *   routes), pending first then newest.
 *   200 { requests: SpotRequest[] }  (see lib/spot-requests.ts)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (req.nextUrl.searchParams.get("mine") === "1") {
    return NextResponse.json({ requests: (await listOwnRequests(session.user.id)).map(own) });
  }
  if (!isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ requests: (await listAllRequests()).map((r) => rowToRequest(r, true)) });
}

/**
 * POST /api/spot-requests — ask for a spot. Any signed-in user.
 * Body: { name (2–80, required), location?, note? (≤500) } where `location`
 * is a Google Maps link, pasted coordinates, or the browser's position as
 * "lat, lng". Unparsable location text is kept as typed with no lat/lng.
 * 201 { request: { id, name, status: "pending", spotSlug: null } }
 * 400 { code: "invalid" } · 429 { code: "limit" } (20 pending at once)
 * The session `spot` value for logging against it is `req:<id>`.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = text(body.name).replace(/\s+/g, " ");
  const locationText = text(body.location);
  const note = text(body.note);
  if (name.length < 2 || name.length > 80 || locationText.length > 2000 || note.length > 500) {
    return NextResponse.json({ error: "invalid request", code: "invalid" }, { status: 400 });
  }

  try {
    const pending = (await listOwnRequests(userId)).filter((r) => r.status === "pending").length;
    if (pending >= MAX_PENDING_PER_USER) {
      return NextResponse.json({ error: "too many pending requests", code: "limit" }, { status: 429 });
    }

    const point = locationText ? await locationFromInput(locationText) : null;
    const row = await createRequest({
      id: crypto.randomUUID(),
      owner_id: userId,
      requester_name: session.user?.name ?? null,
      requester_email: session.user?.email ?? null,
      name,
      location_text: locationText || null,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      note: note || null,
    });

    // best-effort: the admin notification must never block the request
    void Promise.resolve()
      .then(() => notifySpotRequest(row))
      .catch((e) => console.error("[spot-request] notify failed", e));

    return NextResponse.json({ request: own(row) }, { status: 201 });
  } catch (e) {
    console.error("[api/spot-requests] POST failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "couldn't save the request" }, { status: 500 });
  }
}
