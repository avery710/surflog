import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isSpotAdmin } from "@/lib/spot-admin";
import {
  deleteReview,
  listSpotReviews,
  readReviewInput,
  ReviewTableMissingError,
  toPublic,
  upsertReview,
} from "@/lib/spot-reviews";
import { resolveSpot } from "@/lib/spot-store";

type Params = { params: Promise<{ slug: string }> };

/** Review saves/deletes per user per hour. */
const WRITES = { limit: 30, windowMs: 60 * 60_000 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const unavailable = () =>
  NextResponse.json({ error: "spot reviews aren't switched on yet", code: "unavailable" }, { status: 503 });

function limited(userId: string) {
  const r = rateLimit(`spot-review:${userId}`, WRITES.limit, WRITES.windowMs);
  return r.ok
    ? null
    : NextResponse.json(
        { error: "too many changes, try again later", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(r.retryAfterS) } }
      );
}

/**
 * GET /api/spots/:slug/reviews — every review of a catalogue spot, newest
 * first, for any signed-in user. 200 { reviews: PublicReview[], canModerate }
 * (author display name only, never owner id or email). 404 unknown spot.
 * 503 { code: "unavailable" } until the table exists.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const spot = await resolveSpot(decode((await params).slug));
    if (!spot) return NextResponse.json({ error: "not found" }, { status: 404 });
    const rows = await listSpotReviews(spot.slug);
    return NextResponse.json({ reviews: rows.map((r) => toPublic(r, userId)), canModerate: isSpotAdmin(session.user) });
  } catch (e) {
    if (e instanceof ReviewTableMissingError) return unavailable();
    console.error("[api/spots/:slug/reviews] GET failed", e);
    return NextResponse.json({ error: "couldn't load reviews" }, { status: 500 });
  }
}

/**
 * PUT /api/spots/:slug/reviews — create or replace the caller's own review.
 * Body: { rating: 1-5, body?: string (≤1000) }.
 * 200 { review: PublicReview } · 400 { code: "invalid" } · 404 unknown spot
 * 429 rate limited · 503 { code: "unavailable" }.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tooMany = limited(userId);
  if (tooMany) return tooMany;

  const input = readReviewInput(await req.json().catch(() => null));
  if (!input.ok) return NextResponse.json({ error: input.error, code: "invalid" }, { status: 400 });
  try {
    const spot = await resolveSpot(decode((await params).slug));
    if (!spot) return NextResponse.json({ error: "not found" }, { status: 404 });
    const row = await upsertReview({
      spot_slug: spot.slug,
      owner_id: userId,
      author_name: session.user?.name?.trim().slice(0, 80) || null,
      rating: input.rating,
      body: input.body,
    });
    return NextResponse.json({ review: toPublic(row, userId) });
  } catch (e) {
    if (e instanceof ReviewTableMissingError) return unavailable();
    console.error("[api/spots/:slug/reviews] PUT failed", e);
    return NextResponse.json({ error: "couldn't save the review" }, { status: 500 });
  }
}

/**
 * DELETE /api/spots/:slug/reviews?id=<uuid> — delete the caller's own review;
 * the spot admin may delete anyone's. 200 { ok: true } · 404 not found / not
 * theirs (never confirms someone else's id) · 503 { code: "unavailable" }.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tooMany = limited(userId);
  if (tooMany) return tooMany;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const slug = decode((await params).slug);
    const done = await deleteReview(id, slug, isSpotAdmin(session.user) ? undefined : userId);
    if (!done) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReviewTableMissingError) return unavailable();
    console.error("[api/spots/:slug/reviews] DELETE failed", e);
    return NextResponse.json({ error: "couldn't delete the review" }, { status: 500 });
  }
}
