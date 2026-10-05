import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { insertSpot, listSpots, rowToSpot } from "@/lib/spot-store";
import {
  allocateSlug,
  checkLocation,
  findDuplicates,
  locationFromInput,
  toInput,
  validateFields,
} from "@/lib/spot-create";
import { approveRequest } from "@/lib/spot-approval";
import { getRequest } from "@/lib/spot-requests";
import { isSpotAdmin } from "@/lib/spot-admin";

/** GET /api/spots — the whole catalogue, open to every signed-in user.
 *  → 200 { spots: Spot[] }  (audit column `created_by` is never sent) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ spots: await listSpots() });
}

/** POST /api/spots — create a spot. Admin only (SPOT_ADMIN_EMAILS); anyone
 *  else gets 404, as if the route didn't exist.
 *
 *  Body: { name, nameZh?, country, area, location, facing?, region?,
 *          bestSwellDir?, bestWindDir?, bestTide?, tideTownship?,
 *          requestId?, confirmDistinct? }
 *  `location` = pasted coordinates or a Google Maps link. `requestId` makes
 *  this the approval of that spot request: the request becomes approved and
 *  every session on `req:<requestId>` moves to the new spot with conditions
 *  fetched for its own date/time (lib/spot-approval.ts).
 *
 *  201 { spot, request?, moved?, withConditions? }
 *  400 { code: "invalid" | "bad_location" }
 *  404 not admin, or requestId unknown
 *  409 { code: "duplicate", existing: Spot }            — don't create
 *      { code: "nearby", nearby: Spot[] }               — resend with confirmDistinct: true
 *      { code: "request_resolved" }                     — request isn't pending
 *      { code: "conflict" }                             — slug race, retry
 *  422 { code: "no_sea_data" }   502 { code: "lookup_failed" }  500 { error } */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const fields = validateFields(body);
  if (!fields.ok) return NextResponse.json({ error: fields.error, code: "invalid" }, { status: 400 });

  const location = typeof body.location === "string" ? body.location : "";
  const point = location.length <= 2000 ? await locationFromInput(location) : null;
  if (!point) {
    return NextResponse.json(
      { error: "couldn't find coordinates in that location", code: "bad_location" },
      { status: 400 }
    );
  }

  try {
    if (typeof body.requestId === "string") {
      const request = await getRequest(body.requestId);
      if (!request) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (request.status !== "pending") {
        return NextResponse.json({ error: "request already resolved", code: "request_resolved" }, { status: 409 });
      }
    }

    const all = await listSpots();
    const { duplicate, nearby } = findDuplicates(all, point, fields.name, fields.area);
    if (duplicate) {
      return NextResponse.json(
        { error: "that spot already exists", code: "duplicate", existing: duplicate },
        { status: 409 }
      );
    }
    if (nearby.length > 0 && body.confirmDistinct !== true) {
      return NextResponse.json(
        { error: "spots already exist close by", code: "nearby", nearby },
        { status: 409 }
      );
    }

    const geo = await checkLocation(point.lat, point.lng);
    if (!geo.ok) {
      return NextResponse.json(
        {
          error: geo.code === "no_sea_data" ? "no ocean data at that location" : "couldn't verify that location",
          code: geo.code,
        },
        { status: geo.code === "no_sea_data" ? 422 : 502 }
      );
    }

    const taken = new Set(all.map((s) => s.slug));
    const input = toInput(fields, point, geo.timezone);
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = allocateSlug(input.name, taken);
      const row = await insertSpot(slug, input, userId);
      if (row === "conflict") {
        taken.add(slug); // someone took it a moment ago — try the next suffix
        continue;
      }
      const spot = rowToSpot(row);
      if (typeof body.requestId !== "string") return NextResponse.json({ spot }, { status: 201 });
      const approval = await approveRequest(body.requestId, spot);
      return NextResponse.json(
        {
          spot,
          request: approval.request && { id: approval.request.id, status: approval.request.status, spotSlug: spot.slug },
          moved: approval.moved,
          withConditions: approval.withConditions,
        },
        { status: 201 }
      );
    }
    return NextResponse.json({ error: "couldn't allocate an id", code: "conflict" }, { status: 409 });
  } catch (e) {
    console.error("[api/spots] POST failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "couldn't save the spot" }, { status: 500 });
  }
}
