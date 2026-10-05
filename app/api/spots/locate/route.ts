import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSpots } from "@/lib/spot-store";
import { isSpotAdmin } from "@/lib/spot-admin";
import { locationFromInput, neighbourPlace, reverseGeocode } from "@/lib/spot-create";

/** POST /api/spots/locate — admin only. Body: { location } (pasted
 *  coordinates or a Google Maps link). Returns { lat, lng, country, area,
 *  areaOptions, source } so the add-spot form can prefill country and area
 *  from the pin. `source` is "neighbour" when an existing spot within 30 km
 *  supplied the spelling (keeps "Siargao" from fragmenting), else
 *  "geocoder" (Nominatim), or "none" when nothing could be detected — the
 *  coordinates are still returned. 400 bad_location if no coordinates. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSpotAdmin(session.user)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const location = typeof body?.location === "string" ? body.location : "";
  const point = location.length <= 2000 ? await locationFromInput(location) : null;
  if (!point) {
    return NextResponse.json(
      { error: "couldn't find coordinates in that location", code: "bad_location" },
      { status: 400 }
    );
  }

  const [spots, geo] = await Promise.all([listSpots(), reverseGeocode(point.lat, point.lng)]);
  const neighbour = neighbourPlace(spots, point);
  return NextResponse.json({
    lat: point.lat,
    lng: point.lng,
    country: neighbour?.country ?? geo?.country ?? null,
    area: neighbour?.area ?? geo?.area ?? null,
    areaOptions: geo?.areaOptions ?? [],
    source: neighbour ? "neighbour" : geo ? "geocoder" : "none",
  });
}
