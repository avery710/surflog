import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSpotAdmin } from "@/lib/spot-admin";
import { EditTableMissingError, listAllEditRequests, listOwnPending, toAdmin, toOwn } from "@/lib/spot-edit-requests";

/**
 * GET /api/spot-edit-requests?mine=1 — the caller's own pending suggestions
 *   (any signed-in user), 200 { requests: OwnEditRequest[] }, no requester data.
 * GET /api/spot-edit-requests — EVERY suggestion with requester name/email and
 *   what each spot held at the time (admin only; anyone else gets 404, like
 *   the other admin routes), pending first. 200 { requests: AdminEditRequest[] }
 * 503 { code: "unavailable" } until the table exists.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mine = req.nextUrl.searchParams.get("mine") === "1";
  if (!mine && !isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    if (mine) return NextResponse.json({ requests: (await listOwnPending(session.user.id)).map(toOwn) });
    return NextResponse.json({ requests: (await listAllEditRequests()).map(toAdmin) });
  } catch (e) {
    if (e instanceof EditTableMissingError) {
      return NextResponse.json({ error: "spot edit suggestions aren't switched on yet", code: "unavailable" }, { status: 503 });
    }
    console.error("[api/spot-edit-requests] GET failed", e);
    return NextResponse.json({ error: "couldn't load suggestions" }, { status: 500 });
  }
}
