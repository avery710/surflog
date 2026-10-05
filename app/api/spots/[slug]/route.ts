import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteSpot, getSpotRow, listSpots, rowToSpot, spotInUse, updateSpot } from "@/lib/spot-store";
import {
  checkLocation,
  findDuplicates,
  locationFromInput,
  toInput,
  validateFields,
} from "@/lib/spot-create";
import { isSpotAdmin } from "@/lib/spot-admin";

type Params = { params: Promise<{ slug: string }> };

/** The row to manage, or null. Only a spot admin (SPOT_ADMIN_EMAILS) may
 *  touch a spot (Taiwan and seeds included); everyone else gets the same
 *  404 as an unknown slug, so nothing confirms the id exists. */
async function managedRow(slugParam: string) {
  let slug = slugParam;
  try {
    slug = decodeURIComponent(slugParam);
  } catch {
    // keep the raw value; it just won't match anything
  }
  return getSpotRow(slug);
}

/** PATCH /api/spots/:slug (admin) — partial edit of any spot field (same
 *  body fields as POST /api/spots; omitted ones are kept, "" clears the
 *  optional ones). `location` re-verifies the pin and re-derives the
 *  timezone. Sessions already saved keep the conditions they were fetched with.
 *  200 { spot } · 400/404/409/422/502 as POST (404 = not admin or unknown slug) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = await managedRow((await params).slug);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const fields = validateFields({
    name: row.name,
    nameZh: row.name_zh ?? "",
    region: row.region ?? "",
    country: row.country,
    area: row.area,
    facing: row.facing ?? "",
    bestSwellDir: row.best_swell_dir,
    bestWindDir: row.best_wind_dir,
    bestTide: row.best_tide ?? "",
    tideTownship: row.tide_township ?? "",
    ...body,
  });
  if (!fields.ok) return NextResponse.json({ error: fields.error, code: "invalid" }, { status: 400 });

  let point = { lat: row.lat, lng: row.lng };
  let timezone = row.timezone;
  const moved = typeof body.location === "string" && body.location.trim() !== "";
  try {
    if (moved) {
      const parsed = await locationFromInput(body.location);
      if (!parsed) {
        return NextResponse.json(
          { error: "couldn't find coordinates in that location", code: "bad_location" },
          { status: 400 }
        );
      }
      point = parsed;
    }

    const all = await listSpots();
    const { duplicate, nearby } = findDuplicates(all, point, fields.name, fields.area, row.slug);
    if (duplicate) {
      return NextResponse.json(
        { error: "that spot already exists", code: "duplicate", existing: duplicate },
        { status: 409 }
      );
    }
    if (moved && nearby.length > 0 && body.confirmDistinct !== true) {
      return NextResponse.json(
        { error: "spots already exist close by", code: "nearby", nearby },
        { status: 409 }
      );
    }

    if (moved) {
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
      timezone = geo.timezone;
    }

    const saved = await updateSpot(row.slug, toInput(fields, point, timezone));
    if (!saved) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ spot: rowToSpot(saved) });
  } catch (e) {
    console.error("[api/spots/:slug] PATCH failed", e);
    return NextResponse.json({ error: "couldn't save the spot" }, { status: 500 });
  }
}

/** DELETE /api/spots/:slug (admin) — refused (409 in_use) while
 *  any session, anyone's, still references the spot. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = await managedRow((await params).slug);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    if (await spotInUse(row.slug)) {
      return NextResponse.json(
        { error: "sessions are logged at this spot", code: "in_use" },
        { status: 409 }
      );
    }
    const ok = await deleteSpot(row.slug);
    return NextResponse.json({ ok });
  } catch (e) {
    console.error("[api/spots/:slug] DELETE failed", e);
    return NextResponse.json({ error: "couldn't delete the spot" }, { status: 500 });
  }
}
