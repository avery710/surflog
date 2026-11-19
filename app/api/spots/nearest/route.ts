import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSpots } from "@/lib/spot-store";
import { nearestSpot } from "@/lib/session-draft";
import { validLatLng } from "@/lib/spot-geo";

/** POST /api/spots/nearest — { lat, lng } → the closest catalogue break
 *  within 30 km, or { slug: null } when nothing is that close. Signed-in
 *  users (a video's GPS pre-fills a draft). Not the admin locate route,
 *  which turns a pasted pin into a country and area for adding a spot. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lat = typeof body?.lat === "number" ? body.lat : NaN;
  const lng = typeof body?.lng === "number" ? body.lng : NaN;
  if (!validLatLng(lat, lng)) {
    return NextResponse.json({ error: "invalid coordinates", code: "bad_location" }, { status: 400 });
  }

  const hit = nearestSpot(await listSpots(), { lat, lng });
  if (!hit) return NextResponse.json({ slug: null, distanceM: null, timezone: null });
  return NextResponse.json({ slug: hit.slug, distanceM: Math.round(hit.distanceM), timezone: hit.timezone });
}
