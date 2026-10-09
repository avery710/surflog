import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { PinTableMissingError, pinSpot, unpinSpot } from "@/lib/spot-pins";
import { resolveSpot } from "@/lib/spot-store";

type Params = { params: Promise<{ slug: string }> };

/** Pin / unpin toggles per user per minute. */
const TOGGLES = { limit: 60, windowMs: 60_000 };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

async function handle(req: NextRequest, { params }: Params, pin: boolean) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = rateLimit(`spot-pin:${userId}`, TOGGLES.limit, TOGGLES.windowMs);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too many changes, try again later", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterS) } }
    );
  }
  try {
    const spot = await resolveSpot(decode((await params).slug));
    if (!spot) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (pin) {
      if (!(await pinSpot(userId, spot.slug))) {
        return NextResponse.json({ error: "too many pinned spots", code: "limit" }, { status: 409 });
      }
    } else {
      await unpinSpot(userId, spot.slug);
    }
    return NextResponse.json({ ok: true, pinned: pin });
  } catch (e) {
    if (e instanceof PinTableMissingError) {
      return NextResponse.json({ error: "pinning isn't switched on yet", code: "unavailable" }, { status: 503 });
    }
    console.error("[api/spots/:slug/pin] failed", e);
    return NextResponse.json({ error: "couldn't save the pin" }, { status: 500 });
  }
}

/**
 * PUT /api/spots/:slug/pin — pin a catalogue spot for the caller (idempotent).
 * DELETE — unpin it. Private per user. 200 { ok, pinned } · 404 unknown spot
 * · 409 { code: "limit" } at MAX_PINS · 429 · 503 { code: "unavailable" }.
 */
export function PUT(req: NextRequest, ctx: Params) {
  return handle(req, ctx, true);
}

export function DELETE(req: NextRequest, ctx: Params) {
  return handle(req, ctx, false);
}
