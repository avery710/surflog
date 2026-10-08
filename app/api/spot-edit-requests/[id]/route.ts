import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { approveEditRequest, declineEditRequest } from "@/lib/spot-edit-approval";
import { isSpotAdmin } from "@/lib/spot-admin";
import { EditTableMissingError, getEditRequest, withdrawPending } from "@/lib/spot-edit-requests";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

const unavailable = () =>
  NextResponse.json({ error: "spot edit suggestions aren't switched on yet", code: "unavailable" }, { status: 503 });

/**
 * PATCH /api/spot-edit-requests/:id — admin only (404 for anyone else or an
 * unknown id).
 *   { action: "decline" }                         → 200 { request }
 *   { action: "approve", confirmDistinct? }       → 200 { request, spot }
 *       Applies the changes to the spot as it is NOW (it may have changed
 *       since — the admin sees that in the list and may still approve).
 *       Same checks as editing a spot: 400 invalid · 409 duplicate / nearby
 *       (resend with confirmDistinct) · 422 no_sea_data · 502 lookup_failed.
 *   409 { code: "resolved" } if it isn't pending any more.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  try {
    if (body?.action === "decline") {
      const request = await getEditRequest(id);
      if (!request) return NextResponse.json({ error: "not found" }, { status: 404 });
      const done = await declineEditRequest(id, userId);
      if (!done) return NextResponse.json({ error: "already decided", code: "resolved" }, { status: 409 });
      return NextResponse.json({ request: done });
    }
    if (body?.action === "approve") {
      const result = await approveEditRequest(id, userId, { confirmDistinct: body.confirmDistinct === true });
      if (!result.ok) {
        const { status, ...rest } = result;
        return NextResponse.json(rest, { status });
      }
      return NextResponse.json({ request: result.request, spot: result.spot });
    }
    return NextResponse.json({ error: "action must be decline or approve" }, { status: 400 });
  } catch (e) {
    if (e instanceof EditTableMissingError) return unavailable();
    console.error("[api/spot-edit-requests/:id] PATCH failed", e);
    return NextResponse.json({ error: "couldn't update the suggestion" }, { status: 500 });
  }
}

/** DELETE /api/spot-edit-requests/:id — withdraw your OWN pending suggestion.
 *  404 for anyone else's, a decided one or an unknown id. 200 { ok: true } */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const ok = await withdrawPending(id, userId);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof EditTableMissingError) return unavailable();
    console.error("[api/spot-edit-requests/:id] DELETE failed", e);
    return NextResponse.json({ error: "couldn't withdraw the suggestion" }, { status: 500 });
  }
}
