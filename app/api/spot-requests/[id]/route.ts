import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { approveRequest, declineRequest } from "@/lib/spot-approval";
import { getRequest, rowToRequest } from "@/lib/spot-requests";
import { getSpotRow, rowToSpot } from "@/lib/spot-store";
import { isSpotAdmin } from "@/lib/spot-admin";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/spot-requests/:id — admin only (404 for anyone else or an
 * unknown id).
 *   { action: "decline" }                      → 200 { request }
 *       Its sessions keep the typed name, no conditions.
 *   { action: "approve", spotSlug: "<slug>" }  → 200 { request, moved, withConditions }
 *       Link the request to an EXISTING spot (e.g. it turned out to be a
 *       duplicate): sessions move to it and get conditions for their own
 *       date/time in the spot's timezone. 404 { code: "spot_not_found" }.
 *   To approve by creating a new spot, POST /api/spots with `requestId`.
 *   409 { code: "request_resolved" } if it isn't pending any more.
 * `request` is the admin shape (incl. requesterName/requesterEmail).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const request = await getRequest(id);
  if (!request) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "request already resolved", code: "request_resolved" }, { status: 409 });
  }

  try {
    if (body?.action === "decline") {
      const done = await declineRequest(id);
      if (!done) return NextResponse.json({ error: "request already resolved", code: "request_resolved" }, { status: 409 });
      return NextResponse.json({ request: rowToRequest(done, true) });
    }
    if (body?.action === "approve" && typeof body.spotSlug === "string") {
      const row = await getSpotRow(body.spotSlug);
      if (!row) return NextResponse.json({ error: "spot not found", code: "spot_not_found" }, { status: 404 });
      const result = await approveRequest(id, rowToSpot(row));
      if (!result.request) return NextResponse.json({ error: "request already resolved", code: "request_resolved" }, { status: 409 });
      return NextResponse.json({
        request: rowToRequest(result.request, true),
        moved: result.moved,
        withConditions: result.withConditions,
      });
    }
    return NextResponse.json({ error: "action must be decline or approve" }, { status: 400 });
  } catch (e) {
    console.error("[api/spot-requests/:id] PATCH failed", e);
    return NextResponse.json({ error: "couldn't update the request" }, { status: 500 });
  }
}
