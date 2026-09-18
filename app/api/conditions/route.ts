import { NextRequest, NextResponse } from "next/server";
import { getConditions } from "@/lib/openmeteo";
import { spotBySlug } from "@/lib/spots";

/** GET /api/conditions?spot=waiao&when=2026-09-17T06:00 */
export async function GET(req: NextRequest) {
  const spotSlug = req.nextUrl.searchParams.get("spot");
  const when = req.nextUrl.searchParams.get("when");

  if (!spotSlug || !when) {
    return NextResponse.json({ error: "spot and when are required" }, { status: 400 });
  }

  const spot = spotBySlug(spotSlug);
  if (!spot) {
    return NextResponse.json({ error: `unknown spot: ${spotSlug}` }, { status: 404 });
  }
  if (spot.lat == null || spot.lng == null) {
    // most spots are still missing coordinates — see CLAUDE.md
    return NextResponse.json(
      { error: `no coordinates for ${spot.name} yet` },
      { status: 422 }
    );
  }

  try {
    const cond = await getConditions(spot.lat, spot.lng, when);
    return NextResponse.json({ spot: spot.slug, when, cond });
  } catch (e) {
    const message = e instanceof Error ? e.message : "lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
